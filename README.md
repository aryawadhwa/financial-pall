# PALL-FIN — Parallel Financial Data Aggregation System

A high-performance **MapReduce-style financial trade aggregator** written in C using POSIX threads. Processes millions of stock transaction records by dividing work across CPU cores, aggregating per-ticker buy/sell volumes in parallel, and merging results with a binary tree reduction.

Built as a DAA (Design and Analysis of Algorithms) semester project to demonstrate Divide & Conquer, parallel algorithm design, and empirical complexity analysis through a real-world financial computing problem.

---

## Why This Project Exists

Financial data aggregation — summing buy/sell volumes across millions of trade records by ticker symbol — is a canonical "embarrassingly parallel" problem. Each record belongs to exactly one ticker and can be processed independently, making it a perfect vehicle to demonstrate:

- **Divide & Conquer** as a parallel paradigm, not just a recursive one
- The difference between sequential `O(N)` and parallel `O(N/W)` time
- Why a naive parallel design (linear reduce) is theoretically worse than a tree reduce
- **Amdahl's Law** — why doubling cores never doubles speed, and how to measure the serial bottleneck

The system intentionally mirrors the architecture of production MapReduce engines (Apache Spark, DuckDB) at a scale that fits on a single laptop.

---

## Architecture

```
data/stocks.csv  (200 MB, 5M records)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  DIVIDE  —  O(1)                                        │
│  Compute W byte-range offsets. No file load.            │
│  Each thread gets [byte_start, byte_end).               │
└──────────────────┬──────────────────────────────────────┘
                   │
       ┌───────────▼────────────┐
       │   MAP  —  O(N/W)       │   W pthreads run concurrently
       │  W0  W1  W2  W3  ...  │   Each thread:
       │                        │     1. fread its byte chunk
       │  Per thread:           │     2. strtok_r parse each row
       │  HashTable (djb2)      │     3. ht_update() — O(1)/row
       │  Dump → sorted array   │     4. dump to sorted TickerEntry[]
       └───────────┬────────────┘
                   │  pthread_join() — synchronisation point
       ┌───────────▼────────────┐
       │  REDUCE  —  O(K·logW)  │   Binary tree collapse
       │  [W0+W1] [W2+W3] ...   │   sorted_merge() at each node
       │  [L1a + L1b]   ...     │   O(K) linear two-pointer merge
       │      [Global]           │   log₂(W) levels total
       └───────────┬────────────┘
                   │
        dashboard/results.json   →   Static HTML Dashboard
```

### Algorithm Complexity

| Phase | Algorithm | Time | Space |
|---|---|---|---|
| Divide | Byte-range arithmetic | O(1) | O(W) |
| Map (per worker) | djb2 hash table insert | O(N/W) | O(K) per worker |
| Dump + Sort (per worker) | qsort on K entries | O(K log K) | O(K) |
| Reduce | Binary tree sort-merge | O(K · log W) | O(K · W) |
| **Total Parallel** | — | **O(N/W)** | O(K · W) |
| **Total Sequential** | — | **O(N)** | O(K) |

K = number of unique tickers (≤ 64, treated as a constant)
W = number of worker threads

