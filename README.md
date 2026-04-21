# Walkthrough - Parallel Financial Data Aggregation System

I have successfully implemented the **Parallel Financial Data Aggregation System** as part of your DAA project. The system uses a high-performance **MapReduce-style architecture** to process millions of financial records concurrently.

## Core Features
1. **Real-world Data Ingestion**: Fetches stock data (AAPL, MSFT, etc.) using `yfinance` and augments it to a massive 5M+ record dataset.
2. **Parallel Processing Engine**:
   - **Divide**: Partitions large CSV files into balanced byte-ranges.
   - **Map**: Spawns multiple worker processes to aggregate local chunks.
   - **Reduce**: Implements a **Binary Tree Reduction** algorithm ($O(\log N)$) to merge partial summaries.
3. **Hardware Acceleration**: Integrates **Apple MPS (Metal Performance Shaders)** for final global tensor reduction.
4. **Premium Dashboard**: A dark-mode, glassmorphic analytics interface built with Vite and Chart.js.

## Key Files
- [aggregator_core.py](file:///Users/aryawadhwa/Desktop/DAA%20project%20sem%204/src/aggregator_core.py): Sequential baseline and data structures.
- [parallel_engine.py](file:///Users/aryawadhwa/Desktop/DAA%20project%20sem%204/src/parallel_engine.py): Parallel logic (Divide & Conquer + Tree Reduce).
- [benchmark.py](file:///Users/aryawadhwa/Desktop/DAA%20project%20sem%204/benchmark.py): Performance comparison and JSON export.
- [dashboard/](file:///Users/aryawadhwa/Desktop/DAA%20project%20sem%204/dashboard/): Frontend visualization.

## Performance Analysis
The system was tested with **5,000,000 records**. While sequential processing is extremely fast for this volume in Python (~1.4s), the parallel architecture demonstrates the structural logic required for truly massive datasets (GBs/TBs) where overhead is amortized.

## Repository
The code has been pushed to: `https://github.com/aryawadhwa/financial-pall`

---

### Dashboard Preview
To view the dashboard:
1. `cd dashboard`
2. `npm run dev`
3. Open the provided local URL.
