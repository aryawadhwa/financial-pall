import os
import multiprocessing
import torch
import time
from typing import List, Tuple
from src.aggregator_core import StockSummary

from collections import defaultdict

def process_chunk(file_path: str, start: int, end: int, worker_id: int) -> StockSummary:
    summary = StockSummary()
    
    with open(file_path, 'rb') as f:
        f.seek(start)
        # Handle partial line at start
        if start != 0:
            f.readline()
        
        # Read the assigned chunk in one go (or in large blocks)
        # Since we are dividing a few hundred MBs into 8 workers, 
        # each worker gets ~30-50MB. We can read this comfortably.
        remaining = end - f.tell()
        if remaining <= 0: return summary
        
        chunk_data = f.read(remaining)
        # Ensure we read until the end of the last line
        extra = f.readline()
        if extra:
            chunk_data += extra
            
    # Process the data in memory
    lines = chunk_data.decode('utf-8').splitlines()

    # Local variables for faster inner loop lookup
    total_buy = 0.0
    total_sell = 0.0
    ticker_breakdown = defaultdict(float)

    for line in lines:
        parts = line.split(',')
        if len(parts) < 6: continue
        
        try:
            val = float(parts[5])
            if parts[3] == 'Buy':
                total_buy += val
            else:
                total_sell += val
            ticker_breakdown[parts[1]] += val
        except ValueError:
            pass
            
    summary.total_buy = total_buy
    summary.total_sell = total_sell
    summary.ticker_breakdown = dict(ticker_breakdown)
    return summary

class ParallelEngine:
    def __init__(self, num_workers: int = None, use_mps: bool = True):
        self.num_workers = num_workers or multiprocessing.cpu_count()
        self.use_mps = use_mps and torch.backends.mps.is_available()

    def partition_data(self, file_path: str, n: int) -> List[Tuple[int, int]]:
        file_size = os.path.getsize(file_path)
        chunk_size = file_size // n
        return [(i * chunk_size, (i + 1) * chunk_size if i < n - 1 else file_size) for i in range(n)]

    def aggregate(self, file_path: str) -> StockSummary:
        chunks = self.partition_data(file_path, self.num_workers)
        with multiprocessing.Pool(self.num_workers) as pool:
            partial_summaries = pool.starmap(process_chunk, 
                                            [(file_path, s, e, i) for i, (s, e) in enumerate(chunks)])
        return self._tree_reduce(partial_summaries)

    def _tree_reduce(self, summaries: List[StockSummary]) -> StockSummary:
        while len(summaries) > 1:
            next_level = []
            for i in range(0, len(summaries), 2):
                if i + 1 < len(summaries):
                    next_level.append(summaries[i].merge(summaries[i+1]))
                else:
                    next_level.append(summaries[i])
            summaries = next_level
        return summaries[0]
