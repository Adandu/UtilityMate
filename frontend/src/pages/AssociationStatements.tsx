import React, { useEffect, useRef, useState } from 'react';
import { Eye, FileStack, Loader2, Trash2, Upload } from 'lucide-react';
import api from '../utils/api';

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
  const [associationStatements, setAssociationStatements] = useState<AssociationStatement[]>([]);
  const [statementUploadResults, setStatementUploadResults] = useState<AssociationStatementUploadResult[]>([]);
  const [pageError, setPageError] = useState('');
  const statementFileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadAssociationStatements = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = statementFileInputRef.current?.files;
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    setUploadingStatements(true);
    setStatementUploadResults([]);
    setPageError('');
    try {
      const response = await api.post<AssociationStatementUploadResult[]>('/association-statements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatementUploadResults(response.data);
      if (statementFileInputRef.current) statementFileInputRef.current.value = '';
      await fetchStatements();
    } catch {
      setPageError('Association statements could not be imported.');
    } finally {
      setUploadingStatements(false);
    }
  };

  const openAssociationStatementPdf = async (statementId: number) => {
    const response = await api.get(`/association-statements/${statementId}/pdf`, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
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
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
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
            <button type="submit" disabled={uploadingStatements} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-bold text-white disabled:opacity-60">
              {uploadingStatements ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              {uploadingStatements ? 'Importing Statements...' : 'Import Avizier PDFs'}
            </button>
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
    </div>
  );
};

export default AssociationStatements;
