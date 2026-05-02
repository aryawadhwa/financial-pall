#define _POSIX_C_SOURCE 200809L

/* ─────────────────────────────────────────────────────────────
 * benchmark.c
 * Main entry point for the Parallel Financial Data Aggregation System.
 *
 * Workflow:
 *   1. Run sequential_aggregate()  → record wall-clock time
 *   2. Run parallel_aggregate()    → record wall-clock time
 *   3. Verify accuracy (|seq.total_buy - par.total_buy| < 0.01)
 *   4. Compute speedup = seq_time / par_time
 *   5. Write dashboard/results.json  (same schema as Python version)
 *
 * Usage:
 *   ./financial_agg                     (defaults to data/stocks.csv)
 *   ./financial_agg path/to/file.csv
 * ───────────────────────────────────────────────────────────── */

#include "src/aggregator_core.h"
#include "src/parallel_engine.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <unistd.h>
#include <sys/stat.h>

/* Portable CPU count: sysconf works on macOS (Darwin ext) and Linux */
static int get_cpu_count(void) {
    long n = sysconf(_SC_NPROCESSORS_ONLN);
    return (n > 0) ? (int)n : 1;
}

/* ── Timing ────────────────────────────────────────────────── */

static double get_time_s(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + (double)ts.tv_nsec * 1e-9;
}

/* ── JSON Output ────────────────────────────────────────────── */

/*
 * Writes a results.json compatible with the existing dashboard.
 * Schema is identical to the Python json.dump() output so the
 * Chart.js frontend requires zero changes.
 */
static void write_results_json(
    const char         *path,
    double              seq_time,
    double              par_time,
    double              speedup,
    int                 accuracy,
    int                 cpu_count,
    const StockSummary *par)
{
    FILE *f = fopen(path, "w");
    if (!f) { perror("write_results_json: fopen"); return; }

    fprintf(f, "{\n");
    fprintf(f, "    \"metrics\": {\n");
    fprintf(f, "        \"sequential_time\": %.6f,\n",  seq_time);
    fprintf(f, "        \"parallel_time\": %.6f,\n",    par_time);
    fprintf(f, "        \"speedup\": %.6f,\n",          speedup);
    fprintf(f, "        \"accuracy_check\": %s,\n",     accuracy ? "true" : "false");
    fprintf(f, "        \"cpu_count\": %d\n",           cpu_count);
    fprintf(f, "    },\n");
    fprintf(f, "    \"summary\": {\n");
    fprintf(f, "        \"total_buy\": %.6f,\n",  par->total_buy);
    fprintf(f, "        \"total_sell\": %.6f,\n", par->total_sell);
    fprintf(f, "        \"net_flow\": %.6f,\n",   par->net_flow);
    fprintf(f, "        \"ticker_breakdown\": {\n");

    for (int i = 0; i < par->ticker_count; i++) {
        int last = (i == par->ticker_count - 1);
        fprintf(f, "            \"%s\": %.6f%s\n",
                par->ticker_breakdown[i].ticker,
                par->ticker_breakdown[i].volume,
                last ? "" : ",");
    }

    fprintf(f, "        }\n");
    fprintf(f, "    }\n");
    fprintf(f, "}\n");
    fclose(f);
}

/* ── Entry Point ────────────────────────────────────────────── */

int main(int argc, char *argv[]) {
    const char *file_path  = (argc > 1) ? argv[1] : "data/stocks.csv";
    int         num_workers = get_cpu_count();

    /* ── Header ─────────────────────────────────────────────── */
    printf("\n");
    printf("╔══════════════════════════════════════════════════════╗\n");
    printf("║   Parallel Financial Data Aggregation — C Engine    ║\n");
    printf("╚══════════════════════════════════════════════════════╝\n");
    printf("  File    : %s\n", file_path);
    printf("  Workers : %d pthreads\n", num_workers);
    printf("  Reduce  : Binary Tree  O(log N) depth\n\n");

    /* ── 1. Sequential baseline ─────────────────────────────── */
    printf("[1/2] Sequential Aggregator...\n");
    StockSummary seq_result;
    double t0       = get_time_s();
    sequential_aggregate(file_path, &seq_result);
    double seq_time = get_time_s() - t0;
    printf("      Done  →  %.4f s\n\n", seq_time);

    /* ── 2. Parallel engine ──────────────────────────────────── */
    printf("[2/2] Parallel Aggregator  (%d pthreads, tree-reduce)...\n", num_workers);
    StockSummary par_result;
    double t1       = get_time_s();
    parallel_aggregate(file_path, num_workers, &par_result);
    double par_time = get_time_s() - t1;
    printf("      Done  →  %.4f s\n\n", par_time);

    /* ── 3. Metrics ─────────────────────────────────────────── */
    double speedup = (par_time > 0.0) ? (seq_time / par_time) : 0.0;
    int    accuracy = fabs(seq_result.total_buy - par_result.total_buy) < 0.01;

    printf("┌──────────────────────────────────────┐\n");
    printf("│  Sequential Time  : %8.4f s       │\n", seq_time);
    printf("│  Parallel Time    : %8.4f s       │\n", par_time);
    printf("│  Speedup Factor   : %8.2fx       │\n", speedup);
    printf("│  Accuracy Check   :  %s          │\n", accuracy ? "PASS ✓" : "FAIL ✗");
    printf("│  CPU Cores Used   : %8d        │\n", num_workers);
    printf("└──────────────────────────────────────┘\n\n");

    /* ── 4. Ticker breakdown ─────────────────────────────────── */
    printf("  Ticker Breakdown (parallel result):\n");
    for (int i = 0; i < par_result.ticker_count; i++) {
        printf("    %-6s  $%.2fB\n",
               par_result.ticker_breakdown[i].ticker,
               par_result.ticker_breakdown[i].volume / 1e9);
    }
    printf("\n");

    /* ── 5. Write JSON for dashboard ────────────────────────── */
    /* Ensure dashboard/ directory exists */
    mkdir("dashboard", 0755);
    write_results_json("dashboard/results.json",
                       seq_time, par_time, speedup, accuracy,
                       num_workers, &par_result);
    printf("  Results  →  dashboard/results.json\n\n");

    return accuracy ? 0 : 1;
}
