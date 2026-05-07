#ifndef PARALLEL_ENGINE_H
#define PARALLEL_ENGINE_H

/* ─────────────────────────────────────────────────────────────
 * parallel_engine.h
 *
 * Three-phase parallel MapReduce pipeline:
 *
 *   DIVIDE  partition_data()
 *     Split file into W byte ranges. O(1) — no file load.
 *     Each thread gets [byte_start, byte_end).
 *
 *   MAP     worker_map()  (one pthread per partition)
 *     1. Seek to byte_start, skip first line (header or partial record)
 *     2. Parse rows with strtok_r, call ht_update() — O(1) per row
 *     3. Dump hash table → sorted TickerEntry[] via ht_to_sorted_array()
 *
 *   REDUCE  parallel_tree_reduce()  (O(log W) depth)
 *     Binary tree collapse: each level halves active workers.
 *     sorted_merge() at each node — O(K) linear two-pointer merge.
 *
 * Synchronisation:
 *   pthread_join() on the main thread ensures all Map phases complete
 *   before Reduce begins. No pthread_barrier_t needed
 *   (and none used — macOS does not implement POSIX barriers).
 *
 * Public API:
 *   void parallel_aggregate(file_path, num_workers, out)
 * ───────────────────────────────────────────────────────────── */

#include "aggregator_core.h"
#include <pthread.h>

/* Arguments passed to each worker thread */
typedef struct {
    const char   *file_path;   /* shared read-only                */
    long          byte_start;  /* inclusive byte offset           */
    long          byte_end;    /* exclusive byte offset           */
    int           worker_id;   /* 0-based, for diagnostics        */
    StockSummary  result;      /* written by worker, read by main */
} WorkerArgs;

/* ── Public API ─────────────────────────────────────────────── */

/*
 * parallel_aggregate
 *   Runs the full DIVIDE → MAP → REDUCE pipeline.
 *   Writes the global merged result into *out.
 *   num_workers must be >= 1.
 */
void parallel_aggregate(const char *file_path, int num_workers,
                        StockSummary *out);

#endif /* PARALLEL_ENGINE_H */
