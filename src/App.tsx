import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Cpu, 
  Layers
} from 'lucide-react';

// Subcomponents
import Dashboard from './components/Dashboard';
import ThreadSimulator from './components/ThreadSimulator';
import { TICKERS_INFO } from './simulationEngine';
import scalingData from './data/scaling_results.json';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'simulator'>('dashboard');

  // Centralized Sandbox Simulator State for Dynamic Interactivity
  const [workersCount, setWorkersCount] = useState<number>(8);
  const [scaleFactor, setScaleFactor] = useState<number>(1.0); // 1.0 = 5M records, 0.5 = 2.5M, 0.1 = 500K
  const [parallelPercentage, setParallelPercentage] = useState<number>(scalingData.average_parallel_fraction); // Amdahl's parallel fraction p
  const [baseSeqTime, setBaseSeqTime] = useState<number>(0.6165); // Baseline sequential time
  const [customTickers, setCustomTickers] = useState<typeof TICKERS_INFO>(TICKERS_INFO);
  const [hasRun, setHasRun] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans pb-20 selection:bg-[#2563EB]/20 selection:text-[#2563EB]" id="pall-fin-app">
      
      {/* Dynamic Professional Navbar */}
      <header className="border-b border-[#E2E8F0] bg-[#FFFFFF] sticky top-0 z-50 px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-sm ring-1 ring-black/5">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-[#0F172A] font-sans">
                  PALL-FIN
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold">
                  INR
                </span>
              </div>
              <span className="text-xs text-[#64748B] font-medium block mt-0.5">
                Parallel Financial Aggregator
              </span>
            </div>
          </div>

          {/* Clean Integrated Navbar Links */}
          <nav className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-xl shadow-inner ring-1 ring-[#E2E8F0]">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]'
                  : 'bg-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
              id="nav-tab-dashboard"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Investment Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]'
                  : 'bg-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
              id="nav-tab-simulator"
            >
              <Layers className="w-4 h-4" />
              <span>Thread Memory</span>
            </button>
          </nav>

        </div>
      </header>

      {/* Primary Spacious Layout Area */}
      <main className="max-w-7xl w-full mx-auto px-8 pt-10 flex flex-col flex-1">
        
        {/* Dynamic Frame Display */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  workersCount={workersCount}
                  setWorkersCount={setWorkersCount}
                  scaleFactor={scaleFactor}
                  setScaleFactor={setScaleFactor}
                  parallelPercentage={parallelPercentage}
                  setParallelPercentage={setParallelPercentage}
                  baseSeqTime={baseSeqTime}
                  setBaseSeqTime={setBaseSeqTime}
                  customTickers={customTickers}
                  setCustomTickers={setCustomTickers}
                  hasRun={hasRun}
                  setHasRun={setHasRun}
                />
              )}
              {activeTab === 'simulator' && (
                <ThreadSimulator 
                  workersCount={workersCount}
                  scaleFactor={scaleFactor}
                  parallelPercentage={parallelPercentage}
                  customTickers={customTickers}
                  baseSeqTime={baseSeqTime}
                  hasRun={hasRun}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* Unified Dark Footer */}
      <footer className="mt-20 border-t border-[#E2E8F0] pt-8 px-8 text-center text-sm text-[#64748B] font-sans max-w-7xl mx-auto w-full">
        <div>
          PALL-FIN Parallel Financial Data Aggregation System · Optimized for High-Throughput Processing
        </div>
      </footer>
    </div>
  );
}
