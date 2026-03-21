import React, { useState } from 'react';
import { MapPin, Tag, Building2, Moon, Sun, Plus } from 'lucide-react';

const Config: React.FC = () => {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Configuration</h2>
        <p className="text-gray-500 dark:text-gray-400">Manage your locations, providers, and preferences.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Locations Section */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
              <MapPin size={24} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Locations</h3>
            </div>
            <button className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {['AP12', 'AP15'].map((loc) => (
              <div key={loc} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg group">
                <span className="font-medium text-gray-900 dark:text-white">{loc}</span>
                <button className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">Remove</button>
              </div>
            ))}
          </div>
        </section>

        {/* Categories Section */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3 text-emerald-600 dark:text-emerald-400">
              <Tag size={24} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Categories</h3>
            </div>
            <button className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition">
              <Plus size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['Electricity', 'Water', 'Gas', 'Internet'].map((cat) => (
              <div key={cat} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-900 dark:text-white font-medium text-center">
                {cat}
              </div>
            ))}
          </div>
        </section>

        {/* Providers Section */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors md:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <Building2 size={24} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Active Providers</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {['Hidroelectrica', 'ENGIE', 'Apa Nova', 'Digi', 'Orange'].map((prov) => (
              <div key={prov} className="flex items-center justify-between p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition">
                <span className="font-bold text-gray-800 dark:text-gray-200">{prov}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded font-bold uppercase">Romania</span>
              </div>
            ))}
          </div>
        </section>

        {/* Preferences Section */}
        <section className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors md:col-span-2">
          <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">System Preferences</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Display Theme</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark modes.</div>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow transition-all border border-gray-200 dark:border-gray-600"
            >
              {theme === 'light' ? <Moon size={24} className="text-gray-600" /> : <Sun size={24} className="text-amber-400" />}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Config;
