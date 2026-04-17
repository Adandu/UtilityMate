import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const navigationItems = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/invoices', icon: 'receipt_long', label: 'Invoices' },
    { to: '/association-statements', icon: 'description', label: 'Association Statements' },
    { to: '/data', icon: 'database', label: 'Raw Data' },
    { to: '/operations', icon: 'hub', label: 'Operations' },
    { to: '/meters', icon: 'speed', label: 'Meter Readings' },
    { to: '/rent', icon: 'groups', label: 'Rent' },
    { to: '/config', icon: 'settings', label: 'Configuration' },
    { to: '/about', icon: 'info', label: 'About' },
  ];

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition-all duration-150 ${
      isActive
        ? 'bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 shadow-sm scale-95'
        : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-slate-100/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary-container/60">
              <img src="/favicon.svg" alt="UtilityMate logo" className="h-9 w-9" />
            </div>
            <div>
              <h1 className="font-headline text-base font-extrabold text-slate-900 dark:text-slate-50">UtilityMate</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Utility Analytics</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/45 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div
            className="h-full w-[86vw] max-w-xs border-r border-slate-200 bg-slate-100 p-4 shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-y-2">
              <div className="mb-4 flex items-center gap-3 px-3 py-6">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary-container/60">
                  <img src="/favicon.svg" alt="UtilityMate logo" className="h-9 w-9" />
                </div>
                <div>
                  <h1 className="font-headline text-lg font-extrabold text-slate-900 dark:text-slate-50">UtilityMate</h1>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Utility Analytics</p>
                </div>
              </div>

              <nav className="flex-1 space-y-1">
                {navigationItems.map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClassName}>
                    <span className="material-symbols-outlined">{item.icon}</span>
                    <span className="font-body text-sm">{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-500 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-900/10"
                >
                  <span className="material-symbols-outlined">logout</span>
                  <span className="font-body text-sm font-semibold">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-none bg-slate-100 transition-colors duration-300 md:flex dark:bg-slate-900">
        <div className="flex h-full flex-col gap-y-2 p-4">
          <div className="mb-4 flex items-center gap-3 px-3 py-6">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary-container/60">
              <img src="/favicon.svg" alt="UtilityMate logo" className="h-9 w-9" />
            </div>
            <div>
              <h1 className="font-headline text-lg font-extrabold text-slate-900 dark:text-slate-50">UtilityMate</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">Utility Analytics</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            {navigationItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClassName}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-body text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-red-500 transition-colors duration-150 hover:bg-red-50 dark:hover:bg-red-900/10"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="font-body text-sm font-semibold">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
