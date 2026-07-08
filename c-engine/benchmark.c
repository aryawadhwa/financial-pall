/* ─────────────────────────────────────────────────────────────
 * benchmark.c  —  Main entry point
 *
 * Workflow:
 *   1. Run sequential_aggregate()  → record T_sequential
 *   2. Run parallel_aggregate()    → record T_parallel
 *   3. Per-ticker correctness check (|seq_buy - par_buy| < 0.01)
 *   4. Compute speedup = T_sequential / T_parallel
 *   5. Print formatted terminal table
 *   6. Write dashboard/results.json
 *
 * Usage:
 *   ./financial_agg                      — auto-detect cores, data/stocks.csv
 *   ./financial_agg 4                    — 4 workers, data/stocks.csv
 *   ./financial_agg 4 path/to/file.csv   — 4 workers, custom file
 * ───────────────────────────────────────────────────────────── */

#define _POSIX_C_SOURCE 200809L

#include "src/aggregator_core.h"
#include "src/parallel_engine.h"
#include "src/platform.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* ── Timing — delegates to platform.h ───────────────────────── */
static double now_s(void) { return platform_time_s(); }

/* ── JSON Export ─────────────────────────────────────────────
 * Schema matches what dashboard/main.js expects.
 * ticker_breakdown entries include buy, sell, net_flow.
 */
static void write_results_json(const char         *path,
                               double              seq_time,
                               double              par_time,
                               double              speedup,
                               int                 num_workers,
                               int                 accuracy,
                               const StockSummary *par)
{
    /* Ensure dashboard/ directory exists */
    mkdir("dashboard", 0755);

    FILE *f = fopen(path, "w");
    if (!f) { perror("write_results_json: fopen"); return; }

    fprintf(f, "{\n");
    fprintf(f, "  \"metrics\": {\n");
    fprintf(f, "    \"sequential_time\": %.6f,\n", seq_time);
    fprintf(f, "    \"parallel_time\": %.6f,\n",   par_time);
    fprintf(f, "    \"speedup\": %.6f,\n",          speedup);
    fprintf(f, "    \"num_workers\": %d,\n",        num_workers);
    fprintf(f, "    \"accuracy_check\": %s\n",      accuracy ? "true" : "false");
    fprintf(f, "  },\n");
    fprintf(f, "  \"summary\": {\n");
    fprintf(f, "    \"total_buy\": %.2f,\n",  par->total_buy);
    fprintf(f, "    \"total_sell\": %.2f,\n", par->total_sell);
    fprintf(f, "    \"net_flow\": %.2f,\n",   par->net_flow);
    fprintf(f, "    \"ticker_breakdown\": [\n");

    for (int i = 0; i < par->ticker_count; i++) {
        const TickerEntry *t = &par->ticker_breakdown[i];
        int last = (i == par->ticker_count - 1);
        fprintf(f, "      { \"ticker\": \"%s\","
                   " \"buy\": %.2f,"
                   " \"sell\": %.2f,"
                   " \"net_flow\": %.2f }%s\n",
                t->ticker, t->buy, t->sell, t->net_flow,
                last ? "" : ",");
    }

    fprintf(f, "    ]\n");
    fprintf(f, "  }\n");
    fprintf(f, "}\n");
    fclose(f);
}

/* ── Entry Point ─────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    /* Parse CLI: [num_workers] [file_path] */
    int         num_workers = platform_cpu_count();
    const char *file_path   = "data/stocks.csv";

    if (argc >= 2) num_workers = atoi(argv[1]);
    if (argc >= 3) file_path   = argv[2];
    if (num_workers < 1) num_workers = 1;

    /* ── Header ─────────────────────────────────────────────── */
    printf("\n");
    printf("╔══════════════════════════════════════════════════════╗\n");
    printf("║     Parallel Financial Data Aggregation — C         ║\n");
    printf("╠══════════════════════════════════════════════════════╣\n");
    printf("║  File    : %-42s║\n", file_path);
    printf("║  Workers : %-2d pthreads                               ║\n", num_workers);
    printf("║  Map     : Hash Table O(1) per row                  ║\n");
    printf("║  Reduce  : Binary Tree Sort-Merge  O(K · log W)     ║\n");
    printf("╚══════════════════════════════════════════════════════╝\n\n");

    /* ── 1. Sequential baseline ─────────────────────────────── */
    printf("[1/2] Sequential Aggregator...\n");
    StockSummary seq;
    double t0       = now_s();
    sequential_aggregate(file_path, &seq);
    double seq_time = now_s() - t0;
    printf("      Done  →  %.4f s\n\n", seq_time);

    /* ── 2. Parallel engine ─────────────────────────────────── */
    printf("[2/2] Parallel Aggregator  (%d workers, tree-reduce)...\n",
           num_workers);
    StockSummary par;
    double t1       = now_s();
    parallel_aggregate(file_path, num_workers, &par);
    double par_time = now_s() - t1;
    printf("      Done  →  %.4f s\n\n", par_time);

    /* ── 3. Correctness check ───────────────────────────────── */
    /* Per-ticker buy accuracy */
    int accuracy = 1;
    for (int i = 0; i < seq.ticker_count && accuracy; i++) {
        /* Find matching ticker in par result */
        for (int j = 0; j < par.ticker_count; j++) {
            if (strncmp(seq.ticker_breakdown[i].ticker,
                        par.ticker_breakdown[j].ticker, TICKER_LEN) == 0) {
                if (fabs(seq.ticker_breakdown[i].buy -
                         par.ticker_breakdown[j].buy) > 0.01) {
                    accuracy = 0;
                }
                break;
            }
        }
    }
    /* Global buy total as final sanity check */
    if (fabs(seq.total_buy - par.total_buy) > 0.01) accuracy = 0;

    /* ── 4. Metrics table ───────────────────────────────────── */
    double speedup = (par_time > 1e-9) ? (seq_time / par_time) : 0.0;

    printf("┌──────────────────────────────────────────────┐\n");
    printf("│  Sequential Time  : %10.4f s             │\n", seq_time);
    printf("│  Parallel Time    : %10.4f s             │\n", par_time);
    printf("│  Speedup Factor   : %10.2fx             │\n", speedup);
    printf("│  Accuracy Check   :  %-24s│\n",
           accuracy ? "PASS ✓  (|Δ| < 0.01)" : "FAIL ✗");
    printf("│  Workers Used     : %10d               │\n", num_workers);
    printf("└──────────────────────────────────────────────┘\n\n");

    /* ── 5. Ticker breakdown ────────────────────────────────── */
    printf("  Ticker Breakdown (parallel result):\n");
    printf("  %-8s  %14s  %14s  %14s\n",
           "Ticker", "Buy ($B)", "Sell ($B)", "Net Flow ($B)");
    printf("  %-8s  %14s  %14s  %14s\n",
           "──────", "────────", "─────────", "─────────────");
    for (int i = 0; i < par.ticker_count; i++) {
        const TickerEntry *t = &par.ticker_breakdown[i];
        printf("  %-8s  %14.4f  %14.4f  %14.4f\n",
               t->ticker,
               t->buy      / 1e9,
               t->sell     / 1e9,
               t->net_flow / 1e9);
    }
    printf("\n");

    /* ── 6. Write JSON for dashboard ────────────────────────── */
    platform_mkdir("dashboard");
    write_results_json("dashboard/results.json",
                       seq_time, par_time, speedup,
                       num_workers, accuracy, &par);
    printf("  Results written -> dashboard/results.json\n");
    printf("  Run: python3 -m http.server 8080 --directory dashboard\n\n");

    return accuracy ? 0 : 1;
}
