import { useState, useMemo } from 'react';
import { 
  generateAmdahlPoints, 
  runSystemSimulation 
} from '../simulationEngine';
import { 
  Database,
  TrendingUp,
  Clock,
  Sliders,
  Cpu,
  Play,
  RefreshCw,
  Terminal,
  Info
} from 'lucide-react';
import DaaVisuals from './DaaVisuals';

interface DashboardProps {
  workersCount: number;
  setWorkersCount: (w: number) => void;
  scaleFactor: number;
  setScaleFactor: (sf: number) => void;
  parallelPercentage: number;
  setParallelPercentage: (p: number) => void;
  baseSeqTime: number;
  setBaseSeqTime: (t: number) => void;
  customTickers: { symbol: string; buySeed: number; sellSeed: number }[];
  setCustomTickers: (tickers: { symbol: string; buySeed: number; sellSeed: number }[]) => void;
  hasRun: boolean;
  setHasRun: (val: boolean) => void;
}

export default function Dashboard({
  workersCount,
  setWorkersCount,
  scaleFactor,
  setScaleFactor,
  parallelPercentage,
  setParallelPercentage,
  baseSeqTime,
  setBaseSeqTime,
  customTickers,
  setCustomTickers,
  hasRun,
  setHasRun
}: DashboardProps) {
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationCount, setSimulationCount] = useState(0);

  const simData = useMemo(() => {
    return runSystemSimulation(workersCount, scaleFactor, parallelPercentage, customTickers, baseSeqTime);
  }, [workersCount, scaleFactor, parallelPercentage, customTickers, baseSeqTime, simulationCount]);

  const { result } = simData;

  const amdahlPoints = useMemo(() => {
    return generateAmdahlPoints(parallelPercentage);
  }, [parallelPercentage]);

  const handleSimulateBtn = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setHasRun(true);
      setSimulationCount(prev => prev + 1);
    }, 400); 
  };

  const maxBuySellVal = useMemo(() => {
    let maxVal = 1;
    result.tickers.forEach(t => {
      if (t.buy > maxVal) maxVal = t.buy;
      if (t.sell > maxVal) maxVal = t.sell;
    });
    return maxVal;
  }, [result]);

  const totalVolume = useMemo(() => {
    return result.tickers.reduce((acc, current) => acc + current.volume, 0);
  }, [result]);

  const updateStockSeed = (index: number, field: 'buySeed' | 'sellSeed', val: number) => {
    const updated = [...customTickers];
    updated[index] = {
      ...updated[index],
      [field]: Math.max(100, Math.min(1000000, val))
    };
    setCustomTickers(updated);
  };

  const serialPercentage = 1 - parallelPercentage;
  const asymptoteCeiling = serialPercentage > 0 ? 1 / serialPercentage : workersCount;
  const yAxisMax = Math.max(2.0, Math.ceil(asymptoteCeiling));

  const theoreticalPath = useMemo(() => {
    return amdahlPoints.map((pt, index) => {
      const x = 20 + ((pt.workers - 1) / 15) * 310;
      const y = 135 - ((pt.theoreticalSpeedup - 1) / (yAxisMax - 1)) * 115;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [amdahlPoints, yAxisMax]);

  const measuredPath = useMemo(() => {
    return amdahlPoints.map((pt, index) => {
      const x = 20 + ((pt.workers - 1) / 15) * 310;
      const y = 135 - ((pt.measuredSpeedup - 1) / (yAxisMax - 1)) * 115;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [amdahlPoints, yAxisMax]);

  const seqTime = result.executionTimeSeq;
  const parTime = result.executionTimePar;
  const p = parallelPercentage;
  const w = workersCount;
  const overhead = 0.02 * Math.log2(w);
  const measuredDenominator = (1 - p) + (p / w) + overhead;
  const setupRatio = measuredDenominator > 0 ? (1 - p) / measuredDenominator : 0;
  const processRatio = measuredDenominator > 0 ? (p / w) / measuredDenominator : 0;
  const mergeRatio = measuredDenominator > 0 ? overhead / measuredDenominator : 0;

  return (
    <div className="space-y-8 pb-10" id="dashboard-container">
      
      {/* Simulation Controls Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-8 shadow-sm">
        <div className="space-y-2 text-left max-w-xl">
          <h2 className="text-xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
            <Cpu className="w-6 h-6 text-[#2563EB]" /> Simulator Run Settings
          </h2>
          <p className="text-[#64748B] text-sm leading-relaxed">
            Configure processing threads, data volumes, and computation factors. Results recalculate to demonstrate theoretical scaling ceilings.
          </p>
        </div>

        <div className="flex flex-wrap xl:flex-nowrap items-center gap-4 w-full xl:w-auto">
          {/* Workload Size Selection */}
          <div className="bg-[#F8FAFC] px-4 py-3 text-sm rounded-xl border border-[#E2E8F0] flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider mb-0.5">Records</span>
              <span className="text-[#0F172A] font-bold">
                {(5000000 * scaleFactor).toLocaleString()}
              </span>
            </div>
            
            <div className="flex gap-1.5">
              {[0.1, 0.5, 1.0].map((sf) => (
                <button
                  key={sf}
                  onClick={() => setScaleFactor(sf)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    scaleFactor === sf 
                      ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]' 
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/30'
                  }`}
                >
                  {sf === 1.0 ? '5M' : sf === 0.5 ? '2.5M' : '500K'}
                </button>
              ))}
            </div>
          </div>

          {/* Workers Thread Count */}
          <div className="bg-[#F8FAFC] px-4 py-3 text-sm rounded-xl border border-[#E2E8F0] flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[#64748B] font-medium text-[11px] uppercase tracking-wider mb-0.5">Cores</span>
              <span className="text-[#0F172A] font-bold">{workersCount} Threads</span>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {[1, 2, 4, 8, 12, 16].map((w) => (
                <button
                  key={w}
                  onClick={() => setWorkersCount(w)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    workersCount === w 
                      ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]' 
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/30'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSimulateBtn}
            disabled={isSimulating}
            className="bg-[#0F172A] hover:bg-[#1E293B] text-white font-sans text-sm font-semibold px-6 py-4 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer h-[52px] min-w-[200px]"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white/80" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white text-white" />
                <span>Run Aggregation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Control Center */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col space-y-6">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#64748B]" /> Configuration Calibrator
          </h3>
          <p className="text-[#64748B] text-xs font-medium mt-1">
            Adjust low-level algorithmic assumptions to preview outcome elasticity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6 p-5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#64748B] uppercase tracking-wide text-[10px]">Parallel Fraction (p)</span>
                <span className="text-[#2563EB] font-mono">{Math.round(parallelPercentage * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.01" max="0.99" step="0.01" 
                value={parallelPercentage}
                onChange={(e) => setParallelPercentage(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#64748B] uppercase tracking-wide text-[10px]">Sequential Logic Time</span>
                <span className="text-[#2563EB] font-mono">{baseSeqTime.toFixed(2)}s</span>
              </div>
              <input 
                type="range" 
                min="0.20" max="2.00" step="0.05" 
                value={baseSeqTime}
                onChange={(e) => setBaseSeqTime(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
            </div>
          </div>

          <div className="space-y-4 max-h-[160px] overflow-y-auto pr-2">
            {customTickers.map((t, idx) => (
              <div key={t.symbol} className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl space-y-3">
                <span className="font-mono text-[#0F172A] font-bold text-xs">{t.symbol} Seed Values</span>
                
                <div className="space-y-3 pt-1">
                  <div className="flex justify-between items-center gap-4 text-xs font-medium">
                    <span className="text-[#64748B] w-8">Buy</span>
                    <input 
                      type="range"
                      min="1000" max="80000" step="1000"
                      value={t.buySeed}
                      onChange={(e) => updateStockSeed(idx, 'buySeed', parseInt(e.target.value))}
                      className="flex-1 h-1 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#0F172A]"
                    />
                    <span className="w-12 text-right font-mono text-[#0F172A]">₹{Math.round(t.buySeed/1000)}k</span>
                  </div>

                  <div className="flex justify-between items-center gap-4 text-xs font-medium">
                    <span className="text-[#64748B] w-8">Sell</span>
                    <input 
                      type="range"
                      min="1000" max="80000" step="1000"
                      value={t.sellSeed}
                      onChange={(e) => updateStockSeed(idx, 'sellSeed', parseInt(e.target.value))}
                      className="flex-1 h-1 bg-[#E2E8F0] rounded-lg appearance-none cursor-pointer accent-[#0F172A]"
                    />
                    <span className="w-12 text-right font-mono text-[#0F172A]">₹{Math.round(t.sellSeed/1000)}k</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative">
        {!hasRun && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md rounded-2xl border border-white/50 -m-4 p-4">
             <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-[#E2E8F0]">
                <Play className="w-10 h-10 text-[#2563EB] mb-4 opacity-90" />
                <h3 className="text-lg font-bold text-[#0F172A]">Awaiting Execution</h3>
                <p className="text-[#64748B] text-sm mt-2 text-center max-w-sm leading-relaxed">
                  Click <strong>Run Aggregation</strong> to calculate metrics.
                </p>
             </div>
          </div>
        )}
        
        <div className={`space-y-8 transition-all duration-700 ${!hasRun ? 'opacity-30 pointer-events-none select-none' : 'opacity-100'}`}>
          {/* Financial Metrics in INR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="metric-cards">
        
        {/* Card 1 */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-[#EFF6FF] text-[#2563EB] rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">Processed Records</span>
          </div>
          <div>
            <span className="text-3xl font-mono font-bold tracking-tight text-[#0F172A] block">
              {result.totalTrades.toLocaleString()}
            </span>
            <span className="text-xs text-[#64748B] font-medium block mt-1">
              Total trade count evaluated
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-[#F0FDF4] text-[#22C55E] rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">Aggregate Net Flow</span>
          </div>
          <div>
            <span className="text-3xl font-mono font-bold tracking-tight text-[#0F172A] block">
              ₹{result.netFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="flex gap-2 items-center text-[11px] font-medium text-[#64748B] mt-1.5">
              <span className="px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#0F172A]">
                {result.marketStatus} MODE
              </span>
              <span>Indian Rupee</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[#64748B] text-[11px] font-semibold uppercase tracking-wider">Speedup Rate</span>
          </div>
          <div>
            <span className="text-3xl font-mono font-bold tracking-tight text-[#0F172A] block">
              {result.speedup}x
            </span>
            <span className="text-xs text-[#64748B] font-medium block mt-1">
              Parallel: <strong className="text-[#0F172A]">{result.executionTimePar}s</strong> vs Serial: <strong className="text-[#0F172A]">{result.executionTimeSeq}s</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-charts">
        
        {/* Left Side: Volume Analysis chart */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-[#0F172A]">Index Volume Analysis (INR)</h3>
            <p className="text-[#64748B] text-xs font-medium mt-1">
              Relative trading pressures across key monitored market assets.
            </p>
          </div>

          <div className="flex-1 space-y-6">
            {result.tickers.map((t) => {
              const buyPercent = (t.buy / maxBuySellVal) * 100;
              const sellPercent = (t.sell / maxBuySellVal) * 100;
              const shareOfVolume = ((t.volume / totalVolume) * 100).toFixed(1);

              return (
                <div key={t.ticker} className="space-y-3" id={`ticker-row-${t.ticker}`}>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-[#0F172A] font-bold text-sm bg-[#F8FAFC] px-2 py-1 rounded border border-[#E2E8F0]">{t.ticker}</span>
                    <div className="flex items-center gap-3 text-[#64748B] font-medium text-xs">
                      <span>Buy: <strong className="text-[#2563EB]">₹{t.buy.toLocaleString()}</strong></span>
                      <span className="text-[#E2E8F0]">|</span>
                      <span>Sell: <strong className="text-[#0F172A]">₹{t.sell.toLocaleString()}</strong></span>
                      <span className="text-[#E2E8F0]">|</span>
                      <span>Share: <strong className="text-[#64748B]">{shareOfVolume}%</strong></span>
                    </div>
                  </div>

                  <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]/60 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-[#64748B] w-8 text-right">BUY</span>
                      <div className="h-2.5 bg-[#E2E8F0] flex-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#2563EB] rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(2, buyPercent)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-[#64748B] w-8 text-right">SELL</span>
                      <div className="h-2.5 bg-[#E2E8F0] flex-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0F172A] rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(2, sellPercent)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Speedup Curve Grid */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-semibold text-[#0F172A]">Amdahl Speedup Efficiency</h3>
            <p className="text-[#64748B] text-xs font-medium mt-1">
              Simulated multithreaded performance vs mathematical theoretical limits.
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] mb-5">
            <div className="relative h-56 w-full flex items-end justify-between font-mono text-[10px] text-[#64748B] pt-4 px-2">
              
              {/* Y-axis */}
              <div className="absolute left-0 bottom-0 top-0 w-full flex flex-col justify-between pointer-events-none text-[9px] font-medium border-l border-b border-[#E2E8F0] z-0">
                <div className="w-full border-t border-[#E2E8F0]/50 pt-1 pl-2">{yAxisMax.toFixed(2)}x Maximum</div>
                <div className="w-full border-t border-[#E2E8F0]/50 pt-1 pl-2">{(1 + (yAxisMax - 1) * 0.75).toFixed(2)}x</div>
                <div className="w-full border-t border-[#E2E8F0]/50 pt-1 pl-2">{(1 + (yAxisMax - 1) * 0.50).toFixed(2)}x</div>
                <div className="w-full border-t border-[#E2E8F0]/50 pt-1 pl-2">{(1 + (yAxisMax - 1) * 0.25).toFixed(2)}x</div>
                <div className="pl-2">1.00x</div>
              </div>

              {/* Curves */}
              <svg className="absolute inset-0 h-full w-full p-1 z-10" viewBox="0 0 350 150" fill="none">
                <path d="M 0 30 L 350 30" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <path d="M 0 65 L 350 65" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <path d="M 0 100 L 350 100" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />
                <path d="M 0 135 L 350 135" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4,4" />

                {/* Theoretical Curve (Blue) */}
                <path 
                  d={theoreticalPath} 
                  stroke="#2563EB" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeDasharray="4,3"
                  fill="none"
                />

                {/* Measured Curve (Dark) */}
                <path 
                  d={measuredPath} 
                  stroke="#0F172A" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  fill="none"
                />

                {/* Dots */}
                {amdahlPoints.map((pt) => {
                  const cx = 20 + ((pt.workers - 1) / 15) * 310;
                  const cy = 135 - ((pt.measuredSpeedup - 1) / (yAxisMax - 1)) * 115;
                  const isCurrent = pt.workers === workersCount;
                  return (
                    <g key={pt.workers}>
                      <circle 
                        cx={cx} 
                        cy={cy} 
                        r={isCurrent ? "5" : "3.5"} 
                        fill={isCurrent ? "#2563EB" : "#0F172A"} 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                      />
                    </g>
                  );
                })}
              </svg>

              {/* X-axis */}
              <div className="absolute left-7 bottom-2 flex justify-between w-[90%] font-mono text-[9px] font-medium text-[#64748B] pointer-events-none">
                <span>1 Core</span>
                <span>2 Cores</span>
                <span>4 Cores</span>
                <span>8 Cores</span>
                <span>12 Cores</span>
                <span>16 Cores</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 text-[11px] pt-6 font-medium font-sans">
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-[#2563EB] rounded-full opacity-80 border border-dashed border-white"></span>
                <span className="text-[#64748B]">Theoretical Limit Law</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-1.5 bg-[#0F172A] rounded-full"></span>
                <span className="text-[#64748B]">Simulated Observed Rate</span>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-start gap-3 p-4 bg-[#EFF6FF] rounded-xl text-xs text-[#1E3A8A] leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <strong>Asymptotic ceiling limit:</strong> The estimated sequential baseline fraction is {Math.round(serialPercentage * 100)}%. System throughput peaks at roughly <strong>{asymptoteCeiling.toFixed(2)}x</strong> regardless of additional threads added.
            </p>
          </div>
        </div>

      </div>

      {/* DAA Complexity Visuals */}
      <DaaVisuals 
        workersCount={workersCount}
        parallelPercentage={parallelPercentage}
        baseSeqTime={baseSeqTime}
      />

      </div>
    </div>
  </div>
  );
}
