import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Eye, FileStack, Loader2, Trash2, Upload, X } from 'lucide-react';
import api from '../utils/api';
import { openBlobInNewTab } from '../utils/download';

const UPLOAD_TIMEOUT_MS = 90000;

interface Location {
  id: number;
  name: string;
}

interface AssociationStatementLine {
  id: number;
  raw_label: string;
  normalized_label: string;
  amount: number;
  location?: Location;
}

interface AssociationStatement {
  id: number;
  statement_month: string;
  display_month: string;
  posted_date?: string | null;
  due_date?: string | null;
  source_name?: string | null;
  total_payable?: number | null;
  parsing_profile?: string | null;
  lines: AssociationStatementLine[];
}

interface AssociationStatementUploadResult {
  filename: string;
  status: string;
  detail: string;
  statement_id?: number;
  display_month?: string;
  imported_locations: string[];
  imported_lines: number;
}

const AssociationStatements: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [uploadingStatements, setUploadingStatements] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [associationStatements, setAssociationStatements] = useState<AssociationStatement[]>([]);
  const [statementUploadResults, setStatementUploadResults] = useState<AssociationStatementUploadResult[]>([]);
  const [pageError, setPageError] = useState('');
  const [reviewStatementIds, setReviewStatementIds] = useState<number[]>([]);
  const statementFileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const fetchStatements = async () => {
    setLoading(true);
    setPageError('');
    try {
      const response = await api.get<AssociationStatement[]>('/association-statements/');
      setAssociationStatements(response.data);
    } catch {
      setPageError('Association statements could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  useEffect(() => {
    if (reviewStatementIds.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReviewStatementIds([]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reviewStatementIds]);

  const uploadAssociationStatements = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = statementFileInputRef.current?.files;
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    setUploadingStatements(true);
    setUploadProgress(0);
    setStatementUploadResults([]);
    setPageError('');
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    try {
      const response = await api.post<AssociationStatementUploadResult[]>('/association-statements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setStatementUploadResults(response.data);
      if (statementFileInputRef.current) statementFileInputRef.current.value = '';
      await fetchStatements();
      const importedIds = response.data
        .filter((result) => result.status === 'success' && typeof result.statement_id === 'number')
        .map((result) => result.statement_id as number);
      if (importedIds.length > 0) {
        setReviewStatementIds(importedIds);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        setPageError('Association statement import was cancelled.');
      } else if (axios.isAxiosError(error)) {
        setPageError(error.response?.data?.detail || (error.code === 'ECONNABORTED' ? 'Import timed out. Please try again with fewer or smaller files.' : 'Association statements could not be imported.'));
      } else {
        setPageError('Association statements could not be imported.');
      }
    } finally {
      setUploadingStatements(false);
      setUploadProgress(0);
      uploadAbortRef.current = null;
    }
  };

  const cancelStatementUpload = () => {
    uploadAbortRef.current?.abort();
  };

  const openAssociationStatementPdf = async (statementId: number) => {
    const response = await api.get(`/association-statements/${statementId}/pdf`, { responseType: 'blob' });
    openBlobInNewTab(response.data, 'application/pdf');
  };

  const deleteAssociationStatement = async (statementId: number) => {
    if (!window.confirm('Delete this imported association statement and all of its parsed line items?')) return;
    setPageError('');
    try {
      await api.delete(`/association-statements/${statementId}`);
      await fetchStatements();
    } catch {
      setPageError('Association statement could not be deleted.');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface md:ml-64"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-6 pt-20 text-on-surface sm:px-6 md:ml-64 md:p-8">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <FileStack className="text-teal-600" />
          <div>
            <h2 className="font-headline text-3xl font-extrabold">Association Statements</h2>
            <p className="text-on-surface-variant opacity-70">Import BlocManagerNET avizier PDFs, normalize apartment line items, and keep monthly association charges separate from the standard invoice flow.</p>
          </div>
        </div>
      </header>

      {pageError && (
        <div className="mb-6 rounded-2xl border border-red-300/50 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-700/40 dark:bg-red-950/30 dark:text-red-100">
          {pageError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3">
            <Upload className="text-teal-600" />
            <h3 className="font-headline text-xl font-black">Import Statements</h3>
          </div>
          <p className="mb-4 text-sm opacity-70">Upload one or more monthly avizier PDFs. UtilityMate maps rows like `Ap 12` and `Ap 15` into normalized line items for dashboard and household reporting.</p>
          <form onSubmit={uploadAssociationStatements} className="space-y-3">
            <input ref={statementFileInputRef} type="file" accept=".pdf" multiple className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
            {uploadingStatements && (
              <div className="rounded-2xl border border-outline-variant bg-slate-50 p-4 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {uploadProgress >= 100 ? 'Upload complete. Parsing statements...' : 'Uploading PDFs...'}
                  </p>
                  <Loader2 className="animate-spin text-teal-600" size={18} />
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-teal-600 transition-all duration-300" style={{ width: `${Math.max(uploadProgress, 8)}%` }} />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={uploadingStatements} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-bold text-white disabled:opacity-60">
                {uploadingStatements ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploadingStatements ? 'Importing Statements...' : 'Import Avizier PDFs'}
              </button>
              {uploadingStatements && (
                <button type="button" onClick={cancelStatementUpload} className="rounded-xl border border-outline-variant px-4 py-3 font-bold">
                  Cancel
                </button>
              )}
            </div>
          </form>

          {statementUploadResults.length > 0 && (
            <div className="mt-6 space-y-3">
              {statementUploadResults.map((result, index) => (
                <div key={`${result.filename}-${index}`} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{result.filename}</p>
                      <p className="text-sm opacity-70">{result.detail}</p>
                      {result.display_month && <p className="mt-1 text-xs font-bold uppercase opacity-50">{result.display_month}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${result.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{result.status}</span>
                  </div>
                  {result.status === 'success' && (
                    <p className="mt-3 text-xs opacity-60">{result.imported_lines} line items imported for {result.imported_locations.join(', ') || 'matched locations'}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-headline text-xl font-black">Imported Statements</h3>
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-black uppercase">{associationStatements.length}</span>
          </div>
          <div className="space-y-3">
            {associationStatements.length === 0 && <p className="text-sm opacity-60">No association statements imported yet.</p>}
            {associationStatements.map((statement) => (
              <div key={statement.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black">{statement.display_month}</p>
                    <p className="text-sm opacity-70">{statement.source_name || 'Imported avizier PDF'}</p>
                    <p className="mt-2 text-xs font-bold uppercase opacity-50">
                      {statement.lines.length} parsed line items • {new Set(statement.lines.map((line) => line.location?.name).filter(Boolean)).size} locations
                    </p>
                    {typeof statement.total_payable === 'number' && <p className="mt-2 text-sm font-bold">Imported total payable: {statement.total_payable.toFixed(2)} RON</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setReviewStatementIds([statement.id])} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-900">
                      Review Lines
                    </button>
                    <button onClick={() => openAssociationStatementPdf(statement.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => deleteAssociationStatement(statement.id)} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-black uppercase text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {reviewStatementIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-outline-variant bg-white p-8 dark:bg-slate-800">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-headline text-xl font-black">Review Parsed Line Items</h3>
              <button onClick={() => setReviewStatementIds([])}><X size={22} /></button>
            </div>
            <p className="mb-6 text-sm opacity-70">
              These line items were parsed and imported automatically. Line-item editing isn't available yet from this screen
              — delete and re-import the statement if a value needs correcting.
            </p>
            <div className="space-y-6">
              {associationStatements.filter((statement) => reviewStatementIds.includes(statement.id)).map((statement) => (
                <div key={statement.id}>
                  <p className="mb-2 font-black">{statement.display_month} — {statement.source_name || 'Imported avizier PDF'}</p>
                  <div className="overflow-x-auto rounded-2xl border border-outline-variant">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-outline-variant bg-surface-container text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">Label</th>
                          <th className="px-4 py-3">Normalized Label</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {statement.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="px-4 py-3 font-bold">{line.location?.name || 'Unmatched'}</td>
                            <td className="px-4 py-3">{line.raw_label}</td>
                            <td className="px-4 py-3">{line.normalized_label}</td>
                            <td className="px-4 py-3 text-right font-black">{line.amount.toFixed(2)} RON</td>
                          </tr>
                        ))}
                        {statement.lines.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-6 text-center opacity-60">No line items were parsed for this statement.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setReviewStatementIds([])} className="mt-6 w-full rounded-xl bg-teal-600 py-4 font-black text-white">
              Close Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssociationStatements;
