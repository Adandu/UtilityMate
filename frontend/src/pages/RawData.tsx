import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, ChevronRight } from 'lucide-react';

const RawData: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    // Mock data
    setData([
      { id: 1, date: '2026-03-15', location: 'AP12', category: 'Electricity', provider: 'Hidroelectrica', index: 12450.5, cost: 145.20 },
      { id: 2, date: '2026-03-12', location: 'AP15', category: 'Gas', provider: 'ENGIE', index: 8900.2, cost: 210.00 },
      { id: 3, date: '2026-02-15', location: 'AP12', category: 'Electricity', provider: 'Hidroelectrica', index: 12300.1, cost: 138.50 },
      { id: 4, date: '2026-02-10', location: 'AP15', category: 'Gas', provider: 'ENGIE', index: 8750.8, cost: 195.40 },
    ]);
  }, []);

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface text-on-surface">Data Warehouse</h2>
          <p className="text-on-surface-variant font-medium opacity-70 text-on-surface-variant">Low-level analytical view of all processed utility records.</p>
        </div>
        
        <button className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-8 py-3 rounded-2xl font-bold shadow-sm hover:bg-secondary-fixed transition-all active:scale-95">
          <Download size={20} />
          <span className="uppercase tracking-widest text-xs">Export Dataset</span>
        </button>
      </header>

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row gap-4 justify-between bg-surface-container-lowest/50">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50" size={18} />
            <input 
              type="text" 
              placeholder="Query logs..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold hover:bg-surface-container transition-colors">
            <Filter size={18} />
            <span className="text-[10px] uppercase tracking-[0.2em]">Surgical Filter</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant bg-surface-container-low">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Context</th>
                <th className="px-6 py-4 text-center">Category</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4 text-right">Value</th>
                <th className="px-6 py-4 text-right">Settlement</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container-high/30 transition-colors group">
                  <td className="px-6 py-5 font-mono text-[11px] text-on-surface-variant">{row.date}</td>
                  <td className="px-6 py-5">
                    <span className="font-black text-on-surface tracking-tight uppercase text-xs">{row.location}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-200/50 dark:border-blue-800/50">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-on-surface font-bold text-sm">{row.provider}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-mono text-xs font-bold text-on-surface">{row.index.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-on-surface">
                    {row.cost.toFixed(2)} <span className="text-[9px] opacity-40">RON</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-on-surface-variant hover:text-on-surface opacity-0 group-hover:opacity-100 transition-all">
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RawData;
