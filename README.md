# PALL-FIN — Parallel Financial Data Aggregation System

> Interactive dashboard and algorithmic visualizer for a high-throughput, multi-threaded financial trade aggregation engine targeting Indian (INR) market data.

---

## What This Is

PALL-FIN is a **visual proof-of-concept** for a parallel CSV trade-record aggregation engine written conceptually in C (with real benchmark data embedded), presented through a React/TypeScript interactive dashboard.

The core algorithm processes **5 million trade records (~200 MB CSV)** across multiple threads using:

1. **Boundary Resolution** — Each worker thread gets a raw byte-range slice of the file. Workers > 0 skip the first partial line; all workers except the last do a read-ahead past their endpoint to guarantee no record is dropped.

2. **Per-Thread djb2 Hash Table** — Each thread independently builds a 64-slot open-addressed hash table keyed by ticker symbol. Collisions are resolved with linear probing (`idx = (idx+1) & 63`).

3. **Tournament-Style Binary Merge** — Sorted per-thread arrays are reduced in `O(K log K)` passes using a pairwise merge tree (two-pointer merge), producing a single globally sorted & aggregated output.

4. **Amdahl's Law Modelling** — Speedup curves (theoretical vs measured) are computed live from actual profiling data, showing the asymptotic ceiling for the given serial fraction.

---

## Algorithm Complexity

| Algorithm | Time Complexity | Space | Bottleneck |
|---|---|---|---|
| Sequential | O(N) | O(U) unique tickers | CPU clock, I/O |
| **Parallel Hash + Merge** | **O(N/K + K log K)** | O(K × U) | Lock contention, RAM bandwidth |

---

## Live Demo: How to Show It Works

### 1. Run Locally

```bash
# Prerequisites: Node.js 18+
git clone https://github.com/aryawadhwa/financial-pall
cd financial-pall
npm install
cp .env.example .env   # add your GEMINI_API_KEY if needed
npm run dev            # opens at http://localhost:3000
```

### 2. Demonstrating the Algorithm (Step-by-Step)

| Step | What to do | What it proves |
|---|---|---|
| **1** | Open **Investment Analytics** tab | Shows real ticker data loaded from benchmark results |
| **2** | Set **Records = 5M**, **Cores = 1**, click **Run Aggregation** | Baseline: ~0.62s sequential time |
| **3** | Change **Cores to 8**, click **Run Aggregation** | Speedup jumps ~4–5×, parallel time drops significantly |
| **4** | Slide **Parallel Fraction (p)** slider | Watch the Amdahl asymptote ceiling change in real time |
| **5** | Open **Thread Memory** tab | See per-thread byte boundaries, hash table slot allocation, and linear probing collisions |
| **6** | Hover over hash table slots | Shows exact djb2 hash value, preferred slot, and probe count per ticker |
| **7** | Scroll to **Pairwise Reduction Merge** widget | Visualizes the binary tournament tree combining thread outputs |
| **8** | Return to dashboard → **Asymptotic Complexity Analysis** table | Confirms O(N/K + K log K) parallel vs O(N) sequential |
| **9** | Check **Execution Time vs Input Size** chart | Shows linear sequential growth vs flatter parallel curve |

---

## Project Structure

```
PALL-FIN/
├── src/
│   ├── simulationEngine.ts       # Core algorithm: djb2 hash, boundary split, merge tree, Amdahl
│   ├── types.ts                  # TypeScript interfaces
│   ├── App.tsx                   # Root layout, shared state
│   ├── components/
│   │   ├── Dashboard.tsx         # Investment analytics, Amdahl chart, metric cards
│   │   ├── ThreadSimulator.tsx   # Per-thread hash table + merge tree visualizer
│   │   └── DaaVisuals.tsx        # Complexity table + time-vs-size chart
│   └── data/
│       ├── results.json          # Real benchmark output (5M records, 8 threads)
│       └── scaling_results.json  # Amdahl parallel fraction from profiling
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Key Technical Facts

- **Dataset**: 5,000,000 synthetic trade records across 8 NSE/NYSE tickers (AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META, NFLX)
- **Hash function**: djb2 (`h = ((h << 5) + h) ^ c`) with 64-slot table and bitwise AND indexing
- **Merge**: Two-pointer sorted merge, O(n + m) per pair, O(K log K) total levels
- **Measured speedup at 8 cores**: ~4.2× (efficiency drop modelled as `1 - 0.012*(K-1)`)
- **Serial fraction (s)**: Derived from actual profiling; asymptote ceiling = `1/s`
- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion

---

## Environment Variables

```env
GEMINI_API_KEY=your_key_here   # Only needed if Gemini AI features are enabled
```

Copy `.env.example` to `.env` and fill in your key.

---

## Scripts

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production bundle
npm run lint     # TypeScript type check (tsc --noEmit)
npm run preview  # Preview production build
```