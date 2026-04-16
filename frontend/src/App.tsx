import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import AssociationStatements from './pages/AssociationStatements';
import RawData from './pages/RawData';
import Config from './pages/Config';
import Operations from './pages/Operations';
import About from './pages/About';
import Rent from './pages/Rent';
import MeterReadings from './pages/MeterReadings';
import Login from './pages/Login';
import Register from './pages/Register';

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
        </main>
      </div>
    </Router>
  );
};

export default App;
