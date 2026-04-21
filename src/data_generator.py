import yfinance as yf
import pandas as pd
import numpy as np
import os
import time

def fetch_and_augment_stock_data(tickers=['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'NFLX'], target_records=5_000_000):
    """
    Fetches real stock data and augments it to create a massive dataset.
    Target: 5,000,000 records to demonstrate parallel speedup.
    """
    os.makedirs('data', exist_ok=True)
    filename = 'data/stocks.csv'
    
    print(f"Fetching real stock data for: {tickers}...")
    data = yf.download(tickers, period="10y", interval="1d", group_by='ticker')
    
    all_records = []
    
    print(f"Generating {target_records:,} records...")
    
    # Calculate how many records per ticker/day
    num_tickers = len(tickers)
    days_per_ticker = len(data.index)
    records_per_day = target_records // (num_tickers * days_per_ticker)
    if records_per_day < 1: records_per_day = 1

    total_generated = 0
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("timestamp,ticker,price,type,volume,total_value\n")
        
        for ticker in tickers:
            ticker_data = data[ticker].dropna()
            for date, row in ticker_data.iterrows():
                base_price = row['Open']
                volatility = (row['High'] - row['Low']) / 10
                
                for _ in range(records_per_day):
                    # Fast generation using numpy
                    random_time = date + pd.Timedelta(seconds=np.random.randint(0, 86400))
                    price = base_price + np.random.normal(0, volatility)
                    tx_type = 'Buy' if np.random.random() > 0.5 else 'Sell'
                    volume = np.random.randint(1, 100)
                    total_value = price * volume
                    
                    f.write(f"{random_time.isoformat()},{ticker},{price:.2f},{tx_type},{volume},{total_value:.2f}\n")
                    total_generated += 1
                    
                    if total_generated % 500_000 == 0:
                        print(f"  Progress: {total_generated:,} / {target_records:,}")
                
    print(f"Data generation complete: {total_generated:,} records.")

if __name__ == "__main__":
    fetch_and_augment_stock_data()