Speedup (Amdahl's Law): `S(W) = 1 / ( (1−p) + p/W )`
where `p` is the parallel fraction of the workload.

---

## Repository Structure

```
PALL-FIN/
├── benchmark.c              ← Main entry point
├── Makefile                 ← Cross-platform build (macOS, Linux, Windows/MinGW)
├── scaling_analysis.py      ← Amdahl's Law analysis script
│
├── src/
│   ├── platform.h           ← OS shims (timing, CPU count, mkdir)
│   ├── ht.h + ht.c          ← Open-addressing hash table (Map phase)
│   ├── aggregator_core.h/c  ← StockSummary struct, sequential baseline, sorted_merge
│   ├── parallel_engine.h/c  ← Full parallel pipeline (divide → map → reduce)
│   └── data_generator.py    ← Synthetic dataset generator (run once)
│
├── dashboard/
│   ├── index.html           ← Static dashboard (no npm, no build step)
│   ├── main.js              ← Chart.js charts: speedup curve, donut, bar
│   └── style.css            ← Dark-mode glassmorphism UI
│
├── README.md                ← This file
└── TECHNICAL.md             ← Full algorithm and code deep-dive
```

---

## How to Build and Run

### Prerequisites

| Platform | Requirement |
|---|---|
| macOS | Xcode Command Line Tools: `xcode-select --install` |
| Linux | `gcc`, `make`, `python3` |
| Windows | [MSYS2](https://www.msys2.org/) → MinGW-w64: `pacman -S mingw-w64-x86_64-gcc make` |

### Quick Start

```bash
# 1. Generate the dataset (run once — creates data/stocks.csv, ~200 MB)
make gen

# 2. Build + run the benchmark (auto-detects CPU cores)
make run

# 3. Run with a specific thread count
make run W=4

# 4. Run Amdahl's Law scaling analysis (W = 1, 2, 4, 8, 16)
make bench

# 5. Open the dashboard in your browser
make serve
# Then open http://localhost:8080
```

### Expected Terminal Output

```
╔══════════════════════════════════════════════════════╗
║     Parallel Financial Data Aggregation — C         ║
╠══════════════════════════════════════════════════════╣
║  File    : data/stocks.csv                          ║
║  Workers : 8 pthreads                               ║
║  Map     : Hash Table O(1) per row                  ║
║  Reduce  : Binary Tree Sort-Merge  O(K · log W)     ║
╚══════════════════════════════════════════════════════╝

[1/2] Sequential Aggregator...
      Done  →  0.6300 s

[2/2] Parallel Aggregator  (8 workers, tree-reduce)...
      Done  →  0.1850 s

┌──────────────────────────────────────────────┐
│  Sequential Time  :     0.6300 s             │
│  Parallel Time    :     0.1850 s             │
│  Speedup Factor   :       3.41x             │
│  Accuracy Check   :  PASS ✓  (|Δ| < 0.01)   │
│  Workers Used     :          8               │
└──────────────────────────────────────────────┘
```

---

## Dashboard

After `make run` and `make bench`, open the dashboard with `make serve`.

Three live charts render from `dashboard/results.json` and `dashboard/scaling_results.json`:

- **Speedup vs Thread Count** — measured speedup overlaid with Amdahl's Law theoretical ceiling
- **Market Distribution** — donut chart of total trade value per ticker
- **Buy vs Sell Volume** — grouped bar chart per ticker

No npm. No build step. Pure HTML + CDN Chart.js.

---

## Performance Results (Reference — Apple M-series, 8 cores, 5M records)

| Workers (W) | Parallel Time | Speedup | Accuracy |
|---|---|---|---|
| 1 | ~0.63 s | 1.00× | PASS |
| 2 | ~0.38 s | 1.66× | PASS |
| 4 | ~0.22 s | 2.86× | PASS |
| 8 | ~0.18 s | 3.50× | PASS |
| 16 | ~0.17 s | 3.71× | PASS |

Speedup plateaus at ~3.5× because the workload at 5M records is **I/O bound** — threads spend significant time in `fread()` which serializes on the disk. True CPU-bound speedup (close to linear) appears at 50M+ records where compute dominates I/O.

The Amdahl serial fraction `p` estimated from these numbers: **~85%** (85% of the work is parallelisable).

---

## Project Status

### Completed
- [x] Open-addressing hash table Map phase — O(1) per-row lookup
- [x] Byte-range partitioning Divide phase — O(1), no full file load
- [x] Binary tree sort-merge Reduce phase — O(K·log W)
- [x] Sequential baseline with per-ticker correctness verification
- [x] CLI thread count (`./financial_agg W file.csv`)
- [x] Amdahl's Law scaling analysis (W = 1, 2, 4, 8, 16)
- [x] Cross-platform build (macOS, Linux, Windows/MinGW-w64)
- [x] Static HTML dashboard — speedup curve, donut chart, buy/sell bar chart

### Possible Extensions
- [ ] Memory-mapped I/O (`mmap`) instead of `fread` to remove disk serialization bottleneck
- [ ] True in-thread parallel reduce using `pthread_mutex` + multiple reduce rounds (instead of main-thread reduce)
- [ ] Support reading from multiple CSV files in one run
- [ ] CSV schema auto-detection (currently hardcoded column order)

---

## Team

Repository: [github.com/aryawadhwa/financial-pall](https://github.com/aryawadhwa/financial-pall)
