import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line
} from 'recharts';
import { TrendingUp, Calendar, Plus, Loader2, X, Droplets, BarChart3, PieChart, Info } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

type WidgetType = 'consumption' | 'price' | 'price_per_unit' | 'avg_price_provider' | 'avg_cons_provider';

interface Widget {
  id: string;
  type: WidgetType;
  category: string;
  title: string;
}

const Dashboard: React.FC = () => {
  const { user, setUser } = useAuth();
  const [period, setPeriod] = useState('6m');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, count: 0, lastReading: 'N/A' });
  
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);

  // Initialize widgets from user config or default
  useEffect(() => {
    if (user?.dashboard_config) {
      try {
        setWidgets(JSON.parse(user.dashboard_config));
      } catch (e) {
        setWidgets([{ id: 'default', type: 'consumption', category: 'All', title: 'Global Consumption' }]);
      }
    } else if (!loading && !user?.dashboard_config) {
      setWidgets([{ id: 'default', type: 'consumption', category: 'All', title: 'Global Consumption' }]);
    }
  }, [user, loading]);

  const saveWidgets = async (newWidgets: Widget[]) => {
    setWidgets(newWidgets);
    try {
      const response = await api.put('/auth/me', { 
        email: user?.email,
        dashboard_config: JSON.stringify(newWidgets) 
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to save dashboard config', error);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/invoices/');
        const invs = response.data;
        setInvoices(invs);
        
        const total = invs.reduce((acc: number, inv: any) => acc + inv.amount, 0);
        const lastReading = invs.length > 0 ? invs[0].invoice_date : 'N/A';
        setStats({ total, count: invs.length, lastReading });

        const monthlyAggregation: { [key: string]: any } = {};
        invs.forEach((inv: any) => {
          const month = inv.invoice_date.substring(0, 7);
          if (!monthlyAggregation[month]) {
            monthlyAggregation[month] = { name: month, electricity: 0, gas: 0, water: 0, electricity_price: 0, gas_price: 0, water_price: 0 };
          }
          const cat = inv.provider?.category?.name?.toLowerCase();
          if (cat === 'electricity' || cat === 'gas' || cat === 'water') {
            monthlyAggregation[month][cat] += inv.consumption_value || 0;
            monthlyAggregation[month][`${cat}_price`] += inv.amount || 0;
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

  const addWidget = (type: WidgetType, category: string, title: string) => {
    const newWidget: Widget = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      category,
      title
    };
    saveWidgets([...widgets, newWidget]);
    setShowAddWidget(false);
  };

  const removeWidget = (id: string) => {
    saveWidgets(widgets.filter(w => w.id !== id));
  };

  const renderWidgetContent = (widget: Widget) => {
    if (data.length === 0) return <div className="h-full flex items-center justify-center opacity-40 font-bold uppercase tracking-widest">No data for analysis</div>;

    if (widget.type === 'consumption') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
              <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
              <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }} />
            {(widget.category === 'All' || widget.category === 'Electricity') && <Area type="monotone" dataKey="electricity" stroke="#3b82f6" fill="url(#colorElec)" strokeWidth={3} />}
            {(widget.category === 'All' || widget.category === 'Gas') && <Area type="monotone" dataKey="gas" stroke="#f59e0b" fill="url(#colorGas)" strokeWidth={3} />}
            {(widget.category === 'All' || widget.category === 'Water') && <Area type="monotone" dataKey="water" stroke="#10b981" fill="url(#colorWater)" strokeWidth={3} />}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (widget.type === 'price') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }} />
            {(widget.category === 'All' || widget.category === 'Electricity') && <Bar dataKey="electricity_price" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Electricity (RON)" />}
            {(widget.category === 'All' || widget.category === 'Gas') && <Bar dataKey="gas_price" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Gas (RON)" />}
            {(widget.category === 'All' || widget.category === 'Water') && <Bar dataKey="water_price" fill="#10b981" radius={[4, 4, 0, 0]} name="Water (RON)" />}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (widget.type === 'price_per_unit') {
      const ppuData = data.map(d => ({
        name: d.name,
        electricity: d.electricity > 0 ? d.electricity_price / d.electricity : 0,
        gas: d.gas > 0 ? d.gas_price / d.gas : 0,
        water: d.water > 0 ? d.water_price / d.water : 0
      }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ppuData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }} />
            {(widget.category === 'All' || widget.category === 'Electricity') && <Line type="monotone" dataKey="electricity" stroke="#3b82f6" strokeWidth={3} name="Electricity RON/Unit" />}
            {(widget.category === 'All' || widget.category === 'Gas') && <Line type="monotone" dataKey="gas" stroke="#f59e0b" strokeWidth={3} name="Gas RON/Unit" />}
            {(widget.category === 'All' || widget.category === 'Water') && <Line type="monotone" dataKey="water" stroke="#10b981" strokeWidth={3} name="Water RON/Unit" />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (widget.type === 'avg_price_provider' || widget.type === 'avg_cons_provider') {
      const providerStats: {[key: string]: { total: number, count: number }} = {};
      invoices.forEach(inv => {
        const cat = inv.provider?.category?.name;
        if (widget.category !== 'All' && cat !== widget.category) return;
        const name = inv.provider?.name;
        if (!providerStats[name]) providerStats[name] = { total: 0, count: 0 };
        providerStats[name].total += widget.type === 'avg_price_provider' ? inv.amount : inv.consumption_value;
        providerStats[name].count += 1;
      });
      const barData = Object.entries(providerStats).map(([name, s]) => ({ name, value: s.total / s.count }));
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" opacity={0.1} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 10}} />
            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-outline-variant)' }} />
            <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  if (loading && invoices.length === 0) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500 text-on-surface">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="font-headline text-3xl font-extrabold">Household Overview</h2>
          <p className="text-on-surface-variant font-medium opacity-70">Real-time spending and resource flow intelligence.</p>
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
          <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-blue-600 mb-4">
            <TrendingUp size={24} />
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Cumulative Spend</h3>
          <div className="text-2xl font-black">{stats.total.toFixed(2)} <span className="text-sm font-bold opacity-50 text-on-surface-variant">RON</span></div>
        </div>
        
        <div className="bg-surface-container p-6 rounded-2xl border border-outline-variant hover:shadow-lg transition-all duration-300">
          <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center text-emerald-600 mb-4">
            <Calendar size={24} />
          </div>
          <h3 className="text-on-surface-variant text-sm font-bold uppercase tracking-wider mb-1">Latest Entry</h3>
          <div className="text-2xl font-black">{stats.lastReading}</div>
        </div>
        
        <button 
          onClick={() => setShowAddWidget(true)}
          className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all duration-300 group"
        >
          <Plus size={32} className="text-outline group-hover:text-emerald-500 transition-colors" />
          <span className="text-xs font-bold text-on-surface-variant group-hover:text-emerald-500 mt-2 uppercase tracking-widest">Expand Intelligence</span>
        </button>
      </div>

      {/* Dynamic Widgets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {widgets.map(widget => (
          <div key={widget.id} className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm relative group min-h-[400px]">
            <button 
              onClick={() => removeWidget(widget.id)}
              className="absolute top-6 right-6 p-2 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
            >
              <X size={20} />
            </button>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-headline text-xl font-extrabold">{widget.title}</h3>
                <p className="text-[10px] font-black uppercase text-on-surface-variant opacity-40">{widget.type.replace(/_/g, ' ')} Analysis</p>
              </div>
              <div className="flex gap-2">
                {(widget.category === 'All' || widget.category === 'Electricity') && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-[8px] font-black text-blue-600 uppercase">Elec</span>
                  </div>
                )}
                {(widget.category === 'All' || widget.category === 'Gas') && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    <span className="text-[8px] font-black text-amber-600 uppercase">Gas</span>
                  </div>
                )}
                {(widget.category === 'All' || widget.category === 'Water') && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md border border-emerald-200/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] font-black text-emerald-600 uppercase">Water</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="h-[280px]">
              {renderWidgetContent(widget)}
            </div>
          </div>
        ))}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="font-headline text-xl font-black">Intelligence Configuration</h3>
              <button onClick={() => setShowAddWidget(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
              <p className="col-span-full text-[10px] font-black uppercase text-on-surface-variant tracking-widest mb-2 opacity-50">Spending Analysis</p>
              <button onClick={() => addWidget('price', 'All', 'Global Spending')} className="p-4 bg-surface-container rounded-2xl flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-outline-variant transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><TrendingUp size={20} /></div>
                <div className="text-left"><p className="font-bold text-sm">Monthly Costs</p><p className="text-[9px] uppercase opacity-40">All categories</p></div>
              </button>
              <button onClick={() => addWidget('avg_price_provider', 'All', 'Provider Average Cost')} className="p-4 bg-surface-container rounded-2xl flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-outline-variant transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><BarChart3 size={20} /></div>
                <div className="text-left"><p className="font-bold text-sm">Avg Price/Provider</p><p className="text-[9px] uppercase opacity-40">Cost benchmark</p></div>
              </button>

              <p className="col-span-full text-[10px] font-black uppercase text-on-surface-variant tracking-widest mt-4 mb-2 opacity-50">Resource Flow</p>
              <button onClick={() => addWidget('consumption', 'All', 'Global Consumption')} className="p-4 bg-surface-container rounded-2xl flex items-center gap-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-outline-variant transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><Droplets size={20} /></div>
                <div className="text-left"><p className="font-bold text-sm">Resource Load</p><p className="text-[9px] uppercase opacity-40">Usage profiles</p></div>
              </button>
              <button onClick={() => addWidget('avg_cons_provider', 'All', 'Provider Average Consumption')} className="p-4 bg-surface-container rounded-2xl flex items-center gap-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-outline-variant transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><PieChart size={20} /></div>
                <div className="text-left"><p className="font-bold text-sm">Avg Load/Provider</p><p className="text-[9px] uppercase opacity-40">Usage benchmark</p></div>
              </button>

              <p className="col-span-full text-[10px] font-black uppercase text-on-surface-variant tracking-widest mt-4 mb-2 opacity-50">Efficiency Metrics</p>
              <button onClick={() => addWidget('price_per_unit', 'All', 'Price Efficiency')} className="p-4 bg-surface-container rounded-2xl flex items-center gap-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-outline-variant transition-all">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600"><Info size={20} /></div>
                <div className="text-left"><p className="font-bold text-sm">RON / Unit</p><p className="text-[9px] uppercase opacity-40">Cost per resource</p></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
