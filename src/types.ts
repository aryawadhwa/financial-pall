export interface TickerData {
  ticker: string;
  buy: number;
  sell: number;
  net: number;
  volume: number;
}

export interface SimulationResult {
  totalTrades: number;
  netFlow: number;
  marketStatus: 'BULLISH' | 'BEARISH';
  tickers: TickerData[];
  executionTimeSeq: number; // in seconds
  executionTimePar: number; // in seconds
  speedup: number;
  accuracyCheckPass: boolean;
  delta: number;
}

export interface ThreadChunk {
  id: number;
  startOffset: number;
  endOffset: number;
  adjustedStart: number;
  adjustedEnd: number;
  readAheadDone: boolean;
  rawCount: number;
  // hash slots representation
  slots: {
    idx: number;
    ticker: string | null;
    probes: number;
  }[];
  sortedList: TickerData[];
}

export interface MergeStep {
  level: number;
  id: number; // index in this level's array
  sourceIds: number[]; // which chunks/merged arrays were combined
  tickers: TickerData[];
}

export interface AmdahlDataPoint {
  workers: number;
  theoreticalSpeedup: number;
  measuredSpeedup: number;
  efficiency: number;
}

export interface TimeVsSizeDataPoint {
  scale: number;
  records: number;
  seqTime: number;
  parTime: number;
}
