import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, CheckCircle, Clock, Loader2, Search, Filter, MoreVertical, X } from 'lucide-react';
import api from '../utils/api';

interface Invoice {
  id: number;
  provider: { name: string };
  location: { name: string };
  billing_date: string;
  amount: number;
  status: string;
}

interface Location { id: number; name: string; }
interface Provider { id: number; name: string; }

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

  const fetchInvoices = async () => {
    try {
      const [invRes, locRes, provRes] = await Promise.all([
        api.get('/invoices/'),
        api.get('/locations/'),
        api.get('/providers/')
      ]);
      setInvoices(invRes.data);
      setLocations(locRes.data);
      setProviders(provRes.data);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !selectedProvider || !fileInputRef.current?.files?.[0]) {
      alert('Please fill all fields and select a PDF file.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('location_id', selectedLocation);
    formData.append('provider_id', selectedProvider);
    formData.append('file', fileInputRef.current.files[0]);

    try {
      const response = await api.post('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setInvoices([response.data, ...invoices]);
      setShowUpload(false);
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedLocation('');
    setSelectedProvider('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
        >
          <Upload size={20} />
          <span>Upload Document</span>
        </button>
      </header>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline text-xl font-black text-on-surface">Document Ingestion</h3>
              <button onClick={() => setShowUpload(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Asset Location</label>
                <select 
                  required
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select Location...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Service Provider</label>
                <select 
                  required
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select Provider...</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">PDF File</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".pdf"
                  required
                  className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
                />
              </div>

              <button 
                type="submit"
                disabled={uploading}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    <Upload size={20} />
                    <span className="uppercase tracking-[0.1em] text-sm">Analyze & Import</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        {/* Table structure remains the same but handles real data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant">
                <th className="px-8 py-5">Service Provider</th>
                <th className="px-8 py-5">Asset Location</th>
                <th className="px-8 py-5 text-center">Billing Date</th>
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
                      <span className="font-headline font-bold text-on-surface">{invoice.provider?.name || 'Unknown'}</span>
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
