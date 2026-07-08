#ifndef AGGREGATOR_CORE_H
#define AGGREGATOR_CORE_H

/* ─────────────────────────────────────────────────────────────
 * aggregator_core.h
 *
 * Defines:
 *   StockSummary  — final output container (global aggregate)
 *   sorted_merge  — merges two sorted TickerEntry arrays (Reduce phase)
 *   sequential_aggregate — single-threaded baseline for correctness
 *                          checks and speedup measurement
 * ───────────────────────────────────────────────────────────── */

#include "ht.h"   /* TickerEntry, TICKER_LEN, TABLE_SIZE */

#define MAX_TICKERS TABLE_SIZE   /* upper bound on distinct tickers */

/*
 * StockSummary — top-level result after all phases complete.
 *
 * ticker_breakdown[] is a sorted array of TickerEntry (sorted by
 * ticker name). This makes the Reduce phase's sorted_merge() O(K)
 * rather than O(K^2).
 */
typedef struct {
    double      total_buy;
    double      total_sell;
    double      net_flow;
    TickerEntry ticker_breakdown[MAX_TICKERS];
    int         ticker_count;
} StockSummary;

/* ── API ─────────────────────────────────────────────────────── */

/* Zero-initialise a StockSummary */
void summary_init(StockSummary *s);

/*
 * sorted_merge — merge src's sorted TickerEntry[] into dst's.
 *
 * Both arrays must be sorted by ticker name (guaranteed because each
 * worker calls ht_to_sorted_array() which calls qsort()).
 *
 * Complexity: O(K_dst + K_src) — linear sorted merge, same as the
 * merge step in merge sort. This is the Reduce phase core operation.
 *
 * Called by the binary tree reduce at every level.
 */
void sorted_merge(StockSummary *dst, const StockSummary *src);

/*
 * sequential_aggregate — single-threaded reference implementation.
 *
 * Uses the same open-addressing hash table internally for consistency,
 * then dumps to StockSummary at the end. Provides the correctness
 * baseline and the T_sequential timing for speedup = T_seq / T_par.
 */
void sequential_aggregate(const char *file_path, StockSummary *out);

#endif /* AGGREGATOR_CORE_H */
