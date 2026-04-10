import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { AlertTriangle, CalendarClock, Loader2, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import api from '../utils/api';

interface Summary {
  total_spend: number;
  invoice_count: number;
  overdue_invoices: number;
  needs_review_count: number;
  active_alerts: number;
  unpaid_total: number;
  avg_monthly_spend: number;
}

interface BudgetStatus {
  budget: { id: number; category?: { name: string }; monthly_limit: number };
  spent: number;
  usage_ratio: number;
  status: string;
}

interface AlertItem {
  id: number;
  title: string;
  message: string;
}

interface ForecastPoint {
  label: string;
  amount: number;
}

interface ReportBundle {
  summary: Summary;
  budget_statuses: BudgetStatus[];
  alerts: AlertItem[];
  forecast: ForecastPoint[];
}

interface Invoice {
  id: number;
  invoice_date: string;
  amount: number;
}

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: '16px',
  color: 'var(--color-on-surface)',
};

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reportRes, invoiceRes] = await Promise.all([
          api.get('/analytics/report'),
          api.get('/invoices/'),
        ]);
        setReport(reportRes.data);
        setInvoices(invoiceRes.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const monthlySpend = invoices.reduce<Record<string, number>>((acc, invoice) => {
    const month = invoice.invoice_date.slice(0, 7);
    acc[month] = (acc[month] || 0) + invoice.amount;
    return acc;
  }, {});
  const spendData = Object.entries(monthlySpend).sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([name, amount]) => ({ name, amount }));

  if (loading || !report) {
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  const summaryCards = [
    { label: 'Total Spend', value: `${report.summary.total_spend.toFixed(2)} RON`, icon: Wallet, tone: 'text-emerald-600' },
    { label: 'Unpaid Exposure', value: `${report.summary.unpaid_total.toFixed(2)} RON`, icon: ReceiptText, tone: 'text-blue-600' },
    { label: 'Needs Review', value: String(report.summary.needs_review_count), icon: AlertTriangle, tone: 'text-amber-600' },
    { label: 'Overdue Invoices', value: String(report.summary.overdue_invoices), icon: CalendarClock, tone: 'text-rose-600' },
  ];

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
      <header className="mb-10">
        <h2 className="font-headline text-3xl font-extrabold">Household Control Tower</h2>
        <p className="text-on-surface-variant opacity-70">Forecast spend, catch anomalies, watch review queues, and manage your utility operation from one place.</p>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-outline-variant bg-surface-container p-6">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 ${card.tone}`}>
                <Icon size={22} />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-50">{card.label}</p>
              <p className="mt-2 text-2xl font-black">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-6 flex items-center gap-3"><TrendingUp className="text-emerald-600" /><h3 className="font-headline text-xl font-black">Spend Trend</h3></div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spendData}>
                <defs>
                  <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} />
                <Area type="monotone" dataKey="amount" stroke="#10b981" fill="url(#spendArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-6 flex items-center gap-3"><Wallet className="text-blue-600" /><h3 className="font-headline text-xl font-black">Forecast</h3></div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.forecast}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-6 flex items-center gap-3"><AlertTriangle className="text-amber-600" /><h3 className="font-headline text-xl font-black">Attention Queue</h3></div>
          <div className="space-y-3">
            {report.alerts.length === 0 && <p className="text-sm opacity-60">No recent alerts.</p>}
            {report.alerts.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="font-black">{alert.title}</p>
                <p className="text-sm opacity-70">{alert.message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-6 flex items-center gap-3"><ReceiptText className="text-purple-600" /><h3 className="font-headline text-xl font-black">Budget Pressure</h3></div>
          <div className="space-y-3">
            {report.budget_statuses.length === 0 && <p className="text-sm opacity-60">No budgets configured yet.</p>}
            {report.budget_statuses.map((status) => (
              <div key={status.budget.id} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-black">{status.budget.category?.name || 'Category'}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${status.status === 'exceeded' ? 'bg-red-100 text-red-700' : status.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{status.status}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full ${status.status === 'exceeded' ? 'bg-red-500' : status.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(status.usage_ratio * 100, 100)}%` }} />
                </div>
                <p className="mt-2 text-sm opacity-70">{status.spent.toFixed(2)} / {status.budget.monthly_limit.toFixed(2)} RON</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
