import React, { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, Package, Server, ScrollText } from 'lucide-react';
import api from '../utils/api';

interface AppStats {
  invoices: number;
  locations: number;
  providers: number;
  categories: number;
  households: number;
  manual_meter_readings: number;
  unread_alerts: number;
}

interface AppEnvironmentInfo {
  api_version: string;
  database_dialect: string;
  upload_dir: string;
  app_env: string;
  allowed_origins: string[];
  server_time_utc: string;
}

interface AboutResponse {
  version: string;
  release_notes_markdown: string;
  stats: AppStats;
  environment: AppEnvironmentInfo;
}

const About: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [about, setAbout] = useState<AboutResponse | null>(null);

  useEffect(() => {
    const fetchAbout = async () => {
      setLoading(true);
      try {
        const response = await api.get<AboutResponse>('/analytics/about');
        setAbout(response.data);
      } finally {
        setLoading(false);
      }
    };
    fetchAbout();
  }, []);

  const releaseLines = useMemo(() => (
    about?.release_notes_markdown.split('\n').filter((line) => line.trim().length > 0) || []
  ), [about]);

  if (loading || !about) {
    return <div className="ml-64 flex min-h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-emerald-500" size={48} /></div>;
  }

  const statCards = [
    { label: 'Invoices', value: about.stats.invoices },
    { label: 'Locations', value: about.stats.locations },
    { label: 'Providers', value: about.stats.providers },
    { label: 'Categories', value: about.stats.categories },
    { label: 'Households', value: about.stats.households },
    { label: 'Manual Meter Readings', value: about.stats.manual_meter_readings },
  ];

  return (
    <div className="ml-64 min-h-screen bg-surface p-8 text-on-surface">
      <header className="mb-8 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-emerald-600">
            <Info size={22} />
          </div>
          <div>
            <h2 className="font-headline text-3xl font-extrabold">About UtilityMate</h2>
            <p className="text-on-surface-variant opacity-70">Version, latest changelog, environment details, and instance statistics.</p>
          </div>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <div className="mb-5 flex items-center gap-3">
            <Package className="text-blue-600" />
            <h3 className="font-headline text-xl font-black">Version & Changelog</h3>
          </div>
          <div className="mb-5 rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Current Version</p>
            <p className="mt-2 text-3xl font-black">{about.version}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
            <div className="mb-4 flex items-center gap-2">
              <ScrollText className="text-emerald-600" size={18} />
              <p className="font-black">Latest Release Notes</p>
            </div>
            <div className="space-y-2 text-sm leading-6">
              {releaseLines.map((line, index) => (
                <p
                  key={`${line}-${index}`}
                  className={
                    line.startsWith('##')
                      ? 'mt-4 text-base font-black'
                      : line.startsWith('#')
                        ? 'font-headline text-lg font-black'
                        : line.startsWith('-')
                          ? 'pl-4 opacity-85'
                          : 'opacity-85'
                  }
                >
                  {line.replace(/^#+\s*/, '').replace(/^- /, '• ')}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-5 flex items-center gap-3">
              <Server className="text-amber-600" />
              <h3 className="font-headline text-xl font-black">Environment</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">API Version</p>
                <p className="mt-2 font-bold">{about.environment.api_version}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Environment</p>
                <p className="mt-2 font-bold">{about.environment.app_env}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Database</p>
                <p className="mt-2 font-bold">{about.environment.database_dialect}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Upload Directory</p>
                <p className="mt-2 break-all font-bold">{about.environment.upload_dir}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Allowed Origins</p>
                <p className="mt-2 font-bold">{about.environment.allowed_origins.join(', ')}</p>
              </div>
              <div className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">Server Time (UTC)</p>
                <p className="mt-2 font-bold">{new Date(about.environment.server_time_utc).toLocaleString()}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant bg-surface-container-low p-6">
            <h3 className="mb-5 font-headline text-xl font-black">Instance Statistics</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-outline-variant bg-white/70 p-4 dark:bg-slate-900/40">
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-50">{card.label}</p>
                  <p className="mt-2 text-2xl font-black">{card.value}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
};

export default About;
