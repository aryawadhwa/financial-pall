# c-engine — The Real Parallel Aggregation Backend

This directory contains the **actual C implementation** of the PALL-FIN parallel financial data aggregation algorithm. The web dashboard (`../src/`) is a visual simulation of what this engine does.

---

## Files

| File | Purpose |
|---|---|
| `src/parallel_engine.c / .h` | Core multi-threaded engine — spawns pthreads, handles boundary resolution, dispatches chunk parsing |
| `src/aggregator_core.c / .h` | Per-thread aggregation logic — reads CSV lines, calls the hash table |
| `src/ht.c / .h` | 64-slot open-addressed hash table with djb2 hashing and linear probing |
| `src/platform.h` | Cross-platform thread/timing macros (pthreads on Linux/macOS, Win32 threads on Windows) |
| `src/data_generator.py` | Generates synthetic trade CSV files at arbitrary record counts |
| `benchmark.c` | Runs sequential vs parallel benchmarks across 1/2/4/8/12/16 threads |
| `scaling_analysis.py` | Post-processes benchmark output → produces `results.json` and `scaling_results.json` used by the dashboard |
| `Makefile` | Build system |
| `TECHNICAL.md` | Full technical design document (algorithm details, Section references) |

---

## How to Build & Run

### Prerequisites
- GCC or Clang
- pthreads (standard on Linux/macOS)
- Python 3 (for data generation and analysis)

### Build
```bash
cd c-engine
make              # builds the main binary
make benchmark    # builds the benchmark runner
```

### Generate Test Data
```bash
python3 src/data_generator.py --records 5000000 --output data/stocks.csv
```

### Run the Engine
```bash
./pall-fin data/stocks.csv 8    # process with 8 threads
```

### Run Benchmarks
```bash
make run-benchmark              # runs across all thread counts
python3 scaling_analysis.py     # generates JSON for the dashboard
```

---

## Algorithm Summary

```
Raw CSV File (200MB)
        │
        ▼  [ Divide & Conquer: O(1) boundary resolution per thread ]
┌──────────────────────────────────────────────┐
│  Thread 0   Thread 1   Thread 2  ...  Thread K│
│  (N/K recs) (N/K recs) (N/K recs)    (N/K)   │
│      │           │           │                │
│  djb2 Hash   djb2 Hash  djb2 Hash             │
│  64-slot HT  64-slot HT  64-slot HT           │
│  qsort       qsort       qsort                │
└──────────────────────────────────────────────┘
        │
        ▼  [ Tournament Binary Merge: O(K log K) ]
   Final Sorted Aggregate (buy/sell/net per ticker)
```

**Complexity:**
- Sequential: `O(N)`
- Parallel: `O(N/K + K log K)`
- Space: `O(K × U)` — U = unique tickers

---

## Output Format

The engine outputs JSON that feeds directly into the web dashboard:

```json
{
  "metrics": { "threads": 8, "seq_time": 0.6165, "par_time": 0.1471, "speedup": 4.19 },
  "summary": {
    "total_buy": ...,
    "total_sell": ...,
    "net_flow": ...,
    "ticker_breakdown": { "AAPL": 1823400, "TSLA": 2041200, ... }
  }
}
```

> **Note:** Large CSV data files (`data/*.csv`) are excluded from git due to size. Use `data_generator.py` to regenerate them.
