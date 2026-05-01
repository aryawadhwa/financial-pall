#ifndef PARALLEL_ENGINE_H
#define PARALLEL_ENGINE_H

/* ─────────────────────────────────────────────────────────────
 * parallel_engine.h
 * Parallel MapReduce engine using POSIX threads.
 *
 * Algorithm:
 *   1. DIVIDE  — byte-range partition (O(1) memory, no load)
 *   2. MAP     — N pthreads each process their chunk independently
 *   3. REDUCE  — Binary-tree pairwise merge (O(log N) depth)
 * ───────────────────────────────────────────────────────────── */

#include "aggregator_core.h"
#include <pthread.h>

/* Arguments passed to each worker thread — one per partition */
typedef struct {
    const char  *file_path;   /* shared read-only path           */
    long         byte_start;  /* inclusive byte offset           */
    long         byte_end;    /* exclusive byte offset           */
    int          worker_id;   /* 0-based index for diagnostics   */
    StockSummary result;      /* written by worker, read by main */
} ChunkArgs;

/* ── API ─────────────────────────────────────────────────────── */

/* Full parallel aggregate: divide → map (pthreads) → tree-reduce.
   Writes final merged summary into *out. */
void parallel_aggregate(const char *file_path, int num_workers, StockSummary *out);

#endif /* PARALLEL_ENGINE_H */
