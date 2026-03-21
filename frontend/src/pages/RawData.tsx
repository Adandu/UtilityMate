import React, { useState, useEffect } from 'react';
import { Search, Download, Filter } from 'lucide-react';

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Raw Data Explorer</h2>
          <p className="text-gray-500 dark:text-gray-400">Search and export all historical records.</p>
        </div>
        
        <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition transform hover:scale-[1.02]">
          <Download size={20} />
          <span>Export CSV</span>
        </button>
      </header>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by provider, location, or category..."
              className="w-full pl-11 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center space-x-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            <Filter size={20} />
            <span>Filters</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Index Value</th>
                <th className="px-4 py-3">Total Cost</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition text-sm">
                  <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{row.date}</td>
                  <td className="px-4 py-4 text-gray-900 dark:text-white font-medium">{row.location}</td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs font-bold">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{row.provider}</td>
                  <td className="px-4 py-4 text-gray-900 dark:text-white font-mono">{row.index}</td>
                  <td className="px-4 py-4 text-gray-900 dark:text-white font-bold">{row.cost.toFixed(2)} RON</td>
                  <td className="px-4 py-4 text-right text-gray-500">{(row.cost / row.index).toFixed(4)}</td>
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
