import csv
from dataclasses import dataclass, field
from typing import Dict

@dataclass
class StockSummary:
    total_buy: float = 0.0
    total_sell: float = 0.0
    net_flow: float = 0.0
    ticker_breakdown: Dict[str, float] = field(default_factory=dict)
    
    def merge(self, other: 'StockSummary'):
        self.total_buy += other.total_buy
        self.total_sell += other.total_sell
        self.net_flow = self.total_buy - self.total_sell
        for ticker, val in other.ticker_breakdown.items():
            self.ticker_breakdown[ticker] = self.ticker_breakdown.get(ticker, 0.0) + val
        return self

class SequentialAggregator:
    def aggregate(self, filename: str) -> StockSummary:
        summary = StockSummary()
        with open(filename, 'r', encoding='utf-8') as f:
            # Skip header
            next(f)
            # Fast manual split for speed
            for line in f:
                parts = line.strip().split(',')
                if not parts: continue
                
                ticker = parts[1]
                val = float(parts[5])
                tx_type = parts[3]
                
                if tx_type == 'Buy':
                    summary.total_buy += val
                else:
                    summary.total_sell += val
                
                summary.ticker_breakdown[ticker] = summary.ticker_breakdown.get(ticker, 0.0) + val
        
        summary.net_flow = summary.total_buy - summary.total_sell
        return summary
