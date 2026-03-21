import React, { useState, useEffect } from 'react';
import { MapPin, Building2, Moon, Sun, Plus, Shield, Laptop, Zap, Droplets, Flame, Trash2, Loader2 } from 'lucide-react';
import api from '../utils/api';

interface Location {
  id: number;
  name: string;
  address?: string;
}

interface Provider {
  id: number;
  name: string;
  category_id: number;
}

const Config: React.FC = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locRes, provRes] = await Promise.all([
          api.get('/locations/'),
          api.get('/providers/')
        ]);
        setLocations(locRes.data);
        setProviders(provRes.data);
      } catch (error) {
        console.error('Failed to fetch config data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Sync with backend
    try {
      await api.put('/auth/me', { email: '' }, { params: { theme_pref: newTheme } });
    } catch (error) {
      console.error('Failed to sync theme with backend', error);
    }
  };

  const handleAddLocation = async () => {
    const name = prompt('Enter Location Name (e.g. AP12):');
    if (!name) return;
    try {
      const response = await api.post('/locations/', { name });
      setLocations([...locations, response.data]);
    } catch (error) {
      alert('Failed to add location');
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!window.confirm('Delete this location?')) return;
    try {
      await api.delete(`/locations/${id}`);
      setLocations(locations.filter(l => l.id !== id));
    } catch (error) {
      alert('Failed to delete location');
    }
  };

  if (loading) return (
    <div className="ml-64 flex items-center justify-center min-h-screen bg-surface">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="ml-64 p-8 min-h-screen bg-surface transition-colors duration-300 animate-in fade-in duration-500">
      <header className="mb-10">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface">System Parameters</h2>
        <p className="text-on-surface-variant font-medium opacity-70">Configure your providers, asset locations, and preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Environment Control */}
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 text-blue-600 mb-8">
              <Shield size={24} />
              <h3 className="font-headline text-xl font-extrabold text-on-surface">Preferences</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-surface-container rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-surface-container-high transition-colors" onClick={toggleTheme}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-on-surface shadow-sm">
                    {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-black text-on-surface uppercase tracking-tight">Display Mode</p>
                    <p className="text-[10px] text-on-surface-variant font-bold opacity-60 uppercase">{theme} THEME</p>
                  </div>
                </div>
                <div className="w-12 h-6 rounded-full bg-slate-200 dark:bg-slate-700 relative transition-colors">
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>
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
              <button 
                onClick={handleAddLocation}
                className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Plus size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.length === 0 ? (
                <p className="col-span-2 text-center text-sm text-on-surface-variant opacity-50 py-4">No locations defined. Add one to start tracking invoices.</p>
              ) : locations.map((loc) => (
                <div key={loc.id} className="flex justify-between items-center p-5 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl group hover:border-emerald-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                      <MapPin size={20} />
                    </div>
                    <span className="font-headline font-bold text-on-surface text-lg">{loc.name}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase tracking-widest"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Providers */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 text-amber-600 mb-8">
              <Building2 size={24} />
              <h3 className="font-headline text-xl font-extrabold text-on-surface">Utility Providers</h3>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {providers.map((prov) => (
                <div key={prov.id} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl hover:shadow-md transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20 group-hover:text-amber-600 transition-colors">
                    {prov.name.toLowerCase().includes('hidro') ? <Zap size={24} /> : 
                     prov.name.toLowerCase().includes('engie') ? <Flame size={24} /> : 
                     prov.name.toLowerCase().includes('apa') ? <Droplets size={24} /> : <Building2 size={24} />}
                  </div>
                  <span className="font-headline font-bold text-on-surface text-center leading-tight text-sm">{prov.name}</span>
                </div>
              ))}
              <button 
                onClick={() => alert('New Provider registration is restricted to system administrators.')}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-outline-variant rounded-2xl hover:border-amber-500/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"
              >
                <Plus size={24} className="text-outline group-hover:text-amber-500 transition-colors" />
                <span className="text-[10px] font-bold text-on-surface-variant group-hover:text-amber-500 mt-2 uppercase tracking-widest text-center">Add Custom</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Config;
