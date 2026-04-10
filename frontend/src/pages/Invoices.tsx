import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Edit3, Eye, FileWarning, Loader2, Square, CheckSquare, Upload, X } from 'lucide-react';
import api from '../utils/api';

interface Invoice {
  id: number;
  provider_id: number;
  location_id: number;
  provider?: { name: string; category?: { name: string; unit: string } };
  location?: { name: string };
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

interface Location { id: number; name: string; }

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editStatus, setEditStatus] = useState('received');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaymentReference, setEditPaymentReference] = useState('');
  const [editReviewNotes, setEditReviewNotes] = useState('');
  const [editNeedsReview, setEditNeedsReview] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('reviewed');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoiceRes, locationRes] = await Promise.all([
        api.get('/invoices/'),
        api.get('/locations/'),
      ]);
      setInvoices(invoiceRes.data);
      setLocations(locationRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    try {
      await api.post('/invoices/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setSelectedLocation('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } finally {
      setUploading(false);
    }
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
    setSelectedIds((current) => current.length === invoices.length ? [] : invoices.map((invoice) => invoice.id));
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

  if (loading) {
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Invoice Review Desk</h2>
          <p className="text-on-surface-variant opacity-70">Manage import confidence, due dates, payment tracking, bulk workflow status, and PDF review without paying invoices in-app.</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">
          <Upload size={18} /> Upload Invoices
        </button>
      </header>

      {selectedIds.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:flex-row md:items-center md:justify-between">
          <p className="font-black">{selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <option value="received">Received</option>
              <option value="reviewed">Reviewed</option>
              <option value="scheduled">Scheduled</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <button onClick={applyBulkStatus} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">Apply Status</button>
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
                    {selectedIds.length === invoices.length && invoices.length > 0 ? <CheckSquare size={18} className="text-emerald-600" /> : <Square size={18} />}
                  </button>
                </th>
                <th className="px-4 py-4">Provider</th>
                <th className="px-4 py-4">Location</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Amount</th>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-outline-variant bg-white p-8 dark:bg-slate-800">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-headline text-xl font-black">Upload Invoices</h3>
              <button onClick={() => setShowUpload(false)}><X size={22} /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <select required value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container p-4">
                <option value="">Select Location</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              <input ref={fileInputRef} type="file" accept=".pdf" multiple required className="w-full rounded-xl border border-outline-variant bg-surface-container p-4" />
              <button disabled={uploading} className="w-full rounded-xl bg-emerald-600 py-4 font-black text-white">
                {uploading ? 'Uploading...' : 'Import PDFs'}
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
                <option value="received">Received</option>
                <option value="reviewed">Reviewed</option>
                <option value="scheduled">Scheduled</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
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
