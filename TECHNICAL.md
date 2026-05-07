# TECHNICAL.md — Deep Dive: Algorithms, Complexity, and Code

This document is the internal reference for the PALL-FIN team. It covers every source file, every algorithm's time and space complexity, the design decisions behind each, and the correctness guarantees.

---

## Table of Contents

1. [Data Model](#1-data-model)
2. [src/platform.h — OS Compatibility Shims](#2-srcplatformh)
3. [src/ht.h + src/ht.c — Open-Addressing Hash Table](#3-srchth--srchtc)
4. [src/aggregator_core.h/c — StockSummary + Sequential Baseline](#4-srcaggregator_corehc)
5. [src/parallel_engine.h/c — The Parallel Pipeline](#5-srcparallel_enginehc)
6. [benchmark.c — Entry Point, Timing, Correctness](#6-benchmarkc)
7. [scaling_analysis.py — Amdahl's Law Analysis](#7-scaling_analysispy)
8. [src/data_generator.py — Synthetic Dataset](#8-srcdata_generatorpy)
9. [dashboard/ — Static Visualization](#9-dashboard)
10. [Full Complexity Summary](#10-full-complexity-summary)
11. [Correctness Guarantees](#11-correctness-guarantees)

---

## 1. Data Model

### CSV Schema

```
timestamp, ticker, price, type, volume, total_value
```

| Column | Type | Example |
|---|---|---|
| `timestamp` | ISO-8601 string | `2024-03-15T09:32:47` |
| `ticker` | String (≤15 chars) | `AAPL` |
| `price` | float | `182.50` |
| `type` | `Buy` or `Sell` | `Buy` |
| `volume` | int | `47` |
| `total_value` | float = price × volume | `8577.50` |

**What we aggregate:** `total_value` per ticker, split into buy and sell buckets.

### Key Structs

```c
// Per-ticker result (one entry in the hash table or sorted output)
typedef struct {
    char   ticker[16];   // symbol, NUL-terminated
    double buy;          // sum of total_value for Buy rows
    double sell;         // sum of total_value for Sell rows
    double net_flow;     // buy - sell
} TickerEntry;

// Final output container
typedef struct {
    double      total_buy;              // global buy total
    double      total_sell;             // global sell total
    double      net_flow;               // total_buy - total_sell
    TickerEntry ticker_breakdown[64];   // sorted by ticker name
    int         ticker_count;
} StockSummary;
```

---

## 2. src/platform.h

### Purpose

A thin compile-time shim that isolates every OS-specific call. Algorithm files include only this header — they never use `#ifdef _WIN32` directly.

### Shims provided

| Function | macOS / Linux | Windows (MinGW-w64) |
|---|---|---|
| `platform_cpu_count()` | `sysconf(_SC_NPROCESSORS_ONLN)` | `GetSystemInfo().dwNumberOfProcessors` |
| `platform_time_s()` | `clock_gettime(CLOCK_MONOTONIC)` | `QueryPerformanceCounter` |
| `platform_mkdir(path)` | `mkdir(path, 0755)` | `_mkdir(path)` |

**Time complexity:** O(1) for all three — these are single system calls.

**Why not use C11 `timespec_get`?**
`timespec_get` with `TIME_UTC` measures wall-clock from epoch, not monotonic time. Two consecutive calls can go backwards if the system clock is adjusted (NTP, daylight saving). `CLOCK_MONOTONIC` is guaranteed never to go backwards, which is mandatory for benchmarking.

---

## 3. src/ht.h + src/ht.c

### Purpose

The per-worker Map phase data structure. Each of the W worker threads owns one `HashTable`. During parsing, every CSV row calls `ht_update()` to accumulate `total_value` into the matching ticker's buy or sell bucket.

### Structure

```c
#define TABLE_SIZE 64    // power of two — enables bitwise AND instead of modulo

typedef struct {
    char   key[16];      // ticker symbol; empty string = unused slot
    double buy;
    double sell;
} HtSlot;

typedef struct {
    HtSlot slots[TABLE_SIZE];
    int    count;        // number of distinct tickers inserted
} HashTable;
```

Stack-allocated inside each worker's `WorkerArgs` struct — zero heap allocation for the Map phase itself.

### Hash Function — djb2 variant

```c
unsigned long h = 5381;
for (const char *p = key; *p; p++)
    h = ((h << 5) + h) ^ (unsigned char)*p;
int idx = (int)(h & (TABLE_SIZE - 1));  // bitwise AND replaces % TABLE_SIZE
```

**Why djb2?**
- Non-cryptographic, extremely fast (one shift + add + XOR per character)
- Excellent distribution for short alphanumeric strings (ticker symbols)
- The `& (TABLE_SIZE - 1)` trick works only because `TABLE_SIZE` is a power of two — it replaces a slow integer modulo with a single bitwise AND

### Collision Resolution — Linear Probing

```c
for (int i = 0; i < TABLE_SIZE; i++) {
    HtSlot *s = &ht->slots[idx];
    if (s->key[0] == '\0') { /* insert */ }
    if (strncmp(s->key, key, 16) == 0) { /* update */ }
    idx = (idx + 1) & (TABLE_SIZE - 1);   // wrap-around
}
```

**Why linear probing over chaining?**
Linear probing is cache-friendly — probing steps are sequential memory accesses. Chaining would require pointer dereferences (heap indirection) for each collision, destroying cache locality. For K ≤ 20 tickers in a TABLE_SIZE = 64 slot array, load factor ≤ 0.31, so collisions are rare.

### ht_update — Complexity

| Case | Time |
|---|---|
| Average (no collision) | O(1) |
| Worst (all keys hash same slot) | O(K) |
| **Amortised with load factor ≤ 0.5** | **O(1)** |

Space: O(1) — table is fixed size, stack-allocated.

### ht_to_sorted_array — Complexity

```c
// 1. Linear scan of all TABLE_SIZE slots — O(TABLE_SIZE) = O(1) since TABLE_SIZE is const
for (int i = 0; i < TABLE_SIZE; i++)
    if (ht->slots[i].key[0] != '\0') copy to out[];

// 2. qsort by ticker name
qsort(out, n, sizeof(TickerEntry), ticker_cmp);
```

| Step | Time | Space |
|---|---|---|
| Slot scan | O(TABLE_SIZE) = O(1) | O(1) |
| qsort | O(K log K) | O(log K) stack |
| **Total** | **O(K log K)** | **O(K)** |

K ≤ 20 in practice, so this is effectively constant. Called once per worker at the end of the Map phase.

---

## 4. src/aggregator_core.h/c

### summary_init

```c
void summary_init(StockSummary *s) { memset(s, 0, sizeof(StockSummary)); }
```
**Time:** O(1) — `sizeof(StockSummary)` is a compile-time constant.

---

### sorted_merge — The Reduce Phase Core Operation

This is the most algorithmically important function. It merges `src`'s sorted `TickerEntry[]` into `dst`'s sorted `TickerEntry[]`.

**Algorithm:** Two-pointer linear merge — identical in structure to the merge step in Merge Sort.

```
i → scans dst->ticker_breakdown[]  (sorted by ticker name)
j → scans src->ticker_breakdown[]  (sorted by ticker name)

While both arrays have entries:
  cmp = strcmp(dst[i].ticker, src[j].ticker)

  if cmp == 0:  same ticker → accumulate buy/sell into merged[]
                advance both i and j
  if cmp <  0:  dst ticker sorts first → copy dst[i] to merged[]
                advance i
  if cmp >  0:  src ticker sorts first → copy src[j] to merged[]
                advance j

Drain remaining from whichever array is not exhausted.
Copy merged[] back into dst.
Update dst->total_buy, total_sell, net_flow.
```

**Why this works:** Both input arrays are guaranteed sorted because `ht_to_sorted_array()` calls `qsort()` before returning. This invariant is preserved by `sorted_merge()` — the output is also sorted. This is the same pre-condition / post-condition contract as the merge step in Merge Sort.

**Complexity:**

| | Value |
|---|---|
| Time | O(K_dst + K_src) ≤ O(2K) = O(K) |
| Space | O(K) for the `merged[]` temporary array |
| In-place? | No — requires one O(K) temporary |

At each level of the binary tree, there are W/2^level active merges each costing O(K). Over ceil(log₂W) levels, total reduce work = O(K · log W).

---

### sequential_aggregate — The Correctness Baseline

Single-threaded reference implementation. Uses the same `HashTable` + `ht_to_sorted_array()` pipeline as parallel workers to ensure arithmetic is identical.

```
fopen → skip header → loop fgets:
  strtok_r parse → ht_update() → accumulate total_buy/total_sell
fclose → ht_to_sorted_array() → write into StockSummary
```

**Why use the same hash table as parallel workers?**
If the sequential baseline used a different algorithm (e.g., linear scan array), floating-point rounding differences between the two algorithms could cause spurious "accuracy check FAIL" even when both results are correct. Using the same accumulation order within each ticker slot avoids this.

**Complexity:**

| | Value |
|---|---|
| Time | O(N) — one pass through all N rows |
| Space | O(K) — one hash table |

This is the `T_sequential` used in `speedup = T_sequential / T_parallel`.

---

## 5. src/parallel_engine.h/c

The three-phase parallel pipeline. This is the algorithmic centrepiece of the project.

---

### PHASE 1: DIVIDE — partition_data()

```c
fseek(f, 0, SEEK_END);
long file_size = ftell(f);
long chunk = file_size / n;
for (int i = 0; i < n; i++) {
    args[i].byte_start = i * chunk;
    args[i].byte_end   = (i < n-1) ? (i+1)*chunk : file_size;
}
```

**Time:** O(1) — one `fseek` + `ftell`, then arithmetic.
**Space:** O(W) — one `(byte_start, byte_end)` pair per worker.

**The boundary problem and its fix:**
A byte range boundary may fall in the middle of a CSV record. If worker 1 starts at byte 1000 and the record `2024-01-01,AAPL,...` begins at byte 998, worker 1 would start parsing from `L,...` — corrupt data.

Fix: **every worker unconditionally skips its first line via `fgets()`**:
- Worker 0 → skips the CSV header row (correct)
- Workers 1..N-1 → skip the partial record at the boundary (correct)

This works because the worker whose previous range _owns_ that record reads past `byte_end` by one extra line (see the `fgets(extra, ...)` call after `fread`), so the record is counted exactly once.

---

### PHASE 2: MAP — worker_map()

Called as a `pthread` entry point. Each worker independently:

```
fopen → fseek(byte_start) → fgets (skip first line)
fread(chunk) into heap buffer
fgets one extra line past byte_end   ← prevents split-record loss
Parse buffer with strchr + strtok_r
  → ht_update() for each row         ← O(1) per row
free(buf)
ht_to_sorted_array()                 ← O(K log K)
Write result into args[worker_id].result
return
```

**No mutex needed.** Each worker writes only to its own `args[i].result`. The main thread reads these only after `pthread_join()`.

**Complexity per worker:**

| Step | Time | Space |
|---|---|---|
| fread chunk | O(N/W) I/O | O(N/W) heap buffer |
| strtok_r parse | O(N/W) | O(1) |
| ht_update per row | O(1) amortised | O(K) hash table |
| ht_to_sorted_array | O(K log K) | O(K) |
| **Total per worker** | **O(N/W)** | **O(N/W + K)** |

All W workers run concurrently → wall-clock Map time = **O(N/W)**.

**Synchronisation:** `pthread_join()` loop on the main thread. No barrier needed (`pthread_barrier_t` is not available on macOS/Darwin). The join guarantees a happens-before edge between every worker's `return NULL` and the main thread's reduce phase.

---

### PHASE 3: REDUCE — parallel_tree_reduce()

```c
StockSummary scratch[W];   // copy of all partial results
int active = W;

while (active > 1) {
    for (int i = 0; i+1 < active; i += 2)
        sorted_merge(&scratch[i], &scratch[i+1]);  // O(K)

    // Compact winners (even indices only)
    int next = 0;
    for (int i = 0; i < active; i += 2)
        scratch[next++] = scratch[i];
    active = next;
}
*out = scratch[0];
```

**How the tree works (example W=8):**

```
Level 0 (input):  [W0] [W1] [W2] [W3] [W4] [W5] [W6] [W7]
Level 1 (merge):  [W0+W1]   [W2+W3]   [W4+W5]   [W6+W7]     ← 4 merges
Level 2 (merge):  [W0+W1+W2+W3]       [W4+W5+W6+W7]         ← 2 merges
Level 3 (merge):  [Global Result]                             ← 1 merge
```

Total merges: W − 1 = 7. Total levels: log₂(8) = 3. Each merge costs O(K).

**Complexity:**

| | Value |
|---|---|
| Levels | ceil(log₂W) |
| Merges per level | W / 2^level |
| Cost per merge | O(K) |
| **Total time** | **O(K · log W)** |
| Space | O(K · W) — scratch array |

**Why not a linear reduce?**

A linear reduce `for(i=1; i<W; i++) merge(result, workers[i])` takes O(K · W) time — every result is merged sequentially into a single accumulator. The binary tree reduces this to O(K · log W): for W=8, that's 7 merges either way (binary tree is optimal in merge count), but the tree structure **enables future parallelism** — at each level, all merges are independent and could run simultaneously on different threads. The current implementation runs the reduce on the main thread (because K is tiny), but the tree structure is the correct foundation for a fully parallel reduce.

---

## 6. benchmark.c

### Responsibilities

1. Parse CLI args: `./financial_agg [W] [file.csv]`
2. Time `sequential_aggregate()` → `T_seq`
3. Time `parallel_aggregate()` → `T_par`
4. Per-ticker correctness check: for each ticker in seq result, find it in par result, assert `|seq.buy − par.buy| < 0.01`
5. Global check: `|seq.total_buy − par.total_buy| < 0.01`
6. Compute `speedup = T_seq / T_par`
7. Print formatted terminal table
8. Write `dashboard/results.json`

### Why epsilon = 0.01?

Floating-point addition is not associative. Two threads processing different subsets of rows for the same ticker will accumulate `total_value` in different orders, producing slightly different IEEE 754 double results due to rounding. For 5M rows with values in the range [1, 10000], the maximum accumulated floating-point error is well below 0.01. An exact equality check (`== 0.0`) would produce false failures.

### Timing

Uses `platform_time_s()` which calls `CLOCK_MONOTONIC` on POSIX systems and `QueryPerformanceCounter` on Windows. Both are sub-microsecond resolution, monotonically increasing, and unaffected by NTP or wall-clock adjustments.

---

## 7. scaling_analysis.py

### Algorithm

```
for W in [1, 2, 4, 8, 16]:
    run ./financial_agg W data/stocks.csv
    parse stdout for T_sequential and T_parallel
    compute speedup = T_sequential / T_parallel

Estimate Amdahl p from W=max measurement:
    S(W) = 1 / ((1-p) + p/W)
  → p = (1/S - 1) / (1/W - 1)

Write dashboard/scaling_results.json
```

### Amdahl's Law

**Amdahl's Law:** `S(W) = 1 / ((1−p) + p/W)`

- `p` = parallel fraction (fraction of workload that can be parallelised)
- `(1−p)` = serial fraction (irreducible: file open, divide, JSON write)
- As W → ∞, `S(W) → 1/(1−p)` — the absolute speedup ceiling

**Example:** If p = 0.85 (85% parallel):
- Maximum possible speedup = 1 / (1 − 0.85) = **6.67×**, regardless of core count
- At W = 8: S(8) = 1 / (0.15 + 0.85/8) = **3.9×**

This explains why the measured speedup plateaus even as thread count increases.

**Output JSON schema:**
```json
{
  "amdahl_p": 0.85,
  "parallel_fraction": 85.0,
  "crossover_workers": 2,
  "measured": [
    { "workers": 1, "seq_time": 0.63, "par_time": 0.63, "speedup": 1.0 },
    ...
  ],
  "theoretical_amdahl": [
    { "workers": 1, "speedup": 1.0 },
    ...
  ]
}
```

---

## 8. src/data_generator.py

Uses `yfinance` to fetch real ticker symbols and open prices, then generates synthetic trade records with controlled randomness:

```python
price = base_price + np.random.normal(0, base_price * 0.02)   # 2% volatility
type  = 'Buy' if random() > 0.5 else 'Sell'
volume = randint(1, 100)
total_value = price * volume
```

**Output:** `data/stocks.csv` — ~200 MB for 5M records, 8 tickers.
**Run:** `make gen` (once, before first benchmark).
**Gitignored:** The CSV is not committed. Only the generator is.

---

## 9. dashboard/

### Architecture

Zero-dependency static HTML — no npm, no build step, no server required for the HTML itself. Requires a local HTTP server only because browsers block `fetch()` from `file://` URLs by default.

```bash
make serve      # runs: python3 -m http.server 8080 --directory dashboard
```

### Charts (Chart.js v4, CDN)

| Chart | Data source | Type |
|---|---|---|
| Speedup vs Thread Count | `scaling_results.json` | Line (measured + Amdahl ceiling) |
| Market Distribution | `results.json` | Doughnut |
| Buy vs Sell Volume | `results.json` | Grouped bar |

### JSON fetching

`main.js` calls `Promise.all([fetch("results.json"), fetch("scaling_results.json")])`. If either file is missing (i.e., `make run` hasn't been run yet), the dashboard shows placeholder charts and a status message — it never throws an unhandled error.

---

## 10. Full Complexity Summary

### Time Complexity

| Component | Sequential | Parallel | Parallelism |
|---|---|---|---|
| Divide | O(1) | O(1) | — |
| Map | O(N) | O(N/W) wall-clock | W× |
| Sort (per worker dump) | O(K log K) | O(K log K) wall-clock | Fully parallel |
| Reduce | O(K · W) linear | O(K · log W) tree | log W improvement |
| JSON write | O(K) | O(K) | — |
| **Total** | **O(N)** | **O(N/W + K·log W)** | **~W×** |

### Space Complexity

| Component | Space | Notes |
|---|---|---|
| Hash table per worker | O(K) | Stack-allocated, TABLE_SIZE = 64 |
| Chunk buffer per worker | O(N/W) | Heap, freed after parse |
| Sorted array per worker | O(K) | Stack-allocated |
| Reduce scratch | O(K · W) | One StockSummary per worker |
| **Total** | **O(N/W + K·W)** | Dominated by chunk buffers |

For W = 8, N = 5M rows, K = 10: peak memory ≈ 8 × 25 MB = **200 MB** for chunk buffers. All other structures are negligible.

### Recurrence Relation

The Reduce phase has a natural recurrence:

```
T_reduce(W) = T_merge(K) + T_reduce(W/2)
T_reduce(1) = 0

Solving: T_reduce(W) = O(K) · log₂(W) = O(K log W)
```

This is the same recurrence as Merge Sort's merge phase: `T(n) = T(n/2) + O(n)`.

---

## 11. Correctness Guarantees

### Invariant 1 — No record is double-counted or lost

Proof sketch:
- Worker 0 skips the header row; its `byte_end` is `file_size/W`.
- Worker 0 reads `fread(chunk)` up to `byte_end`, then one extra `fgets()` past `byte_end`.
- Worker 1 seeks to `byte_start = file_size/W` and skips one line (the record that Worker 0 already read past `byte_end` to claim ownership of).
- By induction, every record is owned by exactly one worker.

### Invariant 2 — sorted_merge preserves sort order

Both input arrays to `sorted_merge` are sorted by ticker name (guaranteed by `qsort` in `ht_to_sorted_array`). The two-pointer merge produces a sorted output. By structural induction over the tree levels, the final result is also sorted.

### Invariant 3 — per-ticker totals are exact (up to floating-point)

`ht_update()` accumulates `double` values. The sequential and parallel engines use the same hash table implementation. The only source of divergence is addition-order variation across threads, bounded by IEEE 754 rounding. The epsilon check (`|Δ| < 0.01`) is calibrated to pass for any realistic dataset with `total_value` values in the range seen from synthetic data.

### Invariant 4 — net_flow = total_buy − total_sell

Enforced in three places: `worker_map()` after Map, `sorted_merge()` after each Reduce merge, and `sequential_aggregate()` at the end. The JSON output and dashboard display this derived value, not a separately accumulated one.
