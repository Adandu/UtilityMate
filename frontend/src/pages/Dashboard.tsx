import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, AlertCircle, Calendar, Plus, Zap, Droplets, Flame } from 'lucide-react';

const consumptionData = [
  { name: 'Oct', electricity: 120, water: 8, gas: 45 },
  { name: 'Nov', electricity: 145, water: 7, gas: 80 },
  { name: 'Dec', electricity: 180, water: 9, gas: 150 },
  { name: 'Jan', electricity: 190, water: 8, gas: 160 },
  { name: 'Feb', electricity: 160, water: 7, gas: 120 },
  { name: 'Mar', electricity: 140, water: 8, gas: 90 },
];

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState('6m');
  
  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-on-surface">Household Overview</h2>
          <p className="text-on-surface-variant font-medium opacity-70">Real-time utility performance and spend analysis.</p>
        </div>
        
        <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant shadow-sm">
          {['3m', '6m', '1y'].map((p) => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${period === p ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-blue-600">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg">↓ 12%</span>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Monthly Spend</h3>
          <div className="text-2xl font-black text-on-surface">432.50 <span className="text-sm font-bold opacity-50">RON</span></div>
        </div>
        
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-error-container flex items-center justify-center text-error">
              <AlertCircle size={24} />
            </div>
            <span className="text-xs font-bold text-error bg-error-container/50 px-2 py-1 rounded-lg">Action Req</span>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Unpaid Bills</h3>
          <div className="text-2xl font-black text-on-surface">2 <span className="text-sm font-bold opacity-50">Invoices</span></div>
        </div>
        
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center text-emerald-600">
              <Calendar size={24} />
            </div>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Last Reading</h3>
          <div className="text-2xl font-black text-on-surface">Mar 15</div>
          <p className="text-[10px] text-on-surface-variant opacity-60 font-bold mt-1">ELECTRICITY (AP12)</p>
        </div>
        
        <button className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all duration-300 group">
          <Plus size={32} className="text-outline group-hover:text-emerald-500 transition-colors" />
          <span className="text-xs font-bold text-on-surface-variant group-hover:text-emerald-500 mt-2 uppercase tracking-widest">Add Widget</span>
        </button>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline text-xl font-extrabold text-on-surface">Consumption Intelligence</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Electricity</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-[10px] font-bold text-amber-600 uppercase">Gas</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consumptionData}>
                <defs>
                  <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 12, fontWeight: 600}} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 12, fontWeight: 600}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.8)', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(0,0,0,0.05)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Area type="monotone" dataKey="electricity" stroke="#3b82f6" fillOpacity={1} fill="url(#colorElec)" strokeWidth={4} />
                <Area type="monotone" dataKey="gas" stroke="#f59e0b" fillOpacity={1} fill="url(#colorGas)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Breakdowns */}
        <div className="space-y-6">
          <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4 opacity-80">
                <Zap size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Active Node</span>
              </div>
              <h4 className="text-2xl font-black mb-1">MasterChief</h4>
              <p className="text-sm opacity-80 font-medium">Primary Docker Host & Monitoring</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xl font-black">98%</div>
                  <div className="text-[10px] uppercase font-bold opacity-60">Uptime</div>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-xl font-black">42ms</div>
                  <div className="text-[10px] uppercase font-bold opacity-60">Latency</div>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
              <Zap size={120} />
            </div>
          </div>

          <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant">
            <h4 className="font-headline text-sm font-extrabold uppercase tracking-widest text-on-surface-variant mb-6">Service Health</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Droplets size={16} />
                  </div>
                  <span className="text-sm font-bold text-on-surface">Water System</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                    <Flame size={16} />
                  </div>
                  <span className="text-sm font-bold text-on-surface">Gas Network</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                    <Zap size={16} />
                  </div>
                  <span className="text-sm font-bold text-on-surface">Grid Connection</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
