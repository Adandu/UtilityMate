import React, { useState, useEffect } from 'react';
import { MapPin, Building2, Moon, Sun, Plus, Shield, Zap, Droplets, Flame, Loader2, X, Tag, Trash2, Home } from 'lucide-react';
import axios from 'axios';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

interface Location {
  id: number;
  name: string;
  address?: string;
  household_id?: number | null;
}

interface Provider {
  id: number;
  name: string;
  category_id: number;
}

interface Category {
  id: number;
  name: string;
  unit: string;
}

interface Household {
  id: number;
  name: string;
  description?: string;
  members?: { id: number; role: string }[];
}

const Config: React.FC = () => {
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch locations
    try {
      const locRes = await api.get('/locations/');
      setLocations(locRes.data);
    } catch (error) {
      console.error('Failed to fetch locations', error);
    }

    // Fetch providers
    try {
      const provRes = await api.get('/providers/');
      setProviders(provRes.data);
    } catch (error) {
      console.error('Failed to fetch providers', error);
    }

    // Fetch categories
    try {
      const catRes = await api.get('/categories/');
      setCategories(catRes.data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }

    try {
      const householdRes = await api.get('/households/');
      setHouseholds(householdRes.data);
    } catch (error) {
      console.error('Failed to fetch households', error);
    }

    setLoading(false);
  };

  useEffect(() => {
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

    try {
      if (user) {
        const response = await api.put('/auth/me', { email: user.email }, { params: { theme_pref: newTheme } });
        setUser(response.data);
      }
    } catch (error) {
      console.error('Failed to sync theme with backend', error);
    }
  };

  const handleAddLocation = async () => {
    const name = prompt('Enter Location Name (e.g. AP12):');
    if (!name) return;
    try {
      const response = await api.post('/locations/', { name, address: '' });
      setLocations([...locations, response.data]);
    } catch {
      alert('Failed to add location.');
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (!window.confirm('Delete this location?')) return;
    try {
      await api.delete(`/locations/${id}`);
      setLocations(locations.filter(l => l.id !== id));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.detail || 'Failed to delete location');
      } else {
        alert('An unexpected error occurred.');
      }
    }
  };

  const handleAddCategory = async () => {
    const name = prompt('Enter Category Name (e.g. Electricity):');
    if (!name) return;
    const unit = prompt('Enter Unit (e.g. kWh):');
    if (!unit) return;
    
    try {
      const response = await api.post('/categories/', { name, unit });
      setCategories([...categories, response.data]);
    } catch {
      alert('Failed to add category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Delete this category? All associated providers must be deleted first.')) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.detail || 'Failed to delete category');
      } else {
        alert('An unexpected error occurred.');
      }
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProviderName || !selectedCategoryId) return;
    
    try {
      const response = await api.post('/providers/', { 
        name: newProviderName, 
        category_id: parseInt(selectedCategoryId),
        is_custom: true
      });
      setProviders([...providers, response.data]);
      setShowAddProvider(false);
      setNewProviderName('');
      setSelectedCategoryId('');
    } catch {
      alert('Failed to register provider');
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!window.confirm('Delete this provider?')) return;
    try {
      await api.delete(`/providers/${id}`);
      setProviders(providers.filter(p => p.id !== id));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.detail || 'Failed to delete provider');
      } else {
        alert('An unexpected error occurred.');
      }
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-surface md:ml-64">
      <Loader2 className="animate-spin text-emerald-500" size={48} />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface px-4 pb-6 pt-20 transition-colors duration-300 animate-in fade-in sm:px-6 md:ml-64 md:p-8">
      <header className="mb-10 text-on-surface">
        <h2 className="font-headline text-3xl font-extrabold">System Parameters</h2>
        <p className="text-on-surface-variant font-medium opacity-70">Configure your providers, asset locations, and preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-on-surface">
        {/* Sidebar / Preferences */}
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
                    <p className="text-sm font-black uppercase tracking-tight">Display Mode</p>
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
          {/* Categories */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3 text-purple-600">
                <Tag size={24} />
                <h3 className="font-headline text-xl font-extrabold text-on-surface">Utility Categories</h3>
              </div>
              <button 
                onClick={handleAddCategory}
                className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="relative p-4 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl flex flex-col items-center justify-center text-center group hover:border-purple-500/50 transition-all">
                  <span className="font-headline font-bold text-on-surface">{cat.name}</span>
                  <span className="text-[10px] font-black uppercase text-on-surface-variant opacity-40 mt-1">{cat.unit}</span>
                  <button 
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="absolute top-2 right-2 p-1.5 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

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
                    <div>
                      <span className="font-headline font-bold text-lg">{loc.name}</span>
                      {loc.household_id && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-50">
                          {households.find((household) => household.id === loc.household_id)?.name || 'Linked household'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteLocation(loc.id)}
                    className="p-2 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Households */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center gap-3 text-sky-600 mb-8">
              <Home size={24} />
              <h3 className="font-headline text-xl font-extrabold text-on-surface">Households</h3>
            </div>
            {households.length === 0 ? (
              <p className="text-sm text-on-surface-variant opacity-60">No households yet. Create one from Operations and it will appear here.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {households.map((household) => (
                  <div key={household.id} className="p-5 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl">
                    <p className="font-headline font-bold text-lg">{household.name}</p>
                    <p className="text-sm text-on-surface-variant opacity-70">{household.description || 'Shared utility workspace'}</p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest opacity-40">
                      {(household.members?.length || 0)} member records
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Providers */}
          <section className="bg-surface-container-low p-8 rounded-3xl border border-outline-variant shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 text-amber-600">
                <Building2 size={24} />
                <h3 className="font-headline text-xl font-extrabold text-on-surface">Utility Providers</h3>
              </div>
              <button 
                onClick={() => setShowAddProvider(true)}
                className="w-10 h-10 bg-amber-600 text-white rounded-xl flex items-center justify-center hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/20"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {providers.map((prov) => (
                <div key={prov.id} className="relative flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 border border-outline-variant rounded-2xl hover:shadow-md transition-all group hover:border-amber-500/50">
                  <button 
                    onClick={() => handleDeleteProvider(prov.id)}
                    className="absolute top-2 right-2 p-1.5 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20 group-hover:text-amber-600 transition-colors">
                    {prov.name.toLowerCase().includes('hidro') ? <Zap size={24} /> : 
                     prov.name.toLowerCase().includes('engie') ? <Flame size={24} /> : 
                     prov.name.toLowerCase().includes('apa') ? <Droplets size={24} /> : <Building2 size={24} />}
                  </div>
                  <span className="font-headline font-bold text-center leading-tight text-sm">{prov.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Add Provider Modal */}
      {showAddProvider && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-outline-variant flex justify-between items-center bg-surface-container-low text-on-surface">
              <h3 className="font-headline text-xl font-black">Register Provider</h3>
              <button onClick={() => setShowAddProvider(false)} className="text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddProvider} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Provider Name</label>
                <input 
                  type="text" 
                  required
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-medium"
                  placeholder="e.g. Enel, Orange"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Utility Category</label>
                <select 
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-medium appearance-none"
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 mt-8"
              >
                <Plus size={20} />
                <span className="uppercase tracking-[0.1em] text-sm">Add Provider</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Config;
