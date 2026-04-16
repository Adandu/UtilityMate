import React, { useEffect, useRef, useState } from 'react';
import { Bell, Home, Wallet, Download, Gauge, Loader2, Plus, Building2, AlertTriangle, Trash2, Upload, Eye, FileStack, ArrowRight } from 'lucide-react';
import api from '../utils/api';

interface Category { id: number; name: string; unit: string; }
interface Location { id: number; name: string; }
interface Provider { id: number; name: string; category_id: number; }
interface BudgetStatus {
  budget: { id: number; category_id: number; monthly_limit: number; warning_threshold: number; category?: Category; location?: Location | null; };
  spent: number;
  remaining: number;
  usage_ratio: number;
  status: string;
}
interface AlertItem { id: number; severity: string; title: string; message: string; is_read: boolean; created_at: string; }
interface Household { id: number; name: string; description?: string; members: { id: number; user_id: number; role: string }[]; }
interface AssociationStatementLine { id: number; raw_label: string; normalized_label: string; amount: number; location?: Location; }
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

const Operations: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [associationStatements, setAssociationStatements] = useState<AssociationStatement[]>([]);
  const [pageErrors, setPageErrors] = useState<string[]>([]);
  const [uploadingStatements, setUploadingStatements] = useState(false);
  const [statementUploadResults, setStatementUploadResults] = useState<AssociationStatementUploadResult[]>([]);
  const statementFileInputRef = useRef<HTMLInputElement>(null);

  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLocation, setNewBudgetLocation] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/budgets/status'),
      api.get('/alerts?unread_only=true'),
      api.get('/households/'),
      api.get('/categories/'),
      api.get('/locations/'),
      api.get('/providers/'),
      api.get('/association-statements/'),
    ]);

    const errors: string[] = [];

    if (results[0].status === 'fulfilled') setBudgets(results[0].value.data);
    else errors.push('Budgets could not be loaded.');

    if (results[1].status === 'fulfilled') setAlerts(results[1].value.data);
    else setAlerts([]);

    if (results[2].status === 'fulfilled') setHouseholds(results[2].value.data);
    else errors.push('Households could not be loaded.');

    if (results[3].status === 'fulfilled') setCategories(results[3].value.data);
    else errors.push('Categories could not be loaded.');

    if (results[4].status === 'fulfilled') setLocations(results[4].value.data);
    else errors.push('Locations could not be loaded.');

    if (results[5].status === 'fulfilled') setProviders(results[5].value.data);
    else errors.push('Providers could not be loaded.');

    if (results[6].status === 'fulfilled') setAssociationStatements(results[6].value.data);
    else errors.push('Association statements could not be loaded.');

    setPageErrors(errors);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/budgets/', {
      category_id: parseInt(newBudgetCategory),
      location_id: newBudgetLocation ? parseInt(newBudgetLocation) : null,
      monthly_limit: parseFloat(newBudgetLimit),
      warning_threshold: 0.85,
      is_active: true,
    });
    setNewBudgetCategory('');
    setNewBudgetLocation('');
    setNewBudgetLimit('');
    fetchData();
  };

  const createHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/households/', { name: newHouseholdName, description: '' });
    setNewHouseholdName('');
    fetchData();
  };

  const markAlertRead = async (id: number) => {
    await api.patch(`/alerts/${id}/read`);
    fetchData();
  };

  const deleteHousehold = async (householdId: number) => {
    if (!window.confirm('Delete this household? Linked locations and budgets will be detached.')) return;
    await api.delete(`/households/${householdId}`);
    fetchData();
  };

  const uploadAssociationStatements = async (e: React.FormEvent) => {
    e.preventDefault();
    const files = statementFileInputRef.current?.files;
    if (!files?.length) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    setUploadingStatements(true);
    setStatementUploadResults([]);
    try {
      const response = await api.post<AssociationStatementUploadResult[]>('/association-statements/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatementUploadResults(response.data);
      if (statementFileInputRef.current) statementFileInputRef.current.value = '';
      fetchData();
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
    await api.delete(`/association-statements/${statementId}`);
    fetchData();
  };

  const downloadReport = async () => {
    const response = await api.get('/invoices/export', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `utilitymate-report-${new Date().toISOString().split('T')[0]}.csv`;
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
          <h2 className="font-headline text-3xl font-extrabold">Operations Center</h2>
          <p className="text-on-surface-variant opacity-70">Budgets, review signals, shared households, automation hooks, reports, and meter-first workflows.</p>
        </div>
        <button onClick={downloadReport} className="flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-bold text-white dark:bg-white dark:text-slate-900">
          <Download size={18} /> Export Report
        </button>
      </header>

      {pageErrors.length > 0 && (
        <div className="mb-8 rounded-3xl border border-amber-300/40 bg-amber-50 p-5 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="mb-2 flex items-center gap-2 font-black">
            <AlertTriangle size={18} />
            Partial data loaded
          </div>
          <p className="text-sm opacity-80">{pageErrors.join(' ')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><Wallet className="text-emerald-600" /><h3 className="font-headline text-xl font-black">Budgets</h3></div>
          <form onSubmit={createBudget} className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <select required value={newBudgetCategory} onChange={(e) => setNewBudgetCategory(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <option value="">Category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select value={newBudgetLocation} onChange={(e) => setNewBudgetLocation(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <option value="">All Locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <input required type="number" step="0.01" value={newBudgetLimit} onChange={(e) => setNewBudgetLimit(e.target.value)} placeholder="Monthly RON" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
            <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Add Budget</button>
          </form>
          <div className="space-y-3">
            {budgets.length === 0 && <p className="text-sm opacity-60">No budgets yet.</p>}
            {budgets.map((item) => (
              <div key={item.budget.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-black">{item.budget.category?.name || 'Category'} {item.budget.location ? `• ${item.budget.location.name}` : '• Global'}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.status === 'exceeded' ? 'bg-red-100 text-red-700' : item.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.status}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full ${item.status === 'exceeded' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(item.usage_ratio * 100, 100)}%` }} />
                </div>
                <p className="mt-2 text-sm font-medium opacity-70">{item.spent.toFixed(2)} / {item.budget.monthly_limit.toFixed(2)} RON • Remaining {item.remaining.toFixed(2)} RON</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><Bell className="text-amber-600" /><h3 className="font-headline text-xl font-black">Alerts</h3></div>
          <div className="space-y-3">
            {alerts.length === 0 && <p className="text-sm opacity-60">No unread alerts.</p>}
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start justify-between gap-4 rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div>
                  <p className="font-black">{alert.title}</p>
                  <p className="text-sm opacity-70">{alert.message}</p>
                </div>
                <button onClick={() => markAlertRead(alert.id)} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-900">
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><Home className="text-blue-600" /><h3 className="font-headline text-xl font-black">Households</h3></div>
          <form onSubmit={createHousehold} className="mb-6 flex gap-3">
            <input required value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} placeholder="New household name" className="flex-1 rounded-xl border border-outline-variant bg-surface-container p-3" />
            <button type="submit" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"><Plus size={18} /></button>
          </form>
          <div className="space-y-3">
            {households.length === 0 && <p className="text-sm opacity-60">No households created yet.</p>}
            {households.map((household) => (
              <div key={household.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{household.name}</p>
                    <p className="text-sm opacity-70">{household.description || 'Shared household workspace for locations, budgets, and accountability.'}</p>
                    <p className="mt-2 text-xs font-bold uppercase opacity-50">{household.members.length} member records</p>
                  </div>
                  <button onClick={() => deleteHousehold(household.id)} className="rounded-xl border border-outline-variant px-3 py-2 text-xs font-black uppercase text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><Building2 className="text-amber-600" /><h3 className="font-headline text-xl font-black">Provider Catalog</h3></div>
          <div className="space-y-3">
            {providers.length === 0 && <p className="text-sm opacity-60">No providers available.</p>}
            {providers.slice(0, 10).map((provider) => (
              <div key={provider.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="font-black">{provider.name}</p>
                <p className="text-sm opacity-60">{categories.find((category) => category.id === provider.category_id)?.name || 'Unassigned category'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><FileStack className="text-teal-600" /><h3 className="font-headline text-xl font-black">Association Statements</h3></div>
          <p className="mb-4 text-sm opacity-70">Import BlocManagerNET avizier PDFs once per month. UtilityMate will map rows like `Ap 12` and `Ap 15` into normalized line items and feed the dashboard without forcing them into the normal invoice flow.</p>
          <form onSubmit={uploadAssociationStatements} className="mb-6 space-y-3">
            <input ref={statementFileInputRef} type="file" accept=".pdf" multiple className="w-full rounded-xl border border-outline-variant bg-surface-container p-3" />
            <button type="submit" disabled={uploadingStatements} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 font-bold text-white disabled:opacity-60">
              {uploadingStatements ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
              {uploadingStatements ? 'Importing Statements...' : 'Import Avizier PDFs'}
            </button>
          </form>
          {statementUploadResults.length > 0 && (
            <div className="mb-6 space-y-3">
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
          <div className="space-y-3">
            {associationStatements.length === 0 && <p className="text-sm opacity-60">No association statements imported yet.</p>}
            {associationStatements.slice(0, 8).map((statement) => (
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

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3"><Gauge className="text-purple-600" /><h3 className="font-headline text-xl font-black">Meter Readings</h3></div>
          <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
            <p className="font-black">Meter history lives in its own workspace now.</p>
            <p className="mt-2 text-sm opacity-70">Open the dedicated Meter Readings page to manage stream-specific devices, inspect the difference from the previous reading, edit historical lines, and compare readings with the linked invoices already stored in UtilityMate.</p>
            <button onClick={() => { window.location.href = '/meters'; }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 font-bold text-white">
              Open Meter Readings <ArrowRight size={16} />
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Operations;
