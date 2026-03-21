import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { TrendingUp, Calendar, Plus, Zap, Flame, Loader2 } from 'lucide-react';
import api from '../utils/api';

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState('6m');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, count: 0, lastReading: 'N/A' });
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/invoices/');
        const invoices = response.data;
        
        // Calculate basic stats
        const total = invoices.reduce((acc: number, inv: any) => acc + inv.amount, 0);
        const lastReading = invoices.length > 0 ? invoices[0].billing_date : 'N/A';
        
        setStats({ total, count: invoices.length, lastReading });
        
        // Format data for chart (grouping by month and category)
        const monthlyAggregation: { [key: string]: any } = {};
        
        invoices.forEach((inv: any) => {
          const month = inv.billing_date.substring(0, 7); // YYYY-MM
          if (!monthlyAggregation[month]) {
            monthlyAggregation[month] = { name: month, electricity: 0, gas: 0, water: 0 };
          }
          const category = inv.provider?.category?.name?.toLowerCase();
          if (category && monthlyAggregation[month].hasOwnProperty(category)) {
            monthlyAggregation[month][category] += inv.consumption_value || 0;
          }
        });

        // Convert to array and sort by month
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

  if (loading) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-blue-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Cumulative Spend</h3>
          <div className="text-2xl font-black text-on-surface">{stats.total.toFixed(2)} <span className="text-sm font-bold opacity-50">RON</span></div>
        </div>
        
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center text-emerald-600">
              <Calendar size={24} />
            </div>
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Latest Entry</h3>
          <div className="text-2xl font-black text-on-surface">{stats.lastReading}</div>
        </div>
        
        <button 
          onClick={() => alert('Add Widget functionality will be available in the next update.')}
          className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all duration-300 group"
        >
          <Plus size={32} className="text-outline group-hover:text-emerald-500 transition-colors" />
          <span className="text-xs font-bold text-on-surface-variant group-hover:text-emerald-500 mt-2 uppercase tracking-widest">Add Widget</span>
        </button>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-headline text-xl font-extrabold text-on-surface">Consumption Trends</h3>
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
          
          <div className="h-[400px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-on-surface-variant opacity-40 font-bold uppercase tracking-widest">Insufficient data for analysis</div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
