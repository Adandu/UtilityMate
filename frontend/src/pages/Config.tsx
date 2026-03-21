import React, { useState } from 'react';
import { MapPin, Tag, Building2, Moon, Sun, Plus, Shield, Laptop, Zap, Droplets, Flame } from 'lucide-react';

const Config: React.FC = () => {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="mb-10">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface">System Parameters</h2>
        <p className="text-on-surface-variant font-medium opacity-70">Configure your environmental variables, providers, and asset locations.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Environment Control */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-8">
              <Shield size={24} />
              <h3 className="font-headline text-xl font-extrabold text-on-surface">Global Access</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-surface-container rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-surface-container-high transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-on-surface shadow-sm">
                    {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface uppercase tracking-tight">Display Mode</p>
                    <p className="text-[10px] text-on-surface-variant font-bold opacity-60">SYSTEM THEME</p>
                  </div>
                </div>
                <button 
                  onClick={toggleTheme}
                  className="w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700 relative transition-colors"
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-surface-container-high transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-on-surface shadow-sm">
                    <Laptop size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface uppercase tracking-tight">Auth Controls</p>
                    <p className="text-[10px] text-on-surface-variant font-bold opacity-60">SECURITY GATEWAY</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant opacity-40">chevron_right</span>
              </div>
            </div>
          </div>

          <div className="bg-primary-container p-8 rounded-3xl text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-headline text-lg font-black mb-2">Antigravity Cloud</h4>
              <p className="text-xs font-medium opacity-70 mb-6">Your data is synchronized across the MasterChief infrastructure.</p>
              <button className="px-6 py-2.5 bg-white text-blue-900 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-colors">
                Node Status
              </button>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10 rotate-45">
              <Zap size={140} />
            </div>
          </div>
        </section>

        {/* Asset & Service Management */}
        <div className="lg:col-span-8 space-y-8">
          {/* Locations */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3 text-emerald-600">
                <MapPin size={24} />
                <h3 className="font-headline text-xl font-extrabold text-on-surface">Asset Locations</h3>
              </div>
              <button className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
                <Plus size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['AP12', 'AP15'].map((loc) => (
                <div key={loc} className="flex justify-between items-center p-5 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl group hover:border-emerald-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                      <MapPin size={20} />
                    </div>
                    <span className="font-headline font-bold text-on-surface text-lg">{loc}</span>
                  </div>
                  <button className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase tracking-widest">Decommission</button>
                </div>
              ))}
            </div>
          </section>

          {/* Providers */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-8">
              <Building2 size={24} />
              <h3 className="font-headline text-xl font-extrabold text-on-surface">Service Providers</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { name: 'Hidroelectrica', type: 'Zap' },
                { name: 'ENGIE', type: 'Flame' },
                { name: 'Apa Nova', type: 'Droplets' },
                { name: 'Digi', type: 'Laptop' },
                { name: 'Orange', type: 'Laptop' }
              ].map((prov) => (
                <div key={prov.name} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl hover:shadow-md transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20 group-hover:text-amber-600 transition-colors">
                    {prov.type === 'Zap' && <Zap size={24} />}
                    {prov.type === 'Flame' && <Flame size={24} />}
                    {prov.type === 'Droplets' && <Droplets size={24} />}
                    {prov.type === 'Laptop' && <Laptop size={24} />}
                  </div>
                  <span className="font-headline font-bold text-on-surface text-center leading-tight">{prov.name}</span>
                  <span className="text-[9px] font-black uppercase text-on-surface-variant opacity-40 mt-2 tracking-widest">Active</span>
                </div>
              ))}
              <button className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-outline-variant rounded-2xl hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group">
                <Plus size={24} className="text-outline group-hover:text-amber-500 transition-colors" />
                <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-amber-500 mt-2 uppercase tracking-widest text-center">Register Provider</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Config;
