import { useState, useMemo } from 'react';
import { runSystemSimulation, djb2Hash } from '../simulationEngine';
import { 
  Cpu, 
  Layers, 
  Merge, 
  Database,
  Info
} from 'lucide-react';

interface ThreadSimulatorProps {
  workersCount: number;
  scaleFactor: number;
  parallelPercentage: number;
  customTickers: { symbol: string; buySeed: number; sellSeed: number }[];
  baseSeqTime: number;
  hasRun: boolean;
}

export default function ThreadSimulator({
  workersCount,
  scaleFactor,
  parallelPercentage,
  customTickers,
  baseSeqTime,
  hasRun
}: ThreadSimulatorProps) {
  const [selectedThread, setSelectedThread] = useState<number>(0);
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  const simScale = scaleFactor * 0.2; 
  const simulation = useMemo(() => {
    return runSystemSimulation(workersCount, simScale, parallelPercentage, customTickers, baseSeqTime);
  }, [workersCount, simScale, parallelPercentage, customTickers, baseSeqTime]);

  const { chunks, mergeTree } = simulation;

  const chunkData = chunks[selectedThread] || chunks[0] || { id: 0, rawCount: 0, startOffset: 0, endOffset: 0, adjustedStart: 0, adjustedEnd: 0, readAheadDone: false, slots: [], sortedList: [] };

  return (
    <div className="space-y-8 pb-10" id="thread-simulator-root">
      
      {/* Title Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
          <Layers className="w-6 h-6 text-[#2563EB]" /> Memory Mapping Division
        </h2>
        <p className="text-[#64748B] text-sm leading-relaxed mt-2 max-w-2xl">
          Inspect dynamic file byte boundaries, linear probe hashing slots, and log-depth pairwise reduction merges for each active thread core.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="relative">
        {!hasRun && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md rounded-2xl border border-white/50 -m-4 p-4">
             <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center border border-[#E2E8F0]">
                <Layers className="w-10 h-10 text-[#2563EB] mb-4 opacity-90" />
                <h3 className="text-lg font-bold text-[#0F172A]">Awaiting Execution</h3>
                <p className="text-[#64748B] text-sm mt-2 text-center max-w-sm leading-relaxed">
                  Go to <strong>Investment Analytics</strong> and click <strong>Run Aggregation</strong> to generate thread memory mapping data.
                </p>
             </div>
          </div>
        )}
        
        <div className={`space-y-8 transition-all duration-700 ${!hasRun ? 'opacity-30 pointer-events-none select-none' : 'opacity-100'}`}>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Slices boundaries */}
        <div className="xl:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col space-y-6">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#64748B]" /> Thread Boundaries
            </h3>
            <p className="text-[#64748B] text-xs font-medium">
              Raw binary aggregates are partitioned evenly. Bound overlaps are normalized.
            </p>
          </div>

          {/* Slicing List */}
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-2">
            {chunks.map((c) => {
              const isSelected = selectedThread === c.id;
              
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedThread(c.id)}
                  className={`w-full text-left p-4 rounded-xl border text-xs transition-all block ${
                    isSelected 
                      ? 'bg-[#EFF6FF] border-[#2563EB] shadow-sm transform scale-[1.01]' 
                      : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-sm font-bold ${isSelected ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>
                      Core Thread {c.id}
                    </span>
                    <span className={`text-[11px] font-bold ${isSelected ? 'text-[#1E3A8A]' : 'text-[#64748B]'}`}>
                      {c.rawCount.toLocaleString()} parsed entries
                    </span>
                  </div>

                  {/* Byte offset metrics */}
                  <div className="grid grid-cols-2 gap-4 text-[11px] pt-3 border-t border-[#E2E8F0] font-mono">
                    <div>
                      <span className="block text-[#64748B] uppercase tracking-wider text-[9px] font-sans font-semibold mb-1">Raw Range</span>
                      <span className="font-bold text-[#0F172A]">{Math.round(c.startOffset).toLocaleString()} - {Math.round(c.endOffset).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="block text-[#64748B] uppercase tracking-wider text-[9px] font-sans font-semibold mb-1">Adjusted Bounds</span>
                      <span className="font-bold text-[#0F172A]">{Math.round(c.adjustedStart).toLocaleString()} - {Math.round(c.adjustedEnd).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Boundary markers */}
                  <div className="mt-4 flex items-center gap-2">
                    {c.id === 0 ? (
                      <span className="bg-[#DBEAFE] text-[#1E3A8A] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        Header Skip Applied
                      </span>
                    ) : (
                      <span className="bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        Segment Adjust Completed
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Private hash table slots */}
        <div className="xl:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#64748B]" /> Memory Key-Value Slots (Thread {chunkData.id})
              </h3>
            </div>
            
            <div className="bg-[#F8FAFC] font-mono text-[11px] font-medium px-3 py-1.5 text-[#64748B] rounded-lg border border-[#E2E8F0]">
              Unique assets: <span className="font-bold text-[#0F172A]">{chunkData.sortedList.length}</span>
            </div>
          </div>

          {/* Slots Layout - 64 slots */}
          <div className="flex-1 flex flex-col space-y-6">
            <div className="grid grid-cols-8 gap-1.5">
              {chunkData.slots.map((slot) => {
                const isOccupied = slot.ticker !== null;
                const isHovered = hoveredSlot === slot.idx;

                return (
                  <button
                    key={slot.idx}
                    onMouseEnter={() => setHoveredSlot(slot.idx)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    className={`h-11 rounded-lg flex flex-col items-center justify-center border transition-all cursor-crosshair text-xs ${
                      isOccupied 
                        ? slot.probes > 0 
                          ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]' 
                          : 'bg-[#2563EB] border-[#2563EB] text-white shadow-sm' 
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#CBD5E1]'
                    } ${isHovered ? 'ring-2 ring-[#0F172A] ring-offset-1 border-transparent scale-105 z-10' : ''}`}
                  >
                    <span className={`text-[8px] font-semibold ${isOccupied ? (slot.probes > 0 ? 'text-[#93C5FD]' : 'text-white/70') : 'text-[#CBD5E1]'}`}>#{slot.idx}</span>
                    <span className="font-mono font-bold text-[10px] tracking-tight mt-0.5">
                      {isOccupied ? slot.ticker : '—'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tooltip explanation */}
            <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#E2E8F0] min-h-[100px] text-xs text-[#0F172A] flex items-start gap-3">
              <Info className="w-5 h-5 text-[#2563EB] mt-0.5 shrink-0" />
              <div className="space-y-1.5 w-full">
                {hoveredSlot !== null ? (
                  (() => {
                    const slot = chunkData.slots[hoveredSlot];
                    const isOccupied = slot.ticker !== null;

                    if (isOccupied) {
                      const tickerSymbol = slot.ticker || '';
                      const rawHash = djb2Hash(tickerSymbol);
                      const preferredIdx = rawHash & 63;
                      
                      return (
                        <div className="space-y-1.5">
                          <p className="font-bold text-sm">
                            Slot #{slot.idx}: <span className="font-mono bg-[#E2E8F0] px-1.5 py-0.5 rounded mx-1">{tickerSymbol}</span>
                          </p>
                          <div className="text-[11px] text-[#64748B] font-medium space-y-1 pt-1">
                            <div>djb2 Hash Index: <span className="text-[#0F172A] font-bold font-mono">{rawHash}</span></div>
                            <div>Target Index: <span className="text-[#0F172A] font-bold font-mono">#{preferredIdx}</span></div>
                            {slot.probes > 0 ? (
                              <div className="text-[#EF4444] font-semibold mt-1">Collide resolution: {slot.probes} slots linearly offset</div>
                            ) : (
                              <div className="text-[#22C55E] font-semibold mt-1">Optimal match: direct slot address</div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div>
                          <p className="font-bold text-sm">Slot #{slot.idx}: Unallocated Address</p>
                          <p className="text-[11px] text-[#64748B] mt-1 font-medium">
                            No conflict maps resolve to this location. Immediately accessible in the virtual memory matrix.
                          </p>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div>
                    <span className="font-bold block text-sm">Interactive Memory Inspector</span>
                    <p className="text-[11px] text-[#64748B] mt-1 font-medium leading-relaxed">
                      Hover cursor over index blocks to analyze allocation mappings and resolved probes in real time.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* INR values for sorted intermediate lists */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] text-[#64748B] uppercase tracking-wider block font-bold border-l-2 border-[#2563EB] pl-2">Intermediate Array</span>
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                <div className="flex flex-wrap gap-2 items-center text-xs font-mono">
                  {chunkData.sortedList.map((st, i) => (
                    <div key={st.ticker} className="flex items-center gap-1 bg-white px-2 py-1 rounded shadow-sm border border-[#E2E8F0]/80 text-[10px]">
                      <span className="text-[#0F172A] font-bold">{st.ticker}</span>
                      <span className="text-[#64748B]">(₹{Math.round(st.net).toLocaleString()})</span>
                      {i < chunkData.sortedList.length - 1 && <span className="text-[#CBD5E1] ml-1.5">→</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Binary Tournament reduction tree widget */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm space-y-6">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
            <Merge className="w-5 h-5 text-[#64748B]" /> Pairwise Reduction Merge
          </h3>
          <p className="text-[#64748B] text-xs font-medium">
            Sorted thread subsets are progressively unified with localized concurrent locks via a binary tree merger.
          </p>
        </div>

        <div className="p-8 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex flex-col justify-center items-center">
          
          {/* Level 0 */}
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mr-auto pl-2 border-l-2 border-[#E2E8F0]">
              Level 0: Segments ({workersCount} Workers)
            </div>
            
            <div className="flex flex-wrap justify-center gap-3 font-mono text-xs w-full">
              {chunks.map((ch) => (
                <div 
                  key={ch.id}
                  className={`px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-center shadow-sm w-32 transition-all ${
                    selectedThread === ch.id ? 'ring-2 ring-[#2563EB] shadow-md border-transparent' : ''
                  }`}
                >
                  <span className="block font-bold text-[#0F172A] text-[11px]">Core #{ch.id}</span>
                  <span className="block text-[10px] text-[#64748B] mt-1 font-medium">{ch.rawCount.toLocaleString()} items</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[#94A3B8] font-mono text-[10px] uppercase py-5 font-bold">▼ Two-Pointer Array Combine Block</div>

          {/* Level 1 */}
          <div className="flex flex-col items-center space-y-4 w-full">
            <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mr-auto pl-2 border-l-2 border-[#E2E8F0]">
              Level 1: Concurrent Merges
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 font-mono text-xs w-full">
              {mergeTree[0]?.map((step, idx) => (
                <div 
                  key={idx}
                  className="px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-center shadow-sm min-w-[140px]"
                >
                  <span className="block font-bold text-[#0F172A] text-[11px]">Sub-matrix {idx}</span>
                  <div className="text-[10px] text-[#2563EB] font-bold mt-1">
                    {step.tickers.length} unified assets
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Level 2 */}
          {mergeTree.length > 1 && (
            <>
              <div className="text-[#94A3B8] font-mono text-[10px] py-5 font-bold">▼ Combine Level 2</div>
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mr-auto pl-2 border-l-2 border-[#E2E8F0]">
                  Level 2: Unified Intermediate Aggregates
                </div>
                
                <div className="flex flex-wrap justify-center gap-8 font-mono text-xs w-full">
                  {mergeTree[1]?.map((step, idx) => (
                    <div 
                      key={idx}
                      className="px-4 py-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-center shadow-sm min-w-[150px]"
                    >
                      <span className="block font-bold text-[#1E3A8A] text-[11px]">Union Block {idx}</span>
                      <div className="text-[10px] text-[#2563EB] font-bold mt-1">
                        {step.tickers.length} combined assets
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Consolidated Result */}
          <div className="text-[#94A3B8] font-mono text-[10px] py-6 font-bold">▼ Consolidated Matrix</div>
          
          <div className="px-6 py-5 bg-[#0F172A] border border-[#1E293B] rounded-xl text-center shadow-lg max-w-sm w-full">
            <span className="block font-bold text-white text-xs uppercase tracking-wider font-mono">Consolidated Output Array</span>
            <span className="block text-[11px] text-[#94A3B8] mt-2 font-sans font-medium">
              Parallel reduction pipeline completed sequentially with absolute integrity.
            </span>
          </div>

          </div>

        </div>
      </div>
        </div>

    </div>
  );
}
