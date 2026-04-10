import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit3, Eye, FileWarning, Loader2, Square, CheckSquare, Trash2, Upload, X } from 'lucide-react';
import api from '../utils/api';

interface Invoice {
  id: number;
  provider_id: number;
  location_id: number;
  provider?: { id: number; name: string; category?: { name: string; unit: string } };
  location?: { id: number; name: string };
  invoice_date: string;
  due_date?: string | null;
  amount: number;
  currency: string;
  consumption_value?: number | null;
  status: string;
  paid_at?: string | null;
  payment_reference?: string | null;
  parse_confidence: number;
  needs_review: boolean;
  review_notes?: string | null;
  source_name?: string | null;
}

interface Location {
  id: number;
  name: string;
}

interface Provider {
  id: number;
  name: string;
  category_id: number;
}

interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  skip: number;
  limit: number;
}

interface UploadResult {
  filename: string;
  status: 'success' | 'error';
  detail?: string;
  id?: number;
  provider_name?: string;
  invoice_date?: string;
  amount?: number;
  currency?: string;
  parse_confidence?: number;
  needs_review?: boolean;
}

const statusOptions = ['received', 'reviewed', 'scheduled', 'paid', 'overdue'];
const pageSizeOptions = [25, 50, 100, 200];

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editStatus, setEditStatus] = useState('received');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [editReviewNotes, setEditReviewNotes] = useState('');
  const [editNeedsReview, setEditNeedsReview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('reviewed');
  const [filterLocationId, setFilterLocationId] = useState('all');
  const [filterProviderId, setFilterProviderId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadSummary = useMemo(() => ({
    success: uploadResults.filter((result) => result.status === 'success').length,
    error: uploadResults.filter((result) => result.status === 'error').length,
    needsReview: uploadResults.filter((result) => result.status === 'success' && result.needs_review).length,
  }), [uploadResults]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalInvoices / pageSize)), [pageSize, totalInvoices]);
  const pageInvoiceIds = useMemo(() => invoices.map((invoice) => invoice.id), [invoices]);
  const selectedOnPageCount = useMemo(() => pageInvoiceIds.filter((invoiceId) => selectedIds.includes(invoiceId)).length, [pageInvoiceIds, selectedIds]);
  const allOnPageSelected = pageInvoiceIds.length > 0 && selectedOnPageCount === pageInvoiceIds.length;
  const visibleRangeStart = totalInvoices === 0 ? 0 : (page - 1) * pageSize + 1;
  const visibleRangeEnd = totalInvoices === 0 ? 0 : Math.min(page * pageSize, totalInvoices);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
      };
      if (filterLocationId !== 'all') {
        params.location_id = filterLocationId;
      }
      if (filterProviderId !== 'all') {
        params.provider_id = filterProviderId;
      }
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const [invoiceRes, locationRes, providerRes] = await Promise.all([
        api.get<InvoiceListResponse>('/invoices/', { params }),
        api.get<Location[]>('/locations/'),
        api.get<Provider[]>('/providers/'),
      ]);

      const maxPage = Math.max(1, Math.ceil(invoiceRes.data.total / pageSize));
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }

      setInvoices(invoiceRes.data.items);
      setTotalInvoices(invoiceRes.data.total);
      setLocations(locationRes.data);
      setProviders(providerRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, filterLocationId, filterProviderId, filterStatus]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!selectedLocation || !files?.length) {
      return;
    }
    const formData = new FormData();
    formData.append('location_id', selectedLocation);
    Array.from(files).forEach((file) => formData.append('files', file));
    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');
    setUploadResults([]);
    try {
      const response = await api.post<UploadResult[]>('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
          setUploadPhase(progress >= 100 ? 'processing' : 'uploading');
        },
      });
      setUploadProgress(100);
      setUploadPhase('complete');
      setUploadResults(response.data);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch {
      setUploadPhase('complete');
      setUploadResults([{ filename: 'Bulk upload', status: 'error', detail: 'Upload failed before the server could finish processing the files.' }]);
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setShowUpload(false);
    setSelectedLocation('');
    setUploadProgress(0);
    setUploadPhase('idle');
    setUploadResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEdit = (invoice: Invoice) => {
    setEditing(invoice);
    setEditStatus(invoice.status);
    setEditDueDate(invoice.due_date || '');
    setEditPaymentReference(invoice.payment_reference || '');
    setEditReviewNotes(invoice.review_notes || '');
    setEditNeedsReview(invoice.needs_review);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await api.patch(`/invoices/${editing.id}`, {
      status: editStatus,
      due_date: editDueDate || null,
      payment_reference: editPaymentReference || null,
      review_notes: editReviewNotes || null,
      needs_review: editNeedsReview,
    });
    setEditing(null);
    await fetchData();
  };

  const viewPdf = async (invoiceId: number) => {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleSelect = (invoiceId: number) => {
    setSelectedIds((current) => current.includes(invoiceId) ? current.filter((id) => id !== invoiceId) : [...current, invoiceId]);
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allOnPageSelected) {
        return current.filter((id) => !pageInvoiceIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageInvoiceIds]));
    });
  };

  const applyBulkStatus = async () => {
    if (selectedIds.length === 0) return;
    await api.patch('/invoices/bulk', {
      invoice_ids: selectedIds,
      update_data: {
        status: bulkStatus,
        needs_review: bulkStatus === 'reviewed' || bulkStatus === 'paid' ? false : undefined,
      },
    });
    setSelectedIds([]);
    await fetchData();
  };

  const deleteInvoice = async (invoiceId: number) => {
    if (!window.confirm('Delete this invoice and its stored PDF?')) return;
    await api.delete(`/invoices/${invoiceId}`);
    setSelectedIds((current) => current.filter((id) => id !== invoiceId));
    await fetchData();
  };

  const bulkDeleteInvoices = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected invoice${selectedIds.length === 1 ? '' : 's'} and their stored PDFs?`)) return;
    await api.delete('/invoices/bulk', { data: selectedIds });
    setSelectedIds([]);
    await fetchData();
  };

  if (loading) {
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Invoice Review Desk</h2>
          <p className="text-on-surface-variant opacity-70">Browse, filter, and review invoices over time while keeping PDF access and bulk workflow tools close at hand.</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">
          <Upload size={18} /> Upload Invoices
        </button>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 rounded-3xl border border-outline-variant bg-surface-container-low p-4 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">Location</span>
          <select value={filterLocationId} onChange={(e) => { setFilterLocationId(e.target.value); setPage(1); }} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
            <option value="all">All Locations</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">Provider</span>
          <select value={filterProviderId} onChange={(e) => { setFilterProviderId(e.target.value); setPage(1); }} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
            <option value="all">All Providers</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">Status</span>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
            <option value="all">All Statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">Rows per Page</span>
          <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }} className="w-full rounded-xl border border-outline-variant bg-surface-container p-3">
            {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <div className="w-full rounded-2xl border border-outline-variant bg-surface-container p-3 text-sm font-bold">
            Showing {visibleRangeStart}-{visibleRangeEnd} of {totalInvoices}
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:flex-row md:items-center md:justify-between">
          <p className="font-black">{selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button onClick={applyBulkStatus} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Apply Status</button>
            <button onClick={bulkDeleteInvoices} className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white">Delete Selected</button>
            <button onClick={() => setSelectedIds([])} className="rounded-xl border border-outline-variant px-4 py-3 font-bold">Clear</button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                <th className="px-4 py-4">
                  <button onClick={toggleSelectAll} className="rounded-lg p-1">
                    {allOnPageSelected ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-4">Provider</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Amount</th>
                <th className="px-4 py-4">Consumption</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Review</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className={selectedIds.includes(invoice.id) ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleSelect(invoice.id)} className="rounded-lg p-1">
                      {selectedIds.includes(invoice.id) ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} className="opacity-50" />}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-black">{invoice.provider?.name || 'Unknown provider'}</p>
                    <p className="text-xs opacity-50">{invoice.provider?.category?.name || 'Unknown category'}</p>
                  </td>
                  <td className="px-4 py-4 font-bold">{invoice.location?.name || 'N/A'}</td>
                  <td className="px-4 py-4 text-sm">{invoice.invoice_date}{invoice.due_date ? ` • due ${invoice.due_date}` : ''}</td>
                  <td className="px-4 py-4 font-black">{invoice.amount.toFixed(2)} {invoice.currency}</td>
                  <td className="px-4 py-4 font-bold">
                    {typeof invoice.consumption_value === 'number'
                      ? `${invoice.consumption_value.toFixed(3)} ${invoice.provider?.category?.unit || ''}`.trim()
                      : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : invoice.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {invoice.status}
                    </span>
                    {invoice.payment_reference && <p className="mt-1 text-xs opacity-50">Ref: {invoice.payment_reference}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {invoice.needs_review ? <FileWarning size={16} className="text-amber-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                      <span className="text-sm font-bold">{Math.round(invoice.parse_confidence * 100)}%</span>
                    </div>
                    {invoice.review_notes && <p className="mt-1 max-w-xs text-xs opacity-50">{invoice.review_notes}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => viewPdf(invoice.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(invoice)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-900">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => deleteInvoice(invoice.id)} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black uppercase text-white">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm font-bold opacity-60">
                    No invoices match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-outline-variant pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium opacity-70">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-outline-variant px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40">
              Previous
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-xl border border-outline-variant px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-outline-variant bg-white p-8 dark:bg-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-headline text-xl font-black">Upload Invoices</h3>
              <button onClick={closeUploadModal}><X size={22} /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <select required value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-4">
                <option value="">Select Location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <input ref={fileInputRef} type="file" accept=".pdf" multiple required className="w-full rounded-xl border border-outline-variant bg-surface-container p-4" />
              {(uploading || uploadResults.length > 0) && (
                <div className="rounded-2xl border border-outline-variant bg-slate-50 p-4 dark:bg-slate-900/40">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {uploadPhase === 'uploading' && 'Uploading PDFs...'}
                        {uploadPhase === 'processing' && 'Upload complete. Parsing invoices...'}
                        {uploadPhase === 'complete' && 'Bulk upload finished'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {uploadPhase === 'complete'
                          ? `${uploadSummary.success} imported, ${uploadSummary.error} failed, ${uploadSummary.needsReview} need review`
                          : 'Stay on this screen while UtilityMate validates and parses each invoice.'}
                      </p>
                    </div>
                    {uploading && <Loader2 className="animate-spin text-emerald-500" size={18} />}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.max(uploadProgress, uploading ? 8 : 0)}%` }} />
                  </div>
                  <p className="mt-2 text-right text-xs font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-300">
                    {uploadPhase === 'processing' ? 'Processing on server' : `${uploadProgress}%`}
                  </p>
                </div>
              )}
              {uploadResults.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{uploadSummary.success} succeeded</span>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{uploadSummary.error} failed</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{uploadSummary.needsReview} need review</span>
                  </div>
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {uploadResults.map((result, index) => (
                      <div key={`${result.filename}-${index}`} className="rounded-2xl border border-outline-variant bg-white p-4 dark:bg-slate-900/30">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{result.filename}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-300">{result.detail || (result.status === 'success' ? 'Imported successfully' : 'Import failed')}</p>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${result.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {result.status}
                          </div>
                        </div>
                        {result.status === 'success' ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-200">
                            {result.provider_name && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{result.provider_name}</span>}
                            {result.invoice_date && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{result.invoice_date}</span>}
                            {typeof result.amount === 'number' && <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{result.amount.toFixed(2)} {result.currency || 'RON'}</span>}
                            {typeof result.parse_confidence === 'number' && (
                              <span className={`rounded-full px-3 py-1 ${result.needs_review ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {Math.round(result.parse_confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-700">
                            <AlertCircle size={14} />
                            Fix the file or provider setup and try this PDF again.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button disabled={uploading} className="w-full rounded-xl bg-emerald-600 py-4 font-black text-white">
                {uploading ? 'Uploading...' : uploadResults.length > 0 ? 'Import More PDFs' : 'Import PDFs'}
              </button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-outline-variant bg-white p-8 dark:bg-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-headline text-xl font-black">Update Invoice Workflow</h3>
              <button onClick={() => setEditing(null)}><X size={22} /></button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-4">
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-4" />
              <input value={editPaymentReference} onChange={(e) => setEditPaymentReference(e.target.value)} placeholder="Payment reference / bank note" className="w-full rounded-xl border border-outline-variant bg-surface-container p-4" />
              <textarea value={editReviewNotes} onChange={(e) => setEditReviewNotes(e.target.value)} placeholder="Review notes, parser corrections, escalation details..." className="min-h-32 w-full rounded-xl border border-outline-variant bg-surface-container p-4" />
              <label className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 font-bold">
                <input type="checkbox" checked={editNeedsReview} onChange={(e) => setEditNeedsReview(e.target.checked)} />
                Keep this invoice in the review queue
              </label>
              <button className="w-full rounded-xl bg-blue-600 py-4 font-black text-white">Save Workflow State</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
