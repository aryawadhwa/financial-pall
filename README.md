# Parallel Financial Data Aggregation System — C Implementation

A high-performance **MapReduce-style financial data processor** written in C, using **POSIX threads** and a **Binary Tree Reduction** algorithm. Processes 5M+ stock transaction records efficiently with full correctness verification.

## Architecture

```
data/stocks.csv  (234 MB, 5M records)
        │
        ▼
┌────────────────────────────────────────────┐
│           DIVIDE (O(1) memory)             │
│  Byte-range partitioning — no full load    │
│  8 balanced chunks via byte offsets        │
└─────────────────┬──────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │    MAP (pthreads)   │
        │  W0  W1  W2  W3    │  ← 8 pthreads
        │  W4  W5  W6  W7    │    each owns its chunk
        └─────────┬──────────┘
                  │
        ┌─────────▼──────────┐
        │  REDUCE (O(log N)) │
        │  [W0+W1] [W2+W3]   │  Level 1
        │  [W4+W5] [W6+W7]   │
        │  [L1a+L1b][L1c+L1d]│  Level 2
        │      [Global]       │  Level 3
        └─────────────────────┘
```

## Key Files

| File | Role |
|---|---|
| `src/aggregator_core.h/c` | `StockSummary` struct, `summary_merge()`, sequential baseline |
| `src/parallel_engine.h/c` | pthreads workers, byte-range partitioning, tree reduce |
| `benchmark.c` | Main entry: timing, accuracy check, JSON export |
| `Makefile` | Build system |
| `src/data_generator.py` | Synthetic data generator (Python/yfinance, run once) |
| `dashboard/` | Dark-mode analytics UI (Vite + Chart.js) |
| `archive/` | Original Python implementation (reference) |

## Build & Run

```bash
# Compile (requires cc + pthreads)
make

# Run benchmark on data/stocks.csv
make run

# Regenerate 5M record dataset (requires Python + yfinance)
make gen
```

## Performance (5M records, 8 cores, Apple Silicon)

| Metric | Value |
|---|---|
| Sequential Time | ~0.63 s |
| Parallel Time | ~0.58 s |
| Speedup | ~1.1x (I/O bound at 5M) |
| Accuracy | PASS (|Δtotal_buy| < 0.01) |

> **Note:** At 5M records, I/O dominates and the crossover hasn't been reached yet.
> True parallelism wins at ~50–100M records where CPU computation overtakes disk read overhead.
> C alone is **~2x faster** than the previous Python implementation at the same record count.

## Algorithm Complexity

| Phase | Complexity |
|---|---|
| Divide (byte partition) | O(1) |
| Map (per worker) | O(N/W) |
| Tree Reduce | O(W · log W) |
| **Total** | **O(N/W + log W)** |

## Dashboard

```bash
cd dashboard
npm run dev
# Open the local URL — charts load from dashboard/results.json
```

## Repository

`https://github.com/aryawadhwa/financial-pall`
