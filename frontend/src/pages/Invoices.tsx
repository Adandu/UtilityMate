import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Clock, Loader2, MoreVertical, X, Edit, CheckCircle, AlertTriangle, ArrowUp, ArrowDown, Square, CheckSquare, Plus } from 'lucide-react';
import api from '../utils/api';
import { useSortableData } from '../hooks/useSortableData';
import { useNavigate } from 'react-router-dom';

interface Invoice {
  id: number;
  provider_id: number;
  location_id: number;
  provider: { name: string, category: { name: string, unit: string } };
  location: { name: string };
  invoice_date: string;
  amount: number;
  consumption_value?: number;
}

interface Location { id: number; name: string; }
interface Provider { id: number; name: string; }

interface UploadResult {
  filename: string;
  status: 'success' | 'error';
  detail?: string;
  id?: number;
}

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLocation, setSelectedLocation] = useState('');

  // Form states
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editConsumption, setEditConsumption] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editProvider, setEditProvider] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const invRes = await api.get('/invoices/');
      setInvoices(invRes.data);
    } catch (error) { console.error('Failed to fetch invoices', error); }

    try {
      const locRes = await api.get('/locations/');
      setLocations(locRes.data);
    } catch (error) { console.error('Failed to fetch locations', error); }

    try {
      const provRes = await api.get('/providers/');
      setProviders(provRes.data);
    } catch (error) { console.error('Failed to fetch providers', error); }
    
    setLoading(false);
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

  const { items: sortedInvoices, requestSort, sortConfig } = useSortableData(invoices, { key: 'invoice_date', direction: 'descending' });

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(inv => inv.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      setInvoices(invoices.filter(inv => inv.id !== id));
      setSelectedIds(selectedIds.filter(i => i !== id));
      setActiveMenuId(null);
    } catch (error) {
      alert('Failed to delete invoice');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected invoices?`)) return;
    try {
      setUploading(true);
      await api.delete('/invoices/bulk', { data: selectedIds });
      setInvoices(invoices.filter(inv => !selectedIds.includes(inv.id)));
      setSelectedIds([]);
    } catch (error) {
      alert('Bulk deletion failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!selectedLocation || !files || files.length === 0) {
      alert('Please select a location and at least one PDF file.');
      return;
    }

    setUploading(true);
    setUploadResults(null);
    const formData = new FormData();
    formData.append('location_id', selectedLocation);
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await api.post('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResults(response.data);
      if (response.data.some((r: any) => r.status === 'success')) {
        await fetchInvoices();
      }
    } catch (error: any) {
      console.error('Upload Error:', error);
      let errorMsg = 'Upload failed';
      if (error.response?.status === 413) {
        errorMsg = 'Upload batch is too large for the server. Try uploading fewer files at once.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.message) {
        errorMsg = error.message;
      }
      alert(errorMsg);
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

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setUploading(true);
    const updates: any = {};
    if (editDate) updates.invoice_date = editDate;
    if (editAmount) updates.amount = parseFloat(editAmount);
    if (editConsumption) updates.consumption_value = parseFloat(editConsumption);
    if (editLocation) updates.location_id = parseInt(editLocation);
    if (editProvider) updates.provider_id = parseInt(editProvider);

    try {
      await api.patch('/invoices/bulk', { 
        invoice_ids: selectedIds,
        update_data: updates 
      });
      await fetchInvoices();
      setShowBulkEdit(false);
      setSelectedIds([]);
    } catch (error: any) {
      alert('Bulk update failed');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedLocation('');
    setEditDate('');
    setEditAmount('');
    setEditConsumption('');
    setEditLocation('');
    setEditProvider('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadResults(null);
  };

  if (loading && invoices.length === 0) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 text-on-surface">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Invoice Ledger</h2>
          <p className="text-on-surface-variant font-medium opacity-70">Bulk management and automated provider detection.</p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => { resetForm(); setShowUpload(true); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-[1.02] active:scale-95"
          >
            <Upload size={20} />
            <span>Bulk Upload</span>
          </button>
        </div>
      </header>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-on-surface text-surface px-8 py-4 rounded-3xl shadow-2xl z-40 flex items-center gap-8 animate-in slide-in-from-bottom-10 duration-300">
          <div className="flex items-center gap-2 border-r border-surface/20 pr-8">
            <span className="text-sm font-black uppercase tracking-widest">{selectedIds.length} Selected</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { resetForm(); setShowBulkEdit(true); }}
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors font-bold uppercase tracking-widest text-xs"
            >
              <Edit size={18} /> Modify
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 hover:text-error transition-colors font-bold uppercase tracking-widest text-xs"
            >
              <Trash2 size={18} /> Delete
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              className="ml-4 p-1 hover:bg-surface/10 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low text-on-surface">
              <h3 className="font-headline text-xl font-black">Bulk Modification</h3>
              <button onClick={() => setShowBulkEdit(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleBulkUpdate} className="p-8 space-y-4">
              <p className="text-xs text-on-surface-variant font-medium mb-4 italic text-on-surface">Only fields you fill will be updated for all {selectedIds.length} selected invoices.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Location</label>
                  <select 
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface"
                  >
                    <option value="">Keep original</option>
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
                    <option value="">Keep original</option>
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
                    placeholder="Keep original"
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
                    placeholder="Keep original"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowBulkEdit(false)} className="flex-1 py-4 bg-surface-container text-on-surface font-black rounded-2xl border border-outline-variant uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-2 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 px-8 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20} /><span className="uppercase tracking-[0.1em] text-sm">Update All</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low text-on-surface">
              <h3 className="font-headline text-xl font-black">Invoice Ingestion</h3>
              <button onClick={() => setShowUpload(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8">
              {!uploadResults ? (
                <form onSubmit={handleUpload} className="space-y-6">
                  <div className="space-y-2 text-on-surface">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Asset Location</label>
                    <select 
                      required
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium appearance-none"
                    >
                      <option value="">Select Location for these invoices...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Select PDF Documents</label>
                    <div className="border-2 border-dashed border-outline-variant rounded-2xl p-8 text-center hover:border-emerald-500/50 transition-colors">
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".pdf"
                        multiple
                        required
                        className="hidden"
                        id="bulk-file-upload"
                      />
                      <label htmlFor="bulk-file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload size={40} className="text-on-surface-variant opacity-40" />
                        <span className="text-sm font-bold text-on-surface">Click to select multiple invoices</span>
                        <span className="text-[10px] text-on-surface-variant uppercase tracking-widest">Automatic provider detection enabled</span>
                      </label>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={uploading}
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="animate-spin" size={20} /> : (
                      <>
                        <Upload size={20} />
                        <span className="uppercase tracking-[0.1em] text-sm">Process & Import</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-surface-container rounded-2xl overflow-hidden border border-outline-variant text-on-surface">
                    <div className="max-h-[40vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-container-low border-b border-outline-variant sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 font-black uppercase tracking-widest opacity-50">File</th>
                            <th className="px-4 py-3 font-black uppercase tracking-widest opacity-50">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30">
                          {uploadResults.map((res, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-bold truncate max-w-[200px]">{res.filename}</td>
                              <td className="px-4 py-3">
                                {res.status === 'success' ? (
                                  <span className="text-emerald-500 font-black flex items-center gap-1 uppercase tracking-tighter">
                                    <CheckCircle size={14} /> OK
                                  </span>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="text-error flex items-start gap-1">
                                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                      <span className="font-medium leading-tight">{res.detail}</span>
                                    </div>
                                    {res.detail?.includes('identify utility provider') && (
                                      <button 
                                        onClick={() => navigate('/config')}
                                        className="flex items-center gap-1 px-2 py-1 bg-surface-container-high rounded-lg text-[9px] font-black uppercase tracking-widest text-on-surface hover:bg-on-surface hover:text-surface transition-all"
                                      >
                                        <Plus size={10} /> Add Provider
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowUpload(false)}
                    className="w-full py-4 bg-on-surface text-surface font-black rounded-2xl uppercase tracking-widest text-xs"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Single Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low text-on-surface">
              <div className="flex items-center gap-3">
                <Edit className="text-blue-500" size={24} />
                <h3 className="font-headline text-xl font-black">Modify Invoice</h3>
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
                <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-4 bg-surface-container text-on-surface font-black rounded-2xl border border-outline-variant uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-2 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 px-8 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  {uploading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle size={20} /><span className="uppercase tracking-[0.1em] text-sm">Save Changes</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-3xl border border-outline-variant shadow-sm overflow-hidden text-on-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em] border-b border-outline-variant">
                <th className="px-6 py-5 w-10">
                  <button onClick={toggleSelectAll} className="p-1 hover:bg-surface-container-high rounded-lg transition-colors">
                    {selectedIds.length === invoices.length && invoices.length > 0 ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-5 cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('provider.name')}>
                  <div className="flex items-center gap-1">Service Provider {getSortIcon('provider.name')}</div>
                </th>
                <th className="px-8 py-5 cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('location.name')}>
                  <div className="flex items-center gap-1">Asset Location {getSortIcon('location.name')}</div>
                </th>
                <th className="px-8 py-5 text-center cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('invoice_date')}>
                  <div className="flex items-center gap-1 justify-center">Invoice Date {getSortIcon('invoice_date')}</div>
                </th>
                <th className="px-8 py-5 text-right cursor-pointer hover:text-on-surface transition-colors" onClick={() => requestSort('amount')}>
                  <div className="flex items-center gap-1 justify-end">Settlement Amount {getSortIcon('amount')}</div>
                </th>
                <th className="px-8 py-5 text-right pr-12">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {sortedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-30">
                      <FileText size={64} strokeWidth={1} className="mb-4" />
                      <p className="font-headline text-lg font-bold">No Records Found</p>
                      <p className="text-sm font-medium">Your utility history will appear here once uploaded.</p>
                    </div>
                  </td>
                </tr>
              ) : sortedInvoices.map((invoice) => (
                <tr key={invoice.id} className={`hover:bg-surface-container-high/30 transition-colors group ${selectedIds.includes(invoice.id) ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                  <td className="px-6 py-6">
                    <button onClick={() => toggleSelectOne(invoice.id)} className="p-1 hover:bg-surface-container-high rounded-lg transition-colors">
                      {selectedIds.includes(invoice.id) ? <CheckSquare size={18} className="text-emerald-500" /> : <Square size={18} className="opacity-30 group-hover:opacity-100" />}
                    </button>
                  </td>
                  <td className="px-4 py-6">
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
