import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  return (
    <aside className="h-screen w-64 fixed left-0 top-0 hidden md:flex flex-col bg-slate-100 dark:bg-slate-900 border-none z-40 transition-colors duration-300">
      <div className="flex flex-col h-full p-4 gap-y-2">
        <div className="flex items-center gap-3 px-3 py-6 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary-container/60 flex items-center justify-center overflow-hidden">
            <img src="/favicon.svg" alt="UtilityMate logo" className="h-9 w-9" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-extrabold text-slate-900 dark:text-slate-50">UtilityMate</h1>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold opacity-60">Utility Analytics</p>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-body text-sm">Dashboard</span>
          </NavLink>

          <NavLink 
            to="/invoices" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            <span className="font-body text-sm">Invoices</span>
          </NavLink>

          <NavLink
            to="/association-statements"
            className={({ isActive }) => `ml-6 flex items-center gap-3 px-3 py-2 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-400 dark:text-slate-500 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            <span className="font-body text-sm">Association Statements</span>
          </NavLink>

          <NavLink 
            to="/data" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">database</span>
            <span className="font-body text-sm">Raw Data</span>
          </NavLink>

          <NavLink 
            to="/operations" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">hub</span>
            <span className="font-body text-sm">Operations</span>
          </NavLink>

          <NavLink 
            to="/meters" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">speed</span>
            <span className="font-body text-sm">Meter Readings</span>
          </NavLink>

          <NavLink 
            to="/rent" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">groups</span>
            <span className="font-body text-sm">Rent</span>
          </NavLink>

          <NavLink 
            to="/config" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="font-body text-sm">Configuration</span>
          </NavLink>

          <NavLink 
            to="/about" 
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${isActive ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'}`}
          >
            <span className="material-symbols-outlined">info</span>
            <span className="font-body text-sm">About</span>
          </NavLink>
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors duration-150"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body text-sm font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
