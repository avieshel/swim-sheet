import React, { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/swimmers', label: 'Swimmers', icon: 'groups' },
  { path: '/sessions', label: 'Sessions', icon: 'event_note' },
  { path: '/drills', label: 'Drills', icon: 'library_books' },
  { path: '/live', label: 'Live', icon: 'timer' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  useEffect(() => {
    fetch('/api/v1/settings').then(r => {
      if (!r.ok) return
      return r.json()
    }).then(data => {
      if (data?.theme && data.theme !== 'auto') {
        document.documentElement.dataset.theme = data.theme
      } else {
        delete document.documentElement.dataset.theme
      }
    }).catch(() => {})
  }, [])

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface border-b-2 border-outline-variant shadow-sm sticky top-0 z-40 w-full">
        <div className="r-container flex items-center justify-between py-3 md:py-4">
          <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0 no-underline">
            <span className="material-symbols-outlined text-primary text-2xl shrink-0">pool</span>
            <h1 className="font-headline-md font-bold text-primary truncate">Swim Sheet</h1>
          </Link>
          <div className="hidden md:flex items-center">
            <nav className="flex gap-2 lg:gap-4 mr-2">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`font-label-sm transition-colors px-3 py-1.5 rounded-full h-10 flex items-center ${
                    isActive(item.path)
                      ? 'text-primary font-bold bg-primary-container/10'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 r-container py-stack-md md:py-stack-lg pb-28 md:pb-12">
        {children}
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 start-0 w-full flex justify-around items-end px-2 pb-3 pt-1 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl safe-area-bottom">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-3 py-1 rounded-xl transition-all duration-200 active:scale-90 tap-highlight-none ${
              isActive(item.path)
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive(item.path) ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="font-label-sm leading-none mt-0.5">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
