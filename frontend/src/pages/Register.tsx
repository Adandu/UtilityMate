import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../utils/api';
import { ArrowRight, Loader2, UserPlus } from 'lucide-react';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/register', { email, password });
      navigate('/login');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail[0]?.msg || 'Validation error');
        } else {
          setError('Registration failed. Please check your data.');
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-surface">
      <div className="w-full max-w-md p-10 bg-surface-container-low rounded-[2rem] border border-outline-variant shadow-2xl shadow-slate-200 dark:shadow-none transition-all animate-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-tertiary-container rounded-2xl flex items-center justify-center text-on-tertiary-container mx-auto mb-6 shadow-lg">
            <UserPlus size={32} />
          </div>
          <h2 className="font-headline text-3xl font-black text-on-surface tracking-tight">Register</h2>
          <p className="text-on-surface-variant font-medium mt-2 opacity-60 uppercase text-[10px] tracking-[0.2em]">Create your UtilityMate account</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-error-container text-error border border-error/20 rounded-xl text-xs font-bold flex items-center gap-3 animate-shake">
            <span className="material-symbols-outlined text-sm">report</span>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
              placeholder="user@example.com"
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Confirm Password</label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              maxLength={72}
              className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none mt-8 group"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span className="uppercase tracking-[0.1em] text-sm">Register</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        
        <div className="mt-10 text-center">
          <button 
            onClick={() => navigate('/login')}
            className="text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface hover:underline decoration-2 underline-offset-4 transition-colors"
          >
            Already have an account? Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
