import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronDown, Download, Filter, Loader2, MapPinned, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../utils/api';

interface LocationOption {
  id: number;
  name: string;
}

interface DashboardSummary {
  total_cost: number;
  avg_monthly_cost: number;
  previous_period_cost: number;
  change_ratio: number;
  active_categories: number;
  months_covered: number;
}

interface DashboardSeriesPoint {
  label: string;
  cost: number;
  consumption: number;
  unit_cost?: number | null;
  last_year_cost?: number | null;
  forecast_cost?: number | null;
}

interface LocationComparisonPoint {
  location_id: number;
  location_name: string;
  cost: number;
  consumption: number;
  unit_cost?: number | null;
}

interface DashboardCategorySection {
  category_id: number;
  category_name: string;
  unit: string;
  total_cost: number;
  total_consumption: number;
  avg_unit_cost?: number | null;
  monthly_series: DashboardSeriesPoint[];
  location_comparison: LocationComparisonPoint[];
}

interface DashboardResponse {
  summary: DashboardSummary;
  available_locations: LocationOption[];
  selected_location_id?: number | null;
  period_key: string;
  start_date: string;
  end_date: string;
  overall_cost_series: DashboardSeriesPoint[];
  avizier_cost_series: DashboardSeriesPoint[];
  avizier_location_comparison: LocationComparisonPoint[];
  supplier_sections: DashboardCategorySection[];
  avizier_sections: DashboardCategorySection[];
}

const tooltipStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-outline-variant)',
  borderRadius: '16px',
  color: 'var(--color-on-surface)',
};

const historySeriesOrder: Record<string, number> = {
  Cost: 0,
  'Last Year': 1,
  'Average Over the Years': 2,
};

const legendStyle = {
  color: 'var(--color-on-surface)',
  fontSize: 12,
  fontWeight: 700,
};

const periodOptions = [
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_1_year', label: 'Last 1 Year' },
  { value: 'custom', label: 'Custom Period' },
  { value: 'all_time', label: 'All Time' },
];

const formatMoney = (value: number) => `${value.toFixed(2)} RON`;
const formatUnitCost = (value?: number | null, unit?: string) => (value == null ? 'No data' : `${value.toFixed(2)} RON / ${unit}`);
const formatTooltipNumber = (value: number) => (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(3));

const asNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
};

const costTooltipFormatter = (value: unknown, name: unknown) => {
  const numericValue = asNumber(value);
  return [formatMoney(numericValue), String(name)];
};

const consumptionTooltipFormatter = (unit: string) => (value: unknown, name: unknown) => {
  const numericValue = asNumber(value);
  return [`${formatTooltipNumber(numericValue)} ${unit}`, String(name)];
};

const unitCostTooltipFormatter = (unit: string) => (value: unknown, name: unknown) => {
  const numericValue = asNumber(value);
  return [`${numericValue.toFixed(4)} RON / ${unit}`, String(name)];
};

