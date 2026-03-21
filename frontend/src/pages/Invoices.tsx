import React, { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, CheckCircle, Clock, Loader2 } from 'lucide-react';
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
  const [isUploading, setIsUploading] = useState(false);
  
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

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices</h2>
          <p className="text-gray-500 dark:text-gray-400">Upload and manage your utility bills.</p>
        </div>
        
        <button 
          onClick={() => alert('Implementation pending: Upload Modal')}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition transform hover:scale-[1.02]"
        >
          <Upload size={20} />
          <span>Upload New Invoice</span>
        </button>
      </header>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-sm font-semibold uppercase tracking-wider">
              <th className="px-6 py-4">Provider</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Billing Date</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No invoices found. Start by uploading one!</td></tr>
            ) : invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3 text-gray-900 dark:text-white font-medium">
                    <FileText size={18} className="text-blue-500" />
                    <span>{invoice.provider?.name || 'Unknown'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{invoice.location?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{invoice.billing_date}</td>
                <td className="px-6 py-4 text-gray-900 dark:text-white font-bold">{invoice.amount.toFixed(2)} RON</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    invoice.status === 'paid' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {invoice.status === 'paid' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    <span>{invoice.status}</span>
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                      <FileText size={20} />
                    </button>
                    <button 
                      onClick={() => handleDelete(invoice.id)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invoices;
