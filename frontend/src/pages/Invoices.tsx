import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, CheckCircle, Clock, Loader2, Search, Filter, MoreVertical } from 'lucide-react';
import api from '../utils/api';

interface Invoice {
  id: number;
  provider: { name: string };
  location: { name: string };
  billing_date: string;
  amount: number;
  status: string;
}

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchInvoices = async () => {
    try {
      const response = await api.get('/invoices/');
      setInvoices(response.data);
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      setInvoices(invoices.filter(inv => inv.id !== id));
    } catch (error) {
      alert('Failed to delete invoice');
    }
  };

  if (loading) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface">Invoice Ledger</h2>
          <p className="text-on-surface-variant font-medium opacity-70">Surgical management of your utility documentation.</p>
        </div>
        
        <button 
          onClick={() => alert('Implementation pending: Upload Modal')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
        >
          <Upload size={20} />
          <span>Upload Document</span>
        </button>
      </header>

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex flex-col md:flex-row gap-4 justify-between bg-surface-container-lowest/50">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-50" size={18} />
            <input 
              type="text" 
              placeholder="Search by provider, location, or date..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-outline-variant text-on-surface-variant font-bold hover:bg-surface-container transition-colors">
              <Filter size={18} />
              <span className="text-xs uppercase tracking-widest">Filter</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant">
                <th className="px-8 py-5">Service Provider</th>
                <th className="px-8 py-5">Asset Location</th>
                <th className="px-8 py-5 text-center">Billing Cycle</th>
                <th className="px-8 py-5 text-right">Settlement Amount</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <FileText size={64} strokeWidth={1} className="mb-4" />
                      <p className="font-headline text-lg font-bold">No Records Found</p>
                      <p className="text-sm font-medium">Your utility history will appear here once uploaded.</p>
                    </div>
                  </td>
                </tr>
              ) : invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-surface-container-high/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-blue-600">
                        <FileText size={20} />
                      </div>
                      <span className="font-headline font-bold text-on-surface">{invoice.provider?.name || 'Unknown Provider'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-on-surface-variant font-bold text-sm tracking-tight">{invoice.location?.name || 'N/A'}</td>
                  <td className="px-8 py-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-lg text-[11px] font-bold text-on-surface-variant border border-outline-variant">
                      <Clock size={12} />
                      {invoice.billing_date}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="font-black text-on-surface text-lg">{invoice.amount.toFixed(2)} <span className="text-[10px] opacity-40 font-bold uppercase">RON</span></div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      invoice.status === 'paid' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {invoice.status === 'paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-on-surface-variant hover:text-emerald-500 transition-colors">
                        <FileText size={20} />
                      </button>
                      <button 
                        onClick={() => handleDelete(invoice.id)}
                        className="p-2 text-on-surface-variant hover:text-error transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                      <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
                        <MoreVertical size={20} />
                      </button>
                    </div>
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

export default Invoices;
