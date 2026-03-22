import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, ChevronRight, Loader2, Database, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../utils/api';
import { useSortableData } from '../hooks/useSortableData';

interface InvoiceData {
  id: number;
  invoice_date: string;
  location: { name: string };
  provider: { name: string, category: { name: string } };
  consumption_value: number;
  amount: number;
}

const RawData: React.FC = () => {
  const [data, setData] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const response = await api.get('/invoices/');
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch raw data', error);
        setError('Failed to load data from server.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = data.filter(row => 
    row.provider?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.location?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.provider?.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { items: sortedData, requestSort, sortConfig } = useSortableData(filteredData, { key: 'invoice_date', direction: 'descending' });

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  if (loading) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  const handleExport = () => {
    if (error) {
      alert('Cannot export: ' + error);
      return;
    }
    if (sortedData.length === 0) {
      alert('No data available to export.');
      return;
    }
    
    try {
      const headers = ['Invoice Date', 'Location', 'Category', 'Provider', 'Consumption', 'Amount', 'Currency'];
      const csvContent = [
        headers.join(','),
        ...sortedData.map(row => [
          row.invoice_date,
          `"${row.location?.name || 'N/A'}"`,
          `"${row.provider?.category?.name || 'N/A'}"`,
          `"${row.provider?.name || 'N/A'}"`,
          row.consumption_value,
          row.amount,
          'RON'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `utilitymate_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to generate export file.');
    }
  };

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 text-on-surface">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Data Warehouse</h2>
          <p className="text-on-surface-variant font-medium opacity-70">Low-level analytical view of all processed utility records.</p>
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-8 py-3 rounded-2xl font-bold shadow-sm hover:bg-secondary-fixed transition-all active:scale-95"
        >
          <Download size={20} />
          <span className="uppercase tracking-widest text-xs">Export Dataset</span>
        </button>
      </header>

      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-2xl border border-error/20 flex items-center gap-3">
          <Database size={20} />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden text-on-surface">
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
                <th className="px-6 py-4 cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('invoice_date')}>
                  <div className="flex items-center gap-1">Invoice Date {getSortIcon('invoice_date')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('location.name')}>
                  <div className="flex items-center gap-1">Context {getSortIcon('location.name')}</div>
                </th>
                <th className="px-6 py-4 text-center cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('provider.category.name')}>
                  <div className="flex items-center gap-1 justify-center">Category {getSortIcon('provider.category.name')}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('provider.name')}>
                  <div className="flex items-center gap-1">Source {getSortIcon('provider.name')}</div>
                </th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('consumption_value')}>
                  <div className="flex items-center gap-1 justify-end">Consumption {getSortIcon('consumption_value')}</div>
                </th>
                <th className="px-6 py-4 text-right cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('amount')}>
                  <div className="flex items-center gap-1 justify-end">Settlement {getSortIcon('amount')}</div>
                </th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <Database size={64} strokeWidth={1} className="mb-4" />
                      <p className="font-headline text-lg font-bold">Warehouse Empty</p>
                      <p className="text-sm font-medium">No utility records found in the database.</p>
                    </div>
                  </td>
                </tr>
              ) : sortedData.map((row) => (
                <tr key={row.id} className="hover:bg-surface-container-high/30 transition-colors group">
                  <td className="px-6 py-5 font-mono text-[11px] text-on-surface-variant">{row.invoice_date}</td>
                  <td className="px-6 py-5">
                    <span className="font-black text-on-surface tracking-tight uppercase text-xs">{row.location?.name || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-200/50 dark:border-blue-800/50">
                      {row.provider?.category?.name || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-on-surface font-bold text-sm">{row.provider?.name || 'N/A'}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-mono text-xs font-bold text-on-surface">{(row.consumption_value ?? 0).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-on-surface">
                    {row.amount.toFixed(2)} <span className="text-[9px] opacity-40">RON</span>
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
