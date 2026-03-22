import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Clock, Loader2, MoreVertical, X, Edit, AlertCircle } from 'lucide-react';
import api from '../utils/api';

interface Invoice {
  id: number;
  provider_id: number;
  location_id: number;
  provider: { name: string };
  location: { name: string };
  invoice_date: string;
  amount: number;
  consumption_value?: number;
}

interface Location { id: number; name: string; }
interface Provider { id: number; name: string; }

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');

  // Edit form state
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editConsumption, setEditConsumption] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editProvider, setEditProvider] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

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
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      setInvoices(invoices.filter(inv => inv.id !== id));
      setActiveMenuId(null);
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

  const handleEditClick = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setEditDate(invoice.invoice_date);
    setEditAmount(invoice.amount.toString());
    setEditConsumption(invoice.consumption_value?.toString() || '');
    setEditLocation(invoice.location_id.toString());
    setEditProvider(invoice.provider_id.toString());
    setShowEdit(true);
    setActiveMenuId(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setUploading(true);
    try {
      const response = await api.patch(`/invoices/${editingInvoice.id}`, {
        invoice_date: editDate,
        amount: parseFloat(editAmount),
        consumption_value: editConsumption ? parseFloat(editConsumption) : null,
        location_id: parseInt(editLocation),
        provider_id: parseInt(editProvider)
      });
      
      setInvoices(invoices.map(inv => inv.id === editingInvoice.id ? response.data : inv));
      setShowEdit(false);
      setEditingInvoice(null);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Update failed');
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

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <div className="flex items-center gap-3">
                <Edit className="text-blue-500" size={24} />
                <h3 className="font-headline text-xl font-black text-on-surface">Modify Invoice</h3>
              </div>
              <button onClick={() => setShowEdit(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Location</label>
                  <select 
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
                  >
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Provider</label>
                  <select 
                    value={editProvider}
                    onChange={(e) => setEditProvider(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
                  >
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Invoice Date</label>
                <input 
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Amount (RON)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Consumption</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editConsumption}
                    onChange={(e) => setEditConsumption(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface font-mono"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 py-4 bg-surface-container text-on-surface font-black rounded-2xl border border-outline-variant uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className="flex-2 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 px-8 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      <CheckCircle size={20} />
                      <span className="uppercase tracking-[0.1em] text-sm">Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant">
                <th className="px-8 py-5">Service Provider</th>
                <th className="px-8 py-5">Asset Location</th>
                <th className="px-8 py-5 text-center">Invoice Date</th>
                <th className="px-8 py-5 text-right">Settlement Amount</th>
                <th className="px-8 py-5 text-right pr-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
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
                      {invoice.invoice_date}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="font-black text-on-surface text-lg">{invoice.amount.toFixed(2)} <span className="text-[10px] opacity-40 font-bold uppercase">RON</span></div>
                  </td>
                  <td className="px-8 py-6 text-right pr-8 relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === invoice.id ? null : invoice.id)}
                      className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-full hover:bg-surface-container-high"
                    >
                      <MoreVertical size={20} />
                    </button>

                    {activeMenuId === invoice.id && (
                      <div 
                        ref={menuRef}
                        className="absolute right-12 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 border border-outline-variant rounded-2xl shadow-xl z-10 py-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                      >
                        <button 
                          onClick={() => handleEditClick(invoice)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
                        >
                          <Edit size={16} className="text-blue-500" />
                          Modify Record
                        </button>
                        <div className="h-px bg-outline-variant/30 my-1 mx-2"></div>
                        <button 
                          onClick={() => handleDelete(invoice.id)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-bold text-error hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                          <Trash2 size={16} />
                          Delete Permanently
                        </button>
                      </div>
                    )}
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
