import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Database, Settings, LogOut } from 'lucide-react';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">UtilityMate</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">Antigravity Edition v1.0.1</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex items-center space-x-3 p-3 rounded-lg transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/invoices" 
          className={({ isActive }) => `flex items-center space-x-3 p-3 rounded-lg transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Receipt size={20} />
          <span>Invoices</span>
        </NavLink>
        
        <NavLink 
          to="/data" 
          className={({ isActive }) => `flex items-center space-x-3 p-3 rounded-lg transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Database size={20} />
          <span>Raw Data</span>
        </NavLink>
        
        <NavLink 
          to="/config" 
          className={({ isActive }) => `flex items-center space-x-3 p-3 rounded-lg transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Settings size={20} />
          <span>Configuration</span>
        </NavLink>
      </nav>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button 
          onClick={onLogout}
          className="flex items-center space-x-3 p-3 w-full rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
