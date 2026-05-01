/* ─────────────────────────────────────────────────────────────
 * parallel_engine.c
 * Parallel MapReduce pipeline using POSIX threads.
 *
 * Pipeline:
 *   DIVIDE  partition_data()     — O(1): compute byte offsets, no file load
 *   MAP     process_chunk()      — N pthreads, each owns its byte range
 *   REDUCE  tree_reduce()        — O(log N) pairwise merges
 *
 * The MAP phase reads each chunk into memory in one fread() call,
 * then parses in-place — mirrors Python's f.read(remaining) approach.
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "parallel_engine.h"
#include "aggregator_core.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>

/* ── PHASE 1: DIVIDE ──────────────────────────────────────── */

/*
 * Splits [0, file_size) into `n` balanced byte ranges.
 * Stored back into args[i].byte_start / byte_end.
 * Identical logic to Python's partition_data():
 *   chunk_size = file_size // n
 *   ranges = [(i*chunk, (i+1)*chunk if i<n-1 else file_size) ...]
 */
static void partition_data(const char *file_path, ChunkArgs *args, int n) {
    FILE *f = fopen(file_path, "rb");
    if (!f) { perror("partition_data: fopen"); return; }
    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    fclose(f);

    long chunk_size = file_size / n;
    for (int i = 0; i < n; i++) {
        args[i].byte_start = i * chunk_size;
        args[i].byte_end   = (i < n - 1) ? (i + 1) * chunk_size : file_size;
    }
}

/* ── PHASE 2: MAP (pthread worker) ───────────────────────── */

/*
 * Each thread:
 *   1. Seeks to byte_start.
 *   2. If not at file start, skips the partial first line
 *      (same edge-case fix as Python: "Handle partial line at start").
 *   3. Reads the entire assigned chunk into a heap buffer with fread().
 *   4. Appends one extra line to handle the chunk boundary.
 *   5. Parses lines in-place with strtok_r().
 */
static void *process_chunk(void *arg) {
    ChunkArgs *a = (ChunkArgs *)arg;
    summary_init(&a->result);

    FILE *f = fopen(a->file_path, "rb");
    if (!f) { perror("process_chunk: fopen"); return NULL; }

    fseek(f, a->byte_start, SEEK_SET);

    /* ── Skip the first line for every worker:
     *   Worker 0           → skip the CSV header row
     *   Workers 1..N-1     → skip the partial record at the byte boundary
     * This matches Python: "if start != 0: f.readline()" but also
     * accounts for the header on the very first worker. */
    {
        char skip[512];
        fgets(skip, sizeof(skip), f);
    }

    long actual_start = ftell(f);
    long nominal_end  = a->byte_end;
    long read_size    = nominal_end - actual_start;

    if (read_size <= 0) { fclose(f); return NULL; }

    /*
     * Allocate: chunk bytes + 512 bytes headroom for the extra boundary line.
     * We add +1 for the mandatory '\0' terminator.
     */
    char *buf = (char *)malloc((size_t)read_size + 513);
    if (!buf) { perror("process_chunk: malloc"); fclose(f); return NULL; }

    size_t bytes_read = fread(buf, 1, (size_t)read_size, f);

    /* Read one more line beyond the nominal end to avoid cutting a record */
    char extra[512];
    if (fgets(extra, sizeof(extra), f)) {
        size_t extra_len = strlen(extra);
        memcpy(buf + bytes_read, extra, extra_len);
        bytes_read += extra_len;
    }

    buf[bytes_read] = '\0';
    fclose(f);

    /* ── Parse in-memory buffer line by line ─────────────── */
    char *cursor = buf;
    char *newline;

    while ((newline = strchr(cursor, '\n')) != NULL) {
        *newline = '\0'; /* terminate the current line in-place */
        char *line = cursor;
        cursor = newline + 1;

        /*
         * CSV: timestamp, ticker, price, type, volume, total_value
         * We need: ticker (idx 1), type (idx 3), total_value (idx 5)
         */
        char *p = line;

        /* 0: timestamp */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* 1: ticker */
        char *tok = p;
        while (*p && *p != ',') p++;
        if (!*p) continue;
        *p = '\0'; /* terminate ticker */

        char ticker[TICKER_LEN];
        strncpy(ticker, tok, TICKER_LEN - 1);
        ticker[TICKER_LEN - 1] = '\0';
        p++;

        /* 2: price */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* 3: type */
        int is_buy = (*p == 'B');
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* 4: volume */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* 5: total_value */
        double val = atof(p);

        if (is_buy) a->result.total_buy  += val;
        else        a->result.total_sell += val;

        int idx = find_or_add_ticker(&a->result, ticker);
        if (idx >= 0)
            a->result.ticker_breakdown[idx].volume += val;
    }

    a->result.net_flow = a->result.total_buy - a->result.total_sell;
    free(buf);
    return NULL;
}

