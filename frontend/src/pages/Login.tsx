import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../utils/api';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await api.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      onLogin(response.data.access_token);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Invalid credentials. Access denied.');
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
          <div className="w-16 h-16 bg-primary-container rounded-2xl flex items-center justify-center text-on-primary-fixed mx-auto mb-6 shadow-lg">
            <Shield size={32} />
          </div>
          <h2 className="font-headline text-3xl font-black text-on-surface tracking-tight">Login</h2>
          <p className="text-on-surface-variant font-medium mt-2 opacity-60 uppercase text-[10px] tracking-[0.2em]">Access your UtilityMate account</p>
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
              className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
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
              className="w-full p-4 rounded-2xl bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary-container text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:transform-none mt-8 group"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              <>
                <span className="uppercase tracking-[0.1em] text-sm">Login</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        
        <div className="mt-10 text-center">
          <p className="text-xs font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-4">Need an account?</p>
          <button 
            onClick={() => navigate('/register')}
            className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
