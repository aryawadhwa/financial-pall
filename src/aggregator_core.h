#ifndef AGGREGATOR_CORE_H
#define AGGREGATOR_CORE_H

/* ─────────────────────────────────────────────────────────────
 * aggregator_core.h
 * Data structures and sequential aggregation baseline.
 * Mirrors the Python StockSummary dataclass + SequentialAggregator.
 * ───────────────────────────────────────────────────────────── */

#define MAX_TICKERS 64
#define TICKER_LEN  16

/* Per-ticker accumulator — replaces Python's dict entry */
typedef struct {
    char   ticker[TICKER_LEN];
    double volume;
} TickerEntry;

/* Top-level result container — replaces Python's StockSummary dataclass */
typedef struct {
    double      total_buy;
    double      total_sell;
    double      net_flow;
    TickerEntry ticker_breakdown[MAX_TICKERS];
    int         ticker_count;
} StockSummary;

/* ── API ─────────────────────────────────────────────────────── */

/* Zero-initialise a summary */
void summary_init(StockSummary *s);

/* Merge src INTO dst  (called by tree-reduce) */
void summary_merge(StockSummary *dst, const StockSummary *src);

/* Return index of ticker in s->ticker_breakdown; creates entry if absent.
   Returns -1 if the array is full (should never happen with 8 tickers). */
int find_or_add_ticker(StockSummary *s, const char *ticker);

/* Single-threaded baseline that reads file_path line-by-line */
void sequential_aggregate(const char *file_path, StockSummary *out);

#endif /* AGGREGATOR_CORE_H */
