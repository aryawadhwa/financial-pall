import React, { useMemo } from 'react';
import { generateTimeVsSizePoints } from '../simulationEngine';
import { BookOpen, Network, FileTerminal } from 'lucide-react';

interface DaaVisualsProps {
  workersCount: number;
  parallelPercentage: number;
  baseSeqTime: number;
}

export default function DaaVisuals({
  workersCount,
  parallelPercentage,
  baseSeqTime
}: DaaVisualsProps) {
  
  const timePoints = useMemo(() => {
    return generateTimeVsSizePoints(workersCount, parallelPercentage, baseSeqTime);
  }, [workersCount, parallelPercentage, baseSeqTime]);

  const maxTime = Math.max(...timePoints.map(p => p.seqTime));

  const seqPath = useMemo(() => {
    return timePoints.map((pt, idx) => {
      const x = 30 + (idx / (timePoints.length - 1)) * 450;
      const y = 200 - (pt.seqTime / maxTime) * 170;
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [timePoints, maxTime]);

  const parPath = useMemo(() => {
    return timePoints.map((pt, idx) => {
      const x = 30 + (idx / (timePoints.length - 1)) * 450;
      const y = 200 - (pt.parTime / maxTime) * 170;
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [timePoints, maxTime]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-2.5 bg-[#EFF6FF] text-[#2563EB] rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0F172A]">Asymptotic Complexity Analysis</h3>
            <p className="text-[#64748B] text-xs font-medium mt-1">
              Mathematical evaluation of the sequential vs parallel algorithms.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#0F172A]">
            <thead className="bg-[#F8FAFC] border-y border-[#E2E8F0] text-xs uppercase tracking-wider text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-semibold">Algorithm</th>
                <th className="px-4 py-3 font-semibold">Time (N = records, K = cores)</th>
                <th className="px-4 py-3 font-semibold">Space Complexity</th>
                <th className="px-4 py-3 font-semibold">Bottleneck</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              <tr>
                <td className="px-4 py-4 font-medium">Standard Sequential</td>
                <td className="px-4 py-4 font-mono font-bold text-[#0F172A]">O(N)</td>
                <td className="px-4 py-4 font-mono">O(U) <span className="text-[10px] text-[#64748B] block mt-0.5">U = unique tickers</span></td>
                <td className="px-4 py-4 text-xs text-[#64748B]">CPU Clock Speed, I/O Wait</td>
              </tr>
              <tr className="bg-[#F8FAFC]/50">
                <td className="px-4 py-4 font-medium text-[#2563EB]">Parallel Hash & Merge</td>
                <td className="px-4 py-4 font-mono font-bold text-[#2563EB]">O(N/K + K log K)</td>
                <td className="px-4 py-4 font-mono">O(K × U)</td>
                <td className="px-4 py-4 text-xs text-[#64748B]">Lock Contention, RAM Bandwidth</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Flowchart Panel */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="p-2 bg-[#F0FDF4] text-[#22C55E] rounded-lg">
              <Network className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[#0F172A]">Parallel Architecture Flow</h3>
          </div>

          <div className="flex-1 flex items-center justify-center py-4">
            <div className="flex flex-col items-center w-full max-w-sm space-y-3">
              {/* Data Source */}
              <div className="border-2 border-[#E2E8F0] rounded-xl px-6 py-3 w-full text-center bg-[#F8FAFC]">
                <div className="font-semibold text-sm text-[#0F172A]">Raw CSV Data</div>
                <div className="text-[10px] text-[#64748B] font-mono mt-1">O(1) Boundary Resolution</div>
              </div>

              <div className="h-4 border-l-2 border-[#E2E8F0]"></div>

              {/* Parallel Hashing */}
              <div className="w-full flex justify-between gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-1 border-2 border-[#93C5FD] rounded-xl px-2 py-3 text-center bg-[#EFF6FF]">
                    <div className="font-semibold text-xs text-[#1E3A8A]">Thread {i}</div>
                    <div className="text-[9px] text-[#2563EB] font-mono mt-1">djb2 Hash</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-[#64748B] font-mono font-bold mt-1">O(N/K) Independent Parsing</div>

              <div className="h-4 border-l-2 border-[#E2E8F0] mt-3"></div>

              {/* Tournament Merge */}
              <div className="border-2 border-[#FDE68A] rounded-xl px-6 py-3 w-4/5 text-center bg-[#FEF3C7]">
                <div className="font-semibold text-sm text-[#92400E]">Reduction Tree Merge</div>
                <div className="text-[10px] text-[#B45309] font-mono mt-1">O(K log K) Tournament</div>
              </div>

              <div className="h-4 border-l-2 border-[#E2E8F0]"></div>

              {/* Output */}
              <div className="border-2 border-[#22C55E] rounded-xl px-6 py-3 w-3/4 text-center bg-[#F0FDF4] text-[#166534]">
                <div className="font-semibold text-sm">Aggregated State</div>
              </div>
            </div>
          </div>
        </div>

        {/* Time vs Size Graph Panel */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 lg:p-8 shadow-sm flex flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="p-2 bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] rounded-lg">
              <FileTerminal className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-[#0F172A]">Execution Time vs Input Size (N)</h3>
          </div>

          <div className="flex-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-4 flex flex-col relative">
            <div className="flex-1 relative min-h-[220px]">
              
              {/* Y-axis Labels */}
              <div className="absolute left-0 bottom-0 top-0 flex flex-col justify-between text-[9px] font-mono text-[#64748B] pb-5 pointer-events-none">
                <span>{maxTime.toFixed(2)}s</span>
                <span>{(maxTime * 0.75).toFixed(2)}s</span>
                <span>{(maxTime * 0.5).toFixed(2)}s</span>
                <span>{(maxTime * 0.25).toFixed(2)}s</span>
                <span>0s</span>
              </div>

              {/* SVG Area */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 500 220" preserveAspectRatio="none">
                {/* Grid lines */}
                <path d="M 30 200 L 480 200" stroke="#E2E8F0" strokeWidth="1" />
                <path d="M 30 157.5 L 480 157.5" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2,4" />
                <path d="M 30 115 L 480 115" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2,4" />
                <path d="M 30 72.5 L 480 72.5" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2,4" />
                <path d="M 30 30 L 480 30" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2,4" />

                {/* Sequential Line O(N) */}
                <path 
                  d={seqPath} 
                  stroke="#0F172A" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  fill="none"
                />
                
                {/* Parallel Line O(N/K) */}
                <path 
                  d={parPath} 
                  stroke="#2563EB" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  fill="none"
                />
              </svg>

              {/* X-axis Labels */}
              <div className="absolute left-0 bottom-0 right-0 flex justify-between pl-8 pr-4 text-[9px] font-mono text-[#64748B]">
                {timePoints.filter((_, i) => i % 2 === 0).map(pt => (
                  <span key={pt.scale}>{pt.scale}x</span>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 text-xs font-semibold text-[#0F172A]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full bg-[#0F172A]"></div>
                Sequential O(N)
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full bg-[#2563EB]"></div>
                Parallel O(N/K)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
