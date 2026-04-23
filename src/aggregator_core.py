import csv
from dataclasses import dataclass, field
from typing import Dict
from collections import defaultdict

@dataclass
class StockSummary:
    total_buy: float = 0.0
    total_sell: float = 0.0
    net_flow: float = 0.0
    ticker_breakdown: Dict[str, float] = field(default_factory=lambda: defaultdict(float))
    
    def merge(self, other: 'StockSummary'):
        self.total_buy += other.total_buy
        self.total_sell += other.total_sell
        self.net_flow = self.total_buy - self.total_sell
        for ticker, val in other.ticker_breakdown.items():
            self.ticker_breakdown[ticker] += val
        return self

class SequentialAggregator:
    def aggregate(self, filename: str) -> StockSummary:
        summary = StockSummary()
        with open(filename, 'r', encoding='utf-8') as f:
            # Skip header
            next(f)
            # ⚡ Bolt Optimization: Using split instead of strip+split and
            # leveraging len == 6 with a try/except block for faster value casting.
            # Using defaultdict allows fast += instead of dict.get()
            for line in f:
                parts = line.split(',')
                if len(parts) == 6:
                    try:
                        val = float(parts[5])
                        if parts[3] == 'Buy':
                            summary.total_buy += val
                        else:
                            summary.total_sell += val

                        summary.ticker_breakdown[parts[1]] += val
                    except ValueError:
                        pass
        
        summary.net_flow = summary.total_buy - summary.total_sell
        return summary
