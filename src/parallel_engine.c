/* ─────────────────────────────────────────────────────────────
 * parallel_engine.c
 *
 * Full three-phase parallel MapReduce implementation.
 *
 * PHASE 1 — DIVIDE  : partition_data()
 *   Complexity: O(1) — one fseek to get file size, arithmetic to
 *   compute byte ranges. No file content is loaded.
 *
 * PHASE 2 — MAP     : worker_map()
 *   Each of W pthreads independently:
 *     a. Seeks to its byte range in the file
 *     b. Skips the first line (header row for W0; partial record
 *        at the byte boundary for W1..N-1)
 *     c. Reads its chunk into a heap buffer (one fread call)
 *     d. Reads one extra line past byte_end to avoid cutting a record
 *     e. Parses line-by-line with strtok_r — O(N/W) per worker
 *     f. Accumulates into a local HashTable — O(1) per row
 *     g. Dumps HashTable → sorted TickerEntry[] — O(K log K), constant
 *   All W workers run concurrently → wall-clock O(N/W)
 *
 * Synchronisation:
 *   pthread_join() on the main thread is the sole synchronisation
 *   point. It guarantees all Map phases are complete before Reduce
 *   begins. pthread_barrier_t is intentionally not used — it is an
 *   optional POSIX extension that macOS (Darwin) does not implement.
 *
 * PHASE 3 — REDUCE  : parallel_tree_reduce()
 *   Binary tree reduction — O(log W) levels.
 *   At each level, pairs of partial results are merged with
 *   sorted_merge() — O(K) linear two-pointer merge. The tree
 *   collapses W partial summaries into args[0].result.
 *
 *   Note: the reduce runs on the main thread after join. Because K
 *   (tickers) is small (≤ 64), the reduce cost O(K·log W) is
 *   negligible vs the O(N/W) map cost. The binary tree structure
 *   still correctly demonstrates O(log W) algorithmic depth.
 *
 * Total parallel wall-clock: O(N/W + K·log W) ≈ O(N/W)
 * Sequential baseline:       O(N)
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "parallel_engine.h"
#include "aggregator_core.h"
#include "ht.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>

/* ═══════════════════════════════════════════════════════════════
 * PHASE 1: DIVIDE
 * ═══════════════════════════════════════════════════════════════ */

/*
 * partition_data
 *
 * Splits [0, file_size) into n balanced byte ranges stored in args[].
 *
 * Boundary problem: a range boundary may fall mid-record. This is
 * handled in worker_map() where every worker unconditionally skips
 * its first line:
 *   Worker 0       → skips the CSV header row
 *   Workers 1..N-1 → skip the partial record at the byte boundary
 */
static void partition_data(const char *file_path, WorkerArgs *args, int n) {
    FILE *f = fopen(file_path, "rb");
    if (!f) { perror("partition_data: fopen"); return; }
    fseek(f, 0, SEEK_END);
    long file_size = ftell(f);
    fclose(f);

    long chunk = file_size / n;
    for (int i = 0; i < n; i++) {
        args[i].byte_start = i * chunk;
        args[i].byte_end   = (i < n - 1) ? (i + 1) * chunk : file_size;
    }
}

/* ═══════════════════════════════════════════════════════════════
 * PHASE 2: MAP
 * ═══════════════════════════════════════════════════════════════ */

/*
 * worker_map — pthread entry point.
 *
 * Each thread independently processes its byte range and writes
 * its partial StockSummary into a->result. The main thread reads
 * a->result only after pthread_join(), so no mutex is needed.
 */
