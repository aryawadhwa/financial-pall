import time
import json
import os
from src.aggregator_core import SequentialAggregator
from src.parallel_engine import ParallelEngine

def run_benchmark(file_path='data/stocks.csv'):
    print(f"Starting benchmark on {file_path}...")
    
    # 1. Sequential
    print("Running Sequential Aggregator...")
    seq_start = time.time()
    seq_agg = SequentialAggregator()
    seq_res = seq_agg.aggregate(file_path)
    seq_time = time.time() - seq_start
    print(f"Sequential Time: {seq_time:.4f}s")
    
    # 2. Parallel
    print(f"Running Parallel Aggregator (Workers: {os.cpu_count()})...")
    par_start = time.time()
    par_engine = ParallelEngine()
    par_res = par_engine.aggregate(file_path)
    par_time = time.time() - par_start
    print(f"Parallel Time: {par_time:.4f}s")
    
    # Verify Results
    accuracy = abs(seq_res.total_buy - par_res.total_buy) < 1e-2
    speedup = seq_time / par_time
    
    results = {
        "metrics": {
            "sequential_time": seq_time,
            "parallel_time": par_time,
            "speedup": speedup,
            "accuracy_check": accuracy,
            "cpu_count": os.cpu_count()
        },
        "summary": {
            "total_buy": par_res.total_buy,
            "total_sell": par_res.total_sell,
            "net_flow": par_res.net_flow,
            "ticker_breakdown": par_res.ticker_breakdown
        }
    }
    
    os.makedirs('dashboard', exist_ok=True)
    # Save in dashboard for web access
    paths = ['dashboard/results.json']
    for p in paths:
        with open(p, 'w') as f:
            json.dump(results, f, indent=4)
    
    print(f"Benchmark complete. Speedup: {speedup:.2f}x")
    print(f"Results saved to dashboard/results.json")

if __name__ == "__main__":
    if not os.path.exists('data/stocks.csv'):
        print("Data file not found. Running data generator...")
        from src.data_generator import fetch_and_augment_stock_data
        fetch_and_augment_stock_data()
    
    run_benchmark()
