import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { TrendingUp, AlertCircle, Calendar, Plus } from 'lucide-react';

// Mock data for initial prototype
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Household Overview</h2>
          <p className="text-gray-500 dark:text-gray-400">Welcome back, everything looks stable on the grid.</p>
        </div>
        
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          {['3m', '6m', '1y'].map((p) => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${period === p ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400 mb-4">
            <TrendingUp size={24} />
            <h3 className="font-semibold">Total Spend</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">432.50 RON</div>
          <div className="text-xs text-green-600 mt-1">↓ 12% from last month</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 mb-4">
            <AlertCircle size={24} />
            <h3 className="font-semibold">Unpaid Bills</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">2 Invoices</div>
          <div className="text-xs text-gray-500 mt-1">Due in 5 days</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400 mb-4">
            <Calendar size={24} />
            <h3 className="font-semibold">Last Reading</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">Mar 15</div>
          <div className="text-xs text-gray-500 mt-1">Electricity (AP12)</div>
        </div>
        
        <button className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group">
          <Plus size={32} className="text-gray-400 group-hover:text-blue-500 transition" />
          <span className="text-sm font-medium text-gray-500 group-hover:text-blue-500 mt-2">Add Widget</span>
        </button>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Consumption Trends</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consumptionData}>
                <defs>
                  <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Area type="monotone" dataKey="electricity" stroke="#3b82f6" fillOpacity={1} fill="url(#colorElec)" strokeWidth={3} />
                <Area type="monotone" dataKey="gas" stroke="#f59e0b" fillOpacity={0} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white">Spending by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consumptionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Line type="step" dataKey="water" stroke="#10b981" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
