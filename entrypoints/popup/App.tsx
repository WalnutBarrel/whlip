import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { isEnabledStorage, activeFiltersStorage } from '../../utils/storage';

const App: React.FC = () => {
  const [issues, setIssues] = useState<any[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requestCount, setRequestCount] = useState<number>(0);

  const availableFilters = [
    'Tiny Click Target',
    'Low Contrast',
    'Missing Alt Text',
    'Heading Hierarchy',
    'Too Many CTAs',
    'Content Readability',
  ];

  useEffect(() => {
    isEnabledStorage.getValue().then(setIsEnabled);
    activeFiltersStorage.getValue().then(setActiveFilters);

    const unwatchEnabled = isEnabledStorage.watch(setIsEnabled);
    const unwatchFilters = activeFiltersStorage.watch(setActiveFilters);

    return () => {
      unwatchEnabled();
      unwatchFilters();
    };
  }, []);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
          const response = await browser.tabs.sendMessage(tabs[0].id, { type: 'GET_ISSUES' });
          if (response && response.issues) {
            setIssues(response.issues);
          }
        }
      } catch (e) {
        console.log("Could not connect to content script", e);
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchNetworkStats = async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
          const response = await browser.runtime.sendMessage({ type: 'GET_NETWORK_STATS', tabId: tabs[0].id });
          if (response && typeof response.requestCount === 'number') {
            setRequestCount(response.requestCount);
          }
        }
      } catch (e) {
        console.log("Could not fetch network stats", e);
      }
    };

    fetchIssues();
    fetchNetworkStats();
  }, []);

  const toggleFilter = (filter: string) => {
    const newFilters = activeFilters.includes(filter)
      ? activeFilters.filter(f => f !== filter)
      : [...activeFilters, filter];
    activeFiltersStorage.setValue(newFilters);
  };

  const calculateScore = () => {
    if (isLoading) return '--';
    if (!isEnabled) return 'OFF';
    const baseScore = 100;
    return Math.max(0, baseScore - issues.length * 3).toString();
  };

  const getMetricScore = (filterName: string) => {
    const count = issues.filter(i => i.type === filterName).length;
    return Math.max(0, 100 - count * 10);
  };

  return (
    <div className="w-[380px] bg-neutral-950 text-white font-sans overflow-hidden border border-neutral-800 shadow-2xl pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500" />
          <h1 className="text-lg font-bold tracking-tight text-neutral-100">Ghost UI</h1>
        </div>
        
        {/* Master Toggle */}
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={isEnabled} onChange={(e) => isEnabledStorage.setValue(e.target.checked)} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${isEnabled ? 'bg-purple-500' : 'bg-neutral-700'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isEnabled ? 'transform translate-x-4' : ''}`}></div>
          </div>
        </label>
      </div>

      {/* Main Score Area */}
      <div className={`p-6 flex flex-col items-center justify-center border-b border-neutral-800 relative overflow-hidden transition-opacity ${isEnabled ? 'opacity-100' : 'opacity-50'}`}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple-500/20 blur-3xl rounded-full" />
        <div className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 z-10 mb-2">
          {calculateScore()}
        </div>
        <div className="text-sm font-semibold tracking-wide text-neutral-400 uppercase z-10">
          Overall UX Score
        </div>
      </div>

      {/* Filters Area */}
      <div className={`px-5 py-4 border-b border-neutral-800 ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <h3 className="text-xs font-bold text-neutral-400 uppercase mb-3">Active Filters</h3>
        <div className="flex flex-wrap gap-2">
          {availableFilters.map(filter => {
            const isActive = activeFilters.includes(filter);
            return (
              <button
                key={filter}
                onClick={() => toggleFilter(filter)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full transition-colors border ${
                  isActive 
                    ? 'bg-neutral-800 text-white border-neutral-600' 
                    : 'bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {filter}
              </button>
            )
          })}
        </div>
      </div>

      {/* Metrics List */}
      <div className={`p-5 flex flex-col gap-4 bg-neutral-950 ${isEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-neutral-300">Found Issues</h3>
          <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
            {issues.length} Total
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <MetricBar label="Accessibility (Alt Text)" score={getMetricScore('Missing Alt Text')} color="bg-red-500" />
          <MetricBar label="Content Readability" score={getMetricScore('Content Readability')} color="bg-blue-500" />
          <MetricBar label="Visual Hierarchy" score={getMetricScore('Heading Hierarchy')} color="bg-orange-500" />
          <MetricBar label="Contrast Ratio" score={getMetricScore('Low Contrast')} color="bg-red-500" />
          <MetricBar label="Click Targets" score={getMetricScore('Tiny Click Target')} color="bg-green-500" />
        </div>

        {/* Network Stats Pill */}
        <div className="mt-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-neutral-300 uppercase">Network Load</span>
            <span className="text-[10px] text-neutral-500">Requests on current page</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white">{requestCount}</span>
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">Requests</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBar = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex justify-between items-center text-xs">
      <span className="font-medium text-neutral-400">{label}</span>
      <span className="font-bold text-neutral-200">{score}/100</span>
    </div>
    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${score}%` }} />
    </div>
  </div>
);

export default App;
