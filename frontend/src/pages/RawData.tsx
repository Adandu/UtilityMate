import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Database, Download, Loader2, Search } from 'lucide-react';
import api from '../utils/api';
import { useSortableData } from '../hooks/useSortableData';

interface InvoiceData {
  id: number;
  invoice_date: string;
  due_date?: string | null;
  location?: { name: string };
  provider?: { name: string; category?: { name: string } };
  consumption_value?: number | null;
  amount: number;
  status: string;
  parse_confidence: number;
}

const RawData: React.FC = () => {
  const [data, setData] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/invoices/').then((response) => setData(response.data)).finally(() => setLoading(false));
  }, []);

  const filteredData = data.filter((row) =>
    [row.provider?.name, row.location?.name, row.provider?.category?.name, row.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const { items: sortedData, requestSort, sortConfig } = useSortableData(filteredData, { key: 'invoice_date', direction: 'descending' });

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const handleExport = async () => {
    const response = await api.get('/invoices/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `utilitymate_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Data Warehouse</h2>
          <p className="text-on-surface-variant opacity-70">Deep invoice records, workflow state, parser confidence, and export-ready operations data.</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white dark:bg-white dark:text-slate-900">
          <Download size={18} /> Export CSV
        </button>
      </header>

      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
          <Search size={18} className="opacity-50" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search provider, location, category, workflow..." className="w-full bg-transparent outline-none" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('invoice_date')}>Date {getSortIcon('invoice_date')}</th>
                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('location.name')}>Location {getSortIcon('location.name')}</th>
                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('provider.category.name')}>Category {getSortIcon('provider.category.name')}</th>
                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('provider.name')}>Provider {getSortIcon('provider.name')}</th>
                <th className="px-4 py-4 cursor-pointer text-right" onClick={() => requestSort('amount')}>Amount {getSortIcon('amount')}</th>
                <th className="px-4 py-4 cursor-pointer" onClick={() => requestSort('status')}>Workflow {getSortIcon('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30"><Database size={64} strokeWidth={1} className="mb-4" /><p className="font-headline text-lg font-bold">Warehouse Empty</p></div>
                  </td>
                </tr>
              ) : sortedData.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 text-sm">{row.invoice_date}{row.due_date ? ` • due ${row.due_date}` : ''}</td>
                  <td className="px-4 py-4 font-bold">{row.location?.name || 'N/A'}</td>
                  <td className="px-4 py-4">{row.provider?.category?.name || 'N/A'}</td>
                  <td className="px-4 py-4">{row.provider?.name || 'N/A'}</td>
                  <td className="px-4 py-4 text-right font-black">{row.amount.toFixed(2)} RON</td>
                  <td className="px-4 py-4">
                    <div className="font-black uppercase text-[10px]">{row.status}</div>
                    <div className="text-xs opacity-50">{Math.round((row.parse_confidence ?? 0) * 100)}% parse confidence</div>
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
