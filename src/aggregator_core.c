/* ─────────────────────────────────────────────────────────────
 * aggregator_core.c
 * Sequential baseline: reads the CSV file line-by-line and
 * accumulates into a StockSummary. Used as the reference
 * implementation for correctness checks and speedup measurement.
 *
 * CSV format produced by data_generator.py:
 *   timestamp, ticker, price, type, volume, total_value
 *   index:    0        1      2     3       4       5
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "aggregator_core.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* ── Internal helpers ──────────────────────────────────────── */

void summary_init(StockSummary *s) {
    memset(s, 0, sizeof(StockSummary));
}

int find_or_add_ticker(StockSummary *s, const char *ticker) {
    /* Linear scan — O(T) where T ≤ 8 tickers, cache-friendly */
    for (int i = 0; i < s->ticker_count; i++) {
        if (strncmp(s->ticker_breakdown[i].ticker, ticker, TICKER_LEN) == 0)
            return i;
    }
    /* Create new entry */
    if (s->ticker_count < MAX_TICKERS) {
        int idx = s->ticker_count++;
        strncpy(s->ticker_breakdown[idx].ticker, ticker, TICKER_LEN - 1);
        s->ticker_breakdown[idx].ticker[TICKER_LEN - 1] = '\0';
        s->ticker_breakdown[idx].volume = 0.0;
        return idx;
    }
    return -1; /* table full — should never happen for this dataset */
}

void summary_merge(StockSummary *dst, const StockSummary *src) {
    /*
     * Called by the tree-reducer to combine two partial summaries.
     * Mirrors Python's StockSummary.merge():
     *   self.total_buy  += other.total_buy
     *   self.total_sell += other.total_sell
     *   ...ticker merge...
     */
    dst->total_buy  += src->total_buy;
    dst->total_sell += src->total_sell;

    for (int i = 0; i < src->ticker_count; i++) {
        int idx = find_or_add_ticker(dst, src->ticker_breakdown[i].ticker);
        if (idx >= 0)
            dst->ticker_breakdown[idx].volume += src->ticker_breakdown[i].volume;
    }

    dst->net_flow = dst->total_buy - dst->total_sell;
}

/* ── Public API ────────────────────────────────────────────── */

void sequential_aggregate(const char *file_path, StockSummary *out) {
    summary_init(out);

    FILE *f = fopen(file_path, "r");
    if (!f) {
        perror("sequential_aggregate: fopen");
        return;
    }

    char line[512];
    /* Skip CSV header row */
    if (!fgets(line, sizeof(line), f)) {
        fclose(f);
        return;
    }

    while (fgets(line, sizeof(line), f)) {
        /*
         * Fast manual parse using strtok_r (thread-safe) — matches
         * the Python approach of manual split rather than csv.reader.
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

        if (is_buy) out->total_buy  += val;
        else        out->total_sell += val;

        int idx = find_or_add_ticker(out, ticker);
        if (idx >= 0)
            out->ticker_breakdown[idx].volume += val;
    }

    out->net_flow = out->total_buy - out->total_sell;
    fclose(f);
}
