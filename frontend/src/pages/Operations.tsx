import React, { useEffect, useState } from 'react';
import { Bell, Home, Wallet, Webhook, Download, Gauge, Loader2, Plus, CheckCircle2, Building2, AlertTriangle } from 'lucide-react';
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
interface AutomationEvent { id: number; source: string; event_type: string; status: string; created_at: string; }
interface ConsumptionIndex { id: number; location_id: number; category_id: number; value: number; reading_date: string; source_type: string; notes?: string; }

const Operations: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [indexes, setIndexes] = useState<ConsumptionIndex[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [pageErrors, setPageErrors] = useState<string[]>([]);

  const [newBudgetCategory, setNewBudgetCategory] = useState('');
  const [newBudgetLocation, setNewBudgetLocation] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [meterLocation, setMeterLocation] = useState('');
  const [meterCategory, setMeterCategory] = useState('');
  const [meterValue, setMeterValue] = useState('');
  const [meterNotes, setMeterNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/budgets/status'),
      api.get('/alerts?unread_only=true'),
      api.get('/households/'),
      api.get('/automation/events'),
      api.get('/consumption/'),
      api.get('/categories/'),
      api.get('/locations/'),
      api.get('/providers/'),
    ]);

    const errors: string[] = [];

    if (results[0].status === 'fulfilled') setBudgets(results[0].value.data);
    else errors.push('Budgets could not be loaded.');

    if (results[1].status === 'fulfilled') setAlerts(results[1].value.data);
    else setAlerts([]);

    if (results[2].status === 'fulfilled') setHouseholds(results[2].value.data);
    else errors.push('Households could not be loaded.');

    if (results[3].status === 'fulfilled') setEvents(results[3].value.data);
    else errors.push('Automation events could not be loaded.');

    if (results[4].status === 'fulfilled') setIndexes(results[4].value.data);
    else errors.push('Meter readings could not be loaded.');

    if (results[5].status === 'fulfilled') setCategories(results[5].value.data);
    else errors.push('Categories could not be loaded.');

    if (results[6].status === 'fulfilled') setLocations(results[6].value.data);
    else errors.push('Locations could not be loaded.');

    if (results[7].status === 'fulfilled') setProviders(results[7].value.data);
    else errors.push('Providers could not be loaded.');

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

  const createMeterReading = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/consumption/', {
      location_id: parseInt(meterLocation),
      category_id: parseInt(meterCategory),
      value: parseFloat(meterValue),
      reading_date: new Date().toISOString().split('T')[0],
      source_type: 'manual',
      notes: meterNotes,
    });
    setMeterLocation('');
    setMeterCategory('');
    setMeterValue('');
    setMeterNotes('');
    fetchData();
  };

  const markAlertRead = async (id: number) => {
    await api.patch(`/alerts/${id}/read`);
    fetchData();
  };

  const triggerFolderScan = async () => {
    await api.post('/automation/scan-folder');
    fetchData();
  };

  const deleteHousehold = async (householdId: number) => {
    if (!window.confirm('Delete this household? Linked locations and budgets will be detached.')) return;
    await api.delete(`/households/${householdId}`);
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
          <div className="mb-5 flex items-center gap-3"><Gauge className="text-purple-600" /><h3 className="font-headline text-xl font-black">Meter Readings</h3></div>
          <form onSubmit={createMeterReading} className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
            <select required value={meterLocation} onChange={(e) => setMeterLocation(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <option value="">Location</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select required value={meterCategory} onChange={(e) => setMeterCategory(e.target.value)} className="rounded-xl border border-outline-variant bg-surface-container p-3">
              <option value="">Category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input required type="number" step="0.01" value={meterValue} onChange={(e) => setMeterValue(e.target.value)} placeholder="Reading value" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
            <input value={meterNotes} onChange={(e) => setMeterNotes(e.target.value)} placeholder="Notes (optional)" className="rounded-xl border border-outline-variant bg-surface-container p-3" />
            <button type="submit" className="rounded-xl bg-purple-600 px-4 py-3 font-bold text-white md:col-span-4">Save Reading</button>
          </form>
          <div className="space-y-3">
            {indexes.slice(0, 6).map((index) => (
              <div key={index.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="font-black">{locations.find((l) => l.id === index.location_id)?.name || 'Location'} • {categories.find((c) => c.id === index.category_id)?.name || 'Category'}</p>
                <p className="text-sm opacity-70">{index.value} on {index.reading_date} • {index.source_type}</p>
                {index.notes && <p className="text-xs opacity-50">{index.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3"><Webhook className="text-rose-600" /><h3 className="font-headline text-xl font-black">Automation & Integrations</h3></div>
            <button onClick={triggerFolderScan} className="rounded-xl bg-rose-600 px-4 py-3 font-bold text-white">Scan Inbox</button>
          </div>
          <p className="mb-4 text-sm opacity-70">Use the authenticated `/api/automation/webhook` endpoint for Home Assistant, scripts, or N8N-style triggers. Folder scans check the configured invoice inbox for new PDFs.</p>
          <div className="space-y-3">
            {events.length === 0 && <p className="text-sm opacity-60">No automation events yet.</p>}
            {events.slice(0, 8).map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div>
                  <p className="font-black">{event.source} • {event.event_type}</p>
                  <p className="text-sm opacity-70">{new Date(event.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                  <CheckCircle2 size={14} /> {event.status}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Operations;
