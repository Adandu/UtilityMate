import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Calendar, Plus, Loader2, X, Zap, Droplets, Flame } from 'lucide-react';
import api from '../utils/api';

interface Widget {
  id: string;
  type: 'chart' | 'stat';
  category: string;
  title: string;
}

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState('6m');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, count: 0, lastReading: 'N/A' });
  
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: '1', type: 'chart', category: 'All', title: 'Consumption Trends' }
  ]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/invoices/');
        const invoices = response.data;
        
        const total = invoices.reduce((acc: number, inv: any) => acc + inv.amount, 0);
        const lastReading = invoices.length > 0 ? invoices[0].invoice_date : 'N/A';

        setStats({ total, count: invoices.length, lastReading });

        const monthlyAggregation: { [key: string]: any } = {};

        invoices.forEach((inv: any) => {
          const month = inv.invoice_date.substring(0, 7);          if (!monthlyAggregation[month]) {
            monthlyAggregation[month] = { name: month, electricity: 0, gas: 0, water: 0 };
          }
          const category = inv.provider?.category?.name?.toLowerCase();
          if (category && monthlyAggregation[month].hasOwnProperty(category)) {
            monthlyAggregation[month][category] += inv.consumption_value || 0;
          }
        });

        const chartData = Object.values(monthlyAggregation)
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
          .slice(period === '3m' ? -3 : period === '6m' ? -6 : -12);
        
        setData(chartData);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [period]);

  const addWidget = (category: string) => {
    const newWidget: Widget = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'chart',
      category,
      title: `${category} Focus`
    };
    setWidgets([...widgets, newWidget]);
    setShowAddWidget(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  if (loading) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 text-on-surface">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Household Overview</h2>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 text-on-surface">
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-blue-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Cumulative Spend</h3>
          <div className="text-2xl font-black">{stats.total.toFixed(2)} <span className="text-sm font-bold opacity-50 text-on-surface-variant">RON</span></div>
        </div>
        
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center text-emerald-600">
              <Calendar size={24} />
            </div>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Latest Entry</h3>
          <div className="text-2xl font-black">{stats.lastReading}</div>
        </div>
        
        <button 
          onClick={() => setShowAddWidget(true)}
          className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all duration-300 group"
        >
          <Plus size={32} className="text-outline group-hover:text-emerald-500 transition-colors" />
          <span className="text-xs font-bold text-on-surface-variant group-hover:text-emerald-500 mt-2 uppercase tracking-widest">Add Widget</span>
        </button>
      </div>

      {/* Dynamic Widgets Section */}
      <div className="grid grid-cols-1 gap-8">
        {widgets.map(widget => (
          <div key={widget.id} className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm relative group text-on-surface">
            <button 
              onClick={() => removeWidget(widget.id)}
              className="absolute top-6 right-6 p-2 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={20} />
            </button>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-headline text-xl font-extrabold">{widget.title}</h3>
              <div className="flex gap-2">
                {(widget.category === 'All' || widget.category === 'Electricity') && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Electricity</span>
                  </div>
                )}
                {(widget.category === 'All' || widget.category === 'Gas') && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase">Gas</span>
                  </div>
                )}
                {(widget.category === 'All' || widget.category === 'Water') && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Water</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="h-[400px]">
              {data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-on-surface-variant opacity-40 font-bold uppercase tracking-widest text-on-surface">Insufficient data for analysis</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 12, fontWeight: 600}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 12, fontWeight: 600}} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--color-surface)', 
                        borderRadius: '16px', 
                        border: '1px solid var(--color-outline-variant)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        color: 'var(--color-on-surface)'
                      }}
                    />
                    {(widget.category === 'All' || widget.category === 'Electricity') && (
                      <Area type="monotone" dataKey="electricity" stroke="#3b82f6" fillOpacity={1} fill="url(#colorElec)" strokeWidth={4} />
                    )}
                    {(widget.category === 'All' || widget.category === 'Gas') && (
                      <Area type="monotone" dataKey="gas" stroke="#f59e0b" fillOpacity={1} fill="url(#colorGas)" strokeWidth={4} />
                    )}
                    {(widget.category === 'All' || widget.category === 'Water') && (
                      <Area type="monotone" dataKey="water" stroke="#10b981" fillOpacity={1} fill="url(#colorWater)" strokeWidth={4} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-on-surface">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline text-xl font-black">Intelligence Expansion</h3>
              <button onClick={() => setShowAddWidget(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-4">
              <p className="text-sm font-medium text-on-surface-variant opacity-70 mb-6 uppercase tracking-widest">Select Analytical Focus</p>
              
              <button 
                onClick={() => addWidget('Electricity')}
                className="w-full p-6 bg-surface-container rounded-3xl flex items-center gap-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-500/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Zap size={24} />
                </div>
                <div className="text-left">
                  <p className="font-headline font-bold text-on-surface">Electricity Analytics</p>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant opacity-40">Load & Consumption Profile</p>
                </div>
              </button>

              <button 
                onClick={() => addWidget('Gas')}
                className="w-full p-6 bg-surface-container rounded-3xl flex items-center gap-4 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-transparent hover:border-orange-500/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                  <Flame size={24} />
                </div>
                <div className="text-left">
                  <p className="font-headline font-bold text-on-surface">Gas Network Analytics</p>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant opacity-40">Thermal Energy Tracking</p>
                </div>
              </button>

              <button 
                onClick={() => addWidget('Water')}
                className="w-full p-6 bg-surface-container rounded-3xl flex items-center gap-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-transparent hover:border-emerald-500/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                  <Droplets size={24} />
                </div>
                <div className="text-left">
                  <p className="font-headline font-bold text-on-surface">Water Consumption</p>
                  <p className="text-[10px] font-black uppercase text-on-surface-variant opacity-40">Resource Flow Analysis</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