/* ── PHASE 3: TREE REDUCE ─────────────────────────────────── */

/*
 * Binary Tree Reduction — O(log N) depth.
 *
 * Python equivalent:
 *   while len(summaries) > 1:
 *       next_level = []
 *       for i in range(0, len(summaries), 2):
 *           if i+1 < len(summaries):
 *               next_level.append(summaries[i].merge(summaries[i+1]))
 *           else:
 *               next_level.append(summaries[i])
 *       summaries = next_level
 *   return summaries[0]
 *
 * Complexity: O(N) total merges, O(log N) sequential depth.
 * Avoids a single-reducer bottleneck compared to O(N) sequential merge.
 */
static void tree_reduce(StockSummary *arr, int n, StockSummary *out) {
    /* Work on a scratch copy so we don't mutate the original results */
    StockSummary *scratch = (StockSummary *)malloc((size_t)n * sizeof(StockSummary));
    if (!scratch) { perror("tree_reduce: malloc"); return; }
    memcpy(scratch, arr, (size_t)n * sizeof(StockSummary));

    while (n > 1) {
        int next_n = 0;
        for (int i = 0; i < n; i += 2) {
            if (i + 1 < n) {
                summary_merge(&scratch[i], &scratch[i + 1]); /* pairwise merge */
            }
            scratch[next_n++] = scratch[i];
        }
        n = next_n;
    }

    *out = scratch[0];
    free(scratch);
}

/* ── Public API ────────────────────────────────────────────── */

void parallel_aggregate(const char *file_path, int num_workers, StockSummary *out) {
    ChunkArgs *args    = (ChunkArgs *)calloc((size_t)num_workers, sizeof(ChunkArgs));
    pthread_t *threads = (pthread_t *)malloc((size_t)num_workers * sizeof(pthread_t));

    if (!args || !threads) {
        perror("parallel_aggregate: calloc/malloc");
        free(args); free(threads);
        return;
    }

    /* Initialise shared fields in each ChunkArgs */
    for (int i = 0; i < num_workers; i++) {
        args[i].file_path = file_path;
        args[i].worker_id = i;
    }

    /* DIVIDE: compute byte ranges */
    partition_data(file_path, args, num_workers);

    /* MAP: spawn one pthread per partition */
    for (int i = 0; i < num_workers; i++) {
        if (pthread_create(&threads[i], NULL, process_chunk, &args[i]) != 0) {
            perror("pthread_create");
        }
    }

    /* Wait for all workers to complete */
    for (int i = 0; i < num_workers; i++) {
        pthread_join(threads[i], NULL);
    }

    /* Collect partial results */
    StockSummary *partials = (StockSummary *)malloc((size_t)num_workers * sizeof(StockSummary));
    if (!partials) { perror("parallel_aggregate: malloc partials"); goto cleanup; }

    for (int i = 0; i < num_workers; i++) {
        partials[i] = args[i].result;
    }

    /* REDUCE: binary tree merge */
    tree_reduce(partials, num_workers, out);
    free(partials);

cleanup:
    free(args);
    free(threads);
}