const historyItemSorter = (item: { name?: string | number }) => historySeriesOrder[String(item.name ?? '')] ?? 99;

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DashboardResponse | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('last_6_months');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { period: selectedPeriod };
      if (selectedLocation !== 'all') {
        params.location_id = selectedLocation;
      }
      if (selectedPeriod === 'custom') {
        if (customStart) params.start_date = customStart;
        if (customEnd) params.end_date = customEnd;
      }
      const response = await api.get<DashboardResponse>('/analytics/dashboard', { params });
      setReport(response.data);
      if (selectedLocation === 'all' && response.data.selected_location_id) {
        setSelectedLocation(String(response.data.selected_location_id));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPeriod === 'custom' && (!customStart || !customEnd)) {
      return;
    }
    fetchDashboard();
  }, [selectedLocation, selectedPeriod, customStart, customEnd]);

  const trendDirection = useMemo(() => {
    if (!report) return { icon: Sparkles, label: 'Stable period', tone: 'text-slate-600' };
    if (report.summary.change_ratio > 0.03) return { icon: TrendingUp, label: 'Spend increased vs previous period', tone: 'text-rose-600' };
    if (report.summary.change_ratio < -0.03) return { icon: TrendingDown, label: 'Spend decreased vs previous period', tone: 'text-emerald-600' };
    return { icon: Sparkles, label: 'Spend is broadly stable', tone: 'text-blue-600' };
  }, [report]);

  const selectedLocationName = useMemo(() => {
    if (!report || selectedLocation === 'all') return 'All Locations';
    return report.available_locations.find((location) => String(location.id) === selectedLocation)?.name || 'Selected Location';
  }, [report, selectedLocation]);

  const selectedPeriodLabel = useMemo(() => (
    periodOptions.find((option) => option.value === selectedPeriod)?.label || 'Custom Period'
  ), [selectedPeriod]);

  const exportDashboardPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    setExportMessage(null);
    try {
      const params: Record<string, string> = { period: selectedPeriod };
      if (selectedLocation !== 'all') {
        params.location_id = selectedLocation;
      }
      if (selectedPeriod === 'custom') {
        if (customStart) params.start_date = customStart;
        if (customEnd) params.end_date = customEnd;
      }

      const response = await api.get('/analytics/dashboard-export', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers['content-disposition'] as string | undefined;
      const match = contentDisposition?.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `utilitymate-dashboard-${selectedLocationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${selectedPeriodLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setExportMessage('Dashboard PDF export is ready.');
    } catch (error) {
      console.error('Dashboard PDF export failed', error);
      setExportMessage('Dashboard export failed. Please try again in a few seconds.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading || !report) {
    return <div className="flex min-h-screen items-center justify-center bg-surface md:ml-64"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  const TrendIcon = trendDirection.icon;
  const previousPeriodAverage = report.summary.months_covered > 0
    ? report.summary.previous_period_cost / report.summary.months_covered
    : 0;
  const summaryCards = [
    { label: 'Total Spend', value: formatMoney(report.summary.total_cost), icon: BarChart3, tone: 'text-emerald-600' },
    { label: 'Current Avg / Month', value: formatMoney(report.summary.avg_monthly_cost), icon: Sparkles, tone: 'text-blue-600' },
    { label: 'Previous Period Spend', value: formatMoney(report.summary.previous_period_cost), icon: TrendingUp, tone: 'text-amber-600' },
    { label: 'Previous Avg / Month', value: formatMoney(previousPeriodAverage), icon: TrendingDown, tone: 'text-violet-600' },
    { label: 'Main Utility Groups', value: String(report.summary.active_categories), icon: MapPinned, tone: 'text-rose-600' },
  ];
  const supplierBreakdown = [...report.supplier_sections].sort((left, right) => right.total_cost - left.total_cost);
  const avizierBreakdown = [...report.avizier_sections].sort((left, right) => right.total_cost - left.total_cost);
  const avizierTotalCost = report.avizier_cost_series.reduce((sum, point) => sum + point.cost, 0);
  const categoryBreakdown = [
    ...supplierBreakdown.map((section) => ({ key: `supplier-${section.category_id}`, label: section.category_name, total_cost: section.total_cost, isSubsection: false })),
    { key: 'avizier-total', label: 'Avizier', total_cost: avizierTotalCost, isSubsection: false },
    ...avizierBreakdown.map((section) => ({ key: `avizier-${section.category_id}`, label: `Avizier / ${section.category_name}`, total_cost: section.total_cost, isSubsection: true })),
  ];

  return (
    <div className="min-h-screen bg-surface px-4 pb-6 pt-20 text-on-surface sm:px-6 md:ml-64 md:p-8">
      <header className="mb-8 space-y-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Utility Trends Dashboard</h2>
          <p className="text-on-surface-variant opacity-70">Track how spend and consumption change over time, drill into each utility category, and compare locations with the same time window.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-outline-variant bg-surface-container p-5 lg:grid-cols-[1.2fr_1fr_auto_auto]">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant"><MapPinned size={14} /> Location</span>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3">
              <option value="all">All Locations</option>
              {report.available_locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant"><Filter size={14} /> Period</span>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3">
              {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {selectedPeriod === 'custom' && (
            <>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">From</span>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-on-surface-variant">To</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3" />
              </label>
            </>
          )}
        </div>
        <div className="flex justify-end">
          <button onClick={exportDashboardPdf} disabled={exportingPdf} className="flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">
            {exportingPdf ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            {exportingPdf ? 'Exporting PDF...' : 'Export Dashboard PDF'}
          </button>
        </div>
        {exportMessage && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm font-medium">
            {exportMessage}
          </div>
        )}
      </header>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
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

      <section className="mb-8 rounded-3xl border border-outline-variant bg-surface-container-low p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-headline text-xl font-black">Cost Breakdown by Utility</h3>
            <p className="text-sm opacity-70">Utility costs for {selectedLocationName} during {selectedPeriodLabel.toLowerCase()}.</p>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">
            {formatMoney(report.summary.total_cost)} total
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white/70 dark:bg-slate-900/40">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-4 py-3 font-black">Utility</th>
                <th className="px-4 py-3 font-black">Cost</th>
                <th className="px-4 py-3 font-black">Average / Month</th>
                <th className="px-4 py-3 font-black">Share</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown.map((section) => {
                const share = report.summary.total_cost > 0 ? (section.total_cost / report.summary.total_cost) * 100 : 0;
                const averagePerMonth = report.summary.months_covered > 0 ? section.total_cost / report.summary.months_covered : 0;
                return (
                  <tr key={section.key} className="border-t border-outline-variant">
                    <td className={`px-4 py-3 ${section.isSubsection ? 'pl-8 font-medium opacity-85' : 'font-semibold'}`}>{section.label}</td>
                    <td className="px-4 py-3">{formatMoney(section.total_cost)}</td>
                    <td className="px-4 py-3">{formatMoney(averagePerMonth)}</td>
                    <td className="px-4 py-3">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
              {categoryBreakdown.length === 0 && (
                <tr>
                  <td className="px-4 py-4 opacity-70" colSpan={4}>No category cost data is available for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.7fr_1fr]">
        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-headline text-xl font-black">Monthly Cost Trend</h3>
              <p className="text-sm opacity-70">{selectedLocationName} from {report.start_date} to {report.end_date}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold dark:bg-slate-900">
              {report.summary.months_covered} month{report.summary.months_covered === 1 ? '' : 's'} in view
            </div>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={report.overall_cost_series}>
                  <defs>
                    <linearGradient id="overallSpendArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Legend wrapperStyle={legendStyle} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} itemSorter={historyItemSorter} />
                <Area type="monotone" dataKey="cost" stroke="#7c3aed" fill="url(#overallSpendArea)" strokeWidth={3} name="Cost" />
                <Line type="monotone" dataKey="last_year_cost" stroke="#0f766e" strokeWidth={2} dot={false} connectNulls name="Last Year" />
                <Line type="monotone" dataKey="forecast_cost" stroke="#f97316" strokeWidth={2} strokeDasharray="8 6" connectNulls dot={false} name="Average Over the Years" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 ${trendDirection.tone}`}>
              <TrendIcon size={22} />
            </div>
            <div>
              <h3 className="font-headline text-xl font-black">Trend Signal</h3>
              <p className="text-sm opacity-70">{trendDirection.label}</p>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Change vs previous period</p>
              <p className={`mt-2 text-3xl font-black ${trendDirection.tone}`}>{(report.summary.change_ratio * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Reading this chart</p>
              <p className="mt-2 text-sm opacity-75">The comparison lines show the same month last year and the longer-term historical average from all earlier years.</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Active selection</p>
              <p className="mt-2 text-sm font-bold">{selectedLocationName}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline text-2xl font-black">Main Utility Categories</h3>
            <p className="text-sm opacity-70">Supplier-backed categories stay separate from association-statement costs so unit pricing remains faithful to the original invoices.</p>
          </div>
        </div>

        {report.supplier_sections.length === 0 && (
          <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-10 text-center">
            <p className="text-lg font-black">No invoice data is available for this filter.</p>
            <p className="mt-2 text-sm opacity-70">Try another location or widen the time range to see supplier category analytics.</p>
          </div>
        )}

        {report.supplier_sections.map((section, index) => (
          <details key={section.category_id} className="group rounded-3xl border border-outline-variant bg-surface-container-low p-6" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Category</p>
                <h4 className="mt-1 font-headline text-2xl font-black">{section.category_name}</h4>
                <p className="mt-2 text-sm opacity-70">
                  {formatMoney(section.total_cost)} spent • {section.total_consumption.toFixed(2)} {section.unit} consumed • {formatUnitCost(section.avg_unit_cost, section.unit)}
                </p>
              </div>
              <ChevronDown className="transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                <h5 className="mb-4 font-black">Cost per Month</h5>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={section.monthly_series}>
                      <defs>
                        <linearGradient id={`costArea-${section.category_id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={legendStyle} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} />
                      <Area type="monotone" dataKey="cost" stroke="#2563eb" fill={`url(#costArea-${section.category_id})`} strokeWidth={3} name="Cost" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                <h5 className="mb-4 font-black">Consumption per Month</h5>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={section.monthly_series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={legendStyle} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={consumptionTooltipFormatter(section.unit)} />
                      <Bar dataKey="consumption" fill="#14b8a6" radius={[10, 10, 0, 0]} name="Consumption" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                <h5 className="mb-4 font-black">Unit Cost</h5>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={section.monthly_series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={legendStyle} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={unitCostTooltipFormatter(section.unit)} />
                      <Line type="monotone" dataKey="unit_cost" stroke="#7c3aed" strokeWidth={3} connectNulls dot={{ r: 3 }} name="Unit Cost" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                <h5 className="mb-4 font-black">History Comparison</h5>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={section.monthly_series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={legendStyle} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} itemSorter={historyItemSorter} />
                      <Line type="monotone" dataKey="cost" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} name="Cost" />
                      <Line type="monotone" dataKey="last_year_cost" stroke="#0f766e" strokeWidth={3} connectNulls dot={false} name="Last Year" />
                      <Line type="monotone" dataKey="forecast_cost" stroke="#f97316" strokeWidth={3} strokeDasharray="8 6" connectNulls dot={false} name="Average Over the Years" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40 xl:col-span-2">
                <h5 className="mb-4 font-black">Compare Locations for {section.category_name}</h5>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={section.location_comparison}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                      <XAxis dataKey="location_name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Legend wrapperStyle={legendStyle} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: 'var(--color-on-surface)' }}
                        itemStyle={{ color: 'var(--color-on-surface)' }}
                        formatter={(value, name) => {
                          if (name === 'Cost') {
                            return costTooltipFormatter(value, name);
                          }
                          return unitCostTooltipFormatter(section.unit)(value, name);
                        }}
                      />
                      <Bar dataKey="cost" fill="#0f766e" radius={[10, 10, 0, 0]} name="Cost" />
                      <Bar dataKey="unit_cost" fill="#7c3aed" radius={[10, 10, 0, 0]} name="Unit Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              <p className="mt-3 text-sm opacity-70">The comparison uses the current period filter across all locations so you can benchmark this supplier category side by side.</p>
            </div>
          </div>
        </details>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-outline-variant bg-surface-container-low p-6">
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <h3 className="font-headline text-2xl font-black">Avizier Cost per Month</h3>
              <p className="mt-2 text-sm opacity-70">Association-statement totals stay separate from supplier invoices, with drill-down subsections for every avizier utility found in the selected period.</p>
            </div>
            <ChevronDown className="transition-transform duration-200 group-open:rotate-180" />
          </summary>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40 xl:col-span-2">
              <h5 className="mb-4 font-black">Avizier Cost per Month</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.avizier_cost_series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Legend wrapperStyle={legendStyle} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} itemSorter={historyItemSorter} />
                    <Line type="monotone" dataKey="cost" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} name="Cost" />
                    <Line type="monotone" dataKey="last_year_cost" stroke="#0f766e" strokeWidth={3} connectNulls dot={false} name="Last Year" />
                    <Line type="monotone" dataKey="forecast_cost" stroke="#f97316" strokeWidth={3} strokeDasharray="8 6" connectNulls dot={false} name="Average Over the Years" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40 xl:col-span-2">
              <h5 className="mb-4 font-black">Compare Locations for Avizier</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.avizier_location_comparison}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis dataKey="location_name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Legend wrapperStyle={legendStyle} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: 'var(--color-on-surface)' }}
                      itemStyle={{ color: 'var(--color-on-surface)' }}
                      formatter={costTooltipFormatter}
                    />
                    <Bar dataKey="cost" fill="#0f766e" radius={[10, 10, 0, 0]} name="Cost" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-sm opacity-70">The comparison uses the current period filter across all locations and compares the avizier statement totals side by side.</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white/70 dark:bg-slate-900/40 xl:col-span-2">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="px-4 py-3 font-black">Month</th>
                    <th className="px-4 py-3 font-black">Avizier Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.avizier_cost_series.map((point) => (
                    <tr key={point.label} className="border-t border-outline-variant">
                      <td className="px-4 py-3 font-semibold">{point.label}</td>
                      <td className="px-4 py-3">{formatMoney(point.cost)}</td>
                    </tr>
                  ))}
                  {report.avizier_cost_series.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 opacity-70" colSpan={2}>No avizier data is available for the selected period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="xl:col-span-2">
              <div className="mb-4">
                <h5 className="font-black">Avizier Utilities</h5>
                <p className="mt-1 text-sm opacity-70">Expand a subsection to inspect monthly cost, consumption, unit cost where available, history, and location comparison for that avizier utility.</p>
              </div>
              <div className="space-y-5">
                {report.avizier_sections.map((section, index) => (
                  <details key={`avizier-section-${section.category_id}`} className="group rounded-3xl border border-outline-variant bg-surface-container p-6" open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Avizier Utility</p>
                        <h4 className="mt-1 font-headline text-2xl font-black">{section.category_name}</h4>
                        <p className="mt-2 text-sm opacity-70">
                          {formatMoney(section.total_cost)} spent • {section.total_consumption.toFixed(2)} {section.unit} consumed • {formatUnitCost(section.avg_unit_cost, section.unit)}
                        </p>
                      </div>
                      <ChevronDown className="transition-transform duration-200 group-open:rotate-180" />
                    </summary>

                    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                      <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                        <h5 className="mb-4 font-black">Cost per Month</h5>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={section.monthly_series}>
                              <defs>
                                <linearGradient id={`avizier-costArea-${section.category_id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Legend wrapperStyle={legendStyle} />
                              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} />
                              <Area type="monotone" dataKey="cost" stroke="#2563eb" fill={`url(#avizier-costArea-${section.category_id})`} strokeWidth={3} name="Cost" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                        <h5 className="mb-4 font-black">Consumption per Month</h5>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={section.monthly_series}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Legend wrapperStyle={legendStyle} />
                              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={consumptionTooltipFormatter(section.unit)} />
                              <Bar dataKey="consumption" fill="#14b8a6" radius={[10, 10, 0, 0]} name="Consumption" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                        <h5 className="mb-4 font-black">Unit Cost</h5>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={section.monthly_series}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Legend wrapperStyle={legendStyle} />
                              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={unitCostTooltipFormatter(section.unit)} />
                              <Line type="monotone" dataKey="unit_cost" stroke="#7c3aed" strokeWidth={3} connectNulls dot={{ r: 3 }} name="Unit Cost" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40">
                        <h5 className="mb-4 font-black">History Comparison</h5>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={section.monthly_series}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                              <XAxis dataKey="label" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Legend wrapperStyle={legendStyle} />
                              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--color-on-surface)' }} itemStyle={{ color: 'var(--color-on-surface)' }} formatter={costTooltipFormatter} itemSorter={historyItemSorter} />
                              <Line type="monotone" dataKey="cost" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} name="Cost" />
                              <Line type="monotone" dataKey="last_year_cost" stroke="#0f766e" strokeWidth={3} connectNulls dot={false} name="Last Year" />
                              <Line type="monotone" dataKey="forecast_cost" stroke="#f97316" strokeWidth={3} strokeDasharray="8 6" connectNulls dot={false} name="Average Over the Years" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-outline-variant bg-white/70 p-5 dark:bg-slate-900/40 xl:col-span-2">
                        <h5 className="mb-4 font-black">Compare Locations for {section.category_name}</h5>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={section.location_comparison}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                              <XAxis dataKey="location_name" axisLine={false} tickLine={false} />
                              <YAxis axisLine={false} tickLine={false} />
                              <Legend wrapperStyle={legendStyle} />
                              <Tooltip
                                contentStyle={tooltipStyle}
                                labelStyle={{ color: 'var(--color-on-surface)' }}
                                itemStyle={{ color: 'var(--color-on-surface)' }}
                                formatter={(value, name) => {
                                  if (name === 'Cost') {
                                    return costTooltipFormatter(value, name);
                                  }
                                  return unitCostTooltipFormatter(section.unit)(value, name);
                                }}
                              />
                              <Bar dataKey="cost" fill="#0f766e" radius={[10, 10, 0, 0]} name="Cost" />
                              <Bar dataKey="unit_cost" fill="#7c3aed" radius={[10, 10, 0, 0]} name="Unit Cost" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-3 text-sm opacity-70">The comparison uses the current period filter across all locations so you can benchmark this avizier utility side by side.</p>
                      </div>
                    </div>
                  </details>
                ))}
                {report.avizier_sections.length === 0 && (
                  <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
                    <p className="text-sm opacity-70">No avizier utility subsections are available for the selected filters.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
};

export default Dashboard;
