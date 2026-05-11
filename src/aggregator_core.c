/* ─────────────────────────────────────────────────────────────
 * aggregator_core.c
 *
 * Sequential baseline + sorted merge for the Reduce phase.
 *
 * CSV format (produced by data_generator.py):
 *   timestamp, ticker, price, type, volume, total_value
 *   col idx:   0       1      2     3       4       5
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "aggregator_core.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* ── summary_init ─────────────────────────────────────────── */

void summary_init(StockSummary *s) {
    memset(s, 0, sizeof(StockSummary));
}

/* ── sorted_merge ─────────────────────────────────────────── */

/*
 * Merges src's sorted TickerEntry[] into dst's sorted TickerEntry[].
 *
 * Algorithm: two-pointer linear merge — identical in structure to the
 * merge step in Merge Sort. Both arrays are sorted by ticker name,
 * so we scan them in tandem:
 *   - If tickers match → accumulate into dst entry
 *   - If dst ticker < src ticker → advance dst pointer
 *   - If src ticker < dst ticker → insert src entry into dst (append
 *     to a temp array, then copy back once merge is complete)
 *
 * Complexity: O(K_dst + K_src) where K ≤ MAX_TICKERS.
 * Because K is a small constant (≤ 64), the total Reduce phase cost
 * is O(K · log W) across all tree levels.
 */
void sorted_merge(StockSummary *dst, const StockSummary *src) {
    /* Build a merged result in a temp array, then copy back to dst */
    TickerEntry merged[MAX_TICKERS * 2];
    int m = 0;

    int i = 0, j = 0;

    while (i < dst->ticker_count && j < src->ticker_count) {
        int cmp = strncmp(dst->ticker_breakdown[i].ticker,
                          src->ticker_breakdown[j].ticker, TICKER_LEN);
        if (cmp == 0) {
            /* Same ticker — accumulate */
            merged[m] = dst->ticker_breakdown[i];
            merged[m].buy      += src->ticker_breakdown[j].buy;
            merged[m].sell     += src->ticker_breakdown[j].sell;
            merged[m].net_flow  = merged[m].buy - merged[m].sell;
            i++; j++;
        } else if (cmp < 0) {
            /* dst ticker sorts before src ticker */
            merged[m] = dst->ticker_breakdown[i++];
        } else {
            /* src ticker sorts before dst ticker */
            merged[m] = src->ticker_breakdown[j++];
        }
        m++;
    }

    /* Drain remaining entries */
    while (i < dst->ticker_count) merged[m++] = dst->ticker_breakdown[i++];
    while (j < src->ticker_count) merged[m++] = src->ticker_breakdown[j++];

    /* Update scalar accumulators */
    dst->total_buy  += src->total_buy;
    dst->total_sell += src->total_sell;
    dst->net_flow    = dst->total_buy - dst->total_sell;

    /* Copy merged ticker array back into dst */
    dst->ticker_count = m;
    memcpy(dst->ticker_breakdown, merged, (size_t)m * sizeof(TickerEntry));
}

/* ── sequential_aggregate ─────────────────────────────────── */

/*
 * Single-threaded reference implementation.
 *
 * Uses the same open-addressing HashTable as each parallel worker,
 * then dumps it to StockSummary via ht_to_sorted_array(). This
 * ensures the sequential and parallel paths use identical arithmetic,
 * making the correctness comparison meaningful.
 *
 * Time complexity: O(N) — one pass through the file.
 * This is the T_sequential used in speedup = T_sequential / T_parallel.
 */
void sequential_aggregate(const char *file_path, StockSummary *out) {
    summary_init(out);

    FILE *f = fopen(file_path, "r");
    if (!f) { perror("sequential_aggregate: fopen"); return; }

    /* Skip CSV header */
    char line[512];
    if (!fgets(line, sizeof(line), f)) { fclose(f); return; }

    HashTable ht;
    ht_init(&ht);

    while (fgets(line, sizeof(line), f)) {
        /* Replace strtok_r with manual pointer iteration for speed and to avoid copy-on-write */
        char *p = line;

        /* timestamp */
        while (*p && *p != ',') p++;
        if (!*p) continue;
        p++;

        /* ticker */
        char *ticker_start = p;
        while (*p && *p != ',') p++;
        if (!*p) continue;

        char ticker[TICKER_LEN];
        int tlen = p - ticker_start;
        if (tlen >= TICKER_LEN) tlen = TICKER_LEN - 1;
        memcpy(ticker, ticker_start, tlen);
        ticker[tlen] = '\0';
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

        /* total_val */
        double val = atof(p);

        ht_update(&ht, ticker, val, is_buy);

        if (is_buy) out->total_buy  += val;
        else        out->total_sell += val;
    }
    fclose(f);

    out->net_flow = out->total_buy - out->total_sell;

    /* Dump hash table to sorted ticker array */
    ht_to_sorted_array(&ht, out->ticker_breakdown, &out->ticker_count);
}
