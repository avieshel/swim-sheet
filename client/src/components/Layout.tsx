import React, { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/swimmers', label: 'Swimmers', icon: 'groups' },
  { path: '/sessions', label: 'Sessions', icon: 'event_note' },
  { path: '/drills', label: 'Drill Bank', icon: 'library_books' },
  { path: '/live', label: 'Live', icon: 'timer' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export const Layout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface border-b-2 border-outline-variant shadow-sm sticky top-0 z-40 w-full">
        <div className="r-container flex items-center justify-between py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <span className="material-symbols-outlined text-primary text-2xl shrink-0">pool</span>
            <h1 className="font-headline-md font-bold text-primary truncate">LaneLogic Coaching</h1>
          </div>
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <nav className="flex gap-2 lg:gap-4">
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
          <button
            className="md:hidden material-symbols-outlined text-on-surface-variant h-11 w-11 flex items-center justify-center hover:bg-surface-container-high rounded-lg transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            menu
          </button>
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
            onClick={closeDrawer}
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

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:hidden"
          onClick={closeDrawer}
        >
          <div
             className="fixed top-0 start-0 h-full w-72 max-w-[85vw] bg-surface-container-lowest shadow-2xl z-[70] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">pool</span>
                <span className="font-headline-md font-bold text-primary">LaneLogic</span>
              </div>
              <button
                className="material-symbols-outlined text-on-surface-variant h-11 w-11 flex items-center justify-center hover:bg-surface-variant rounded-lg transition-colors"
                onClick={closeDrawer}
                aria-label="Close navigation menu"
              >
                close
              </button>
            </div>
            <nav className="flex-1 py-4 px-2 overflow-y-auto">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeDrawer}
                  className={`flex items-center gap-4 px-4 min-h-[48px] rounded-xl mb-1 transition-colors ${
                    isActive(item.path)
                      ? 'bg-secondary-container text-on-secondary-container font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                  <span className="font-body-md">{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};