static void *worker_map(void *arg) {
    WorkerArgs *a = (WorkerArgs *)arg;
    summary_init(&a->result);

    /* ── Open file and seek to partition start ─────────────── */
    FILE *f = fopen(a->file_path, "rb");
    if (!f) { perror("worker_map: fopen"); return NULL; }
    fseek(f, a->byte_start, SEEK_SET);

    /* ── Skip first line ───────────────────────────────────────
     * Worker 0       : skip CSV header row
     * Workers 1..N-1 : skip partial record at the byte boundary */
    {
        char skip[512];
        fgets(skip, sizeof(skip), f);
    }

    long actual_start = ftell(f);
    long read_size    = a->byte_end - actual_start;

    if (read_size <= 0) { fclose(f); return NULL; }

    /* ── Read chunk into heap buffer (+512 headroom) ─────────── */
    char *buf = (char *)malloc((size_t)read_size + 513);
    if (!buf) { perror("worker_map: malloc"); fclose(f); return NULL; }

    size_t bytes_read = fread(buf, 1, (size_t)read_size, f);

    /* ── Read one extra line past byte_end to avoid split records */
    char extra[512];
    if (fgets(extra, sizeof(extra), f)) {
        size_t el = strlen(extra);
        memcpy(buf + bytes_read, extra, el);
        bytes_read += el;
    }
    buf[bytes_read] = '\0';
    fclose(f);

    /* ── Parse buffer with hash table ─────────────────────────── */
    HashTable ht;
    ht_init(&ht);

    char *cursor = buf;
    char *newline;

    while ((newline = strchr(cursor, '\n')) != NULL) {
        *newline = '\0';
        char *line = cursor;
        cursor     = newline + 1;

        /* CSV: timestamp(0) ticker(1) price(2) type(3) volume(4) total_value(5) */
        /* Manual pointer parsing for performance (avoids strtok_r overhead) */
        char *p = line;

        /* timestamp */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* ticker */
        char *ticker_start = p;
        while (*p && *p != ',') p++;
        if (!*p) continue;
        int t_len = p - ticker_start;
        if (t_len >= TICKER_LEN) t_len = TICKER_LEN - 1;
        char ticker[TICKER_LEN];
        memcpy(ticker, ticker_start, t_len);
        ticker[t_len] = '\0';
        p++;

        /* price */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* type */
        int is_buy = (*p == 'B');
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* volume */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* total_value */
        double val = atof(p);

        /* O(1) average hash table update */
        ht_update(&ht, ticker, val, is_buy);

        if (is_buy) a->result.total_buy  += val;
        else        a->result.total_sell += val;
    }

    free(buf);
    a->result.net_flow = a->result.total_buy - a->result.total_sell;

    /* ── Dump hash table → sorted TickerEntry[] ─────────────── */
    ht_to_sorted_array(&ht, a->result.ticker_breakdown, &a->result.ticker_count);

    return NULL;
}

/* ═══════════════════════════════════════════════════════════════
 * PHASE 3: REDUCE — Binary Tree
 * ═══════════════════════════════════════════════════════════════ */

/*
 * parallel_tree_reduce
 *
 * Collapses W partial StockSummary results into a single global one
 * using a binary tree tournament:
 *
 *   stride=1: scratch[0] ← merge(scratch[0], scratch[1])
 *             scratch[2] ← merge(scratch[2], scratch[3])  } same level
 *             ...
 *   stride=2: scratch[0] ← merge(scratch[0], scratch[2])
 *             ...
 *
 * Each merge uses sorted_merge() — O(K) linear two-pointer merge
 * (same structure as the merge step in Merge Sort).
 *
 * Total levels: ceil(log2(W))
 * Total merges: W - 1
 * Total work:   O(K · log W)
 */
static void parallel_tree_reduce(WorkerArgs *args, int n, StockSummary *out) {
    StockSummary *scratch = (StockSummary *)malloc((size_t)n * sizeof(StockSummary));
    if (!scratch) { perror("parallel_tree_reduce: malloc"); return; }

    for (int i = 0; i < n; i++)
        scratch[i] = args[i].result;

    int active = n;
    while (active > 1) {
        /* Pairwise merge at this tree level */
        for (int i = 0; i + 1 < active; i += 2)
            sorted_merge(&scratch[i], &scratch[i + 1]);

        /* Compact winners (even indices) */
        int next = 0;
        for (int i = 0; i < active; i += 2)
            scratch[next++] = scratch[i];
        active = next;
    }

    *out = scratch[0];
    free(scratch);
}

/* ═══════════════════════════════════════════════════════════════
 * PUBLIC API
 * ═══════════════════════════════════════════════════════════════ */

void parallel_aggregate(const char *file_path, int num_workers,
                        StockSummary *out)
{
    if (num_workers < 1) num_workers = 1;

    WorkerArgs *args    = (WorkerArgs *)calloc((size_t)num_workers,
                                               sizeof(WorkerArgs));
    pthread_t  *threads = (pthread_t *)malloc((size_t)num_workers *
                                               sizeof(pthread_t));
    if (!args || !threads) {
        perror("parallel_aggregate: calloc/malloc");
        free(args); free(threads);
        return;
    }

    /* ── Initialise worker arguments ──────────────────────── */
    for (int i = 0; i < num_workers; i++) {
        args[i].file_path  = file_path;
        args[i].worker_id  = i;
    }

    /* ── DIVIDE: compute byte ranges — O(1) ───────────────── */
    partition_data(file_path, args, num_workers);

    /* ── MAP: spawn one pthread per partition ─────────────── */
    for (int i = 0; i < num_workers; i++) {
        if (pthread_create(&threads[i], NULL, worker_map, &args[i]) != 0)
            perror("pthread_create");
    }

    /* ── Synchronise: wait for all Map phases to finish ────── */
    for (int i = 0; i < num_workers; i++)
        pthread_join(threads[i], NULL);

    /* ── REDUCE: binary tree merge — O(K · log W) ─────────── */
    parallel_tree_reduce(args, num_workers, out);

    free(args);
    free(threads);
}
