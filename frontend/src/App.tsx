import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Invoices = lazy(() => import('./pages/Invoices'));
const AssociationStatements = lazy(() => import('./pages/AssociationStatements'));
const RawData = lazy(() => import('./pages/RawData'));
const Config = lazy(() => import('./pages/Config'));
const Operations = lazy(() => import('./pages/Operations'));
const About = lazy(() => import('./pages/About'));
const Rent = lazy(() => import('./pages/Rent'));
const MeterReadings = lazy(() => import('./pages/MeterReadings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));

const RouteFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface px-6">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <span className="material-symbols-outlined animate-spin">progress_activity</span>
      <span className="text-sm font-semibold">Loading UtilityMate…</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('token'));

  useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const login = (token: string) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="min-h-screen bg-surface transition-colors duration-300">
        {isAuthenticated && <Sidebar onLogout={logout} />}
        <main className="flex-1">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={!isAuthenticated ? <Login onLogin={login} /> : <Navigate to="/" />} />
              <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />

              <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/invoices" element={isAuthenticated ? <Invoices /> : <Navigate to="/login" />} />
              <Route path="/association-statements" element={isAuthenticated ? <AssociationStatements /> : <Navigate to="/login" />} />
              <Route path="/data" element={isAuthenticated ? <RawData /> : <Navigate to="/login" />} />
              <Route path="/operations" element={isAuthenticated ? <Operations /> : <Navigate to="/login" />} />
              <Route path="/meters" element={isAuthenticated ? <MeterReadings /> : <Navigate to="/login" />} />
              <Route path="/rent" element={isAuthenticated ? <Rent /> : <Navigate to="/login" />} />
              <Route path="/config" element={isAuthenticated ? <Config /> : <Navigate to="/login" />} />
              <Route path="/about" element={isAuthenticated ? <About /> : <Navigate to="/login" />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </Router>
  );
};

export default App;
