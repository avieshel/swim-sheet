import React, { useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useActiveRun } from '../hooks/useActiveRun';
import { settingsService } from '../services/settingsService';
import { Icon } from './Icon';
import { AccountIndicator } from './AccountIndicator';
import { useCoachAssist } from '../context/coachAssistShared';

const navItems = [
  { path: '/swimmers', label: 'Swimmers', icon: 'groups' },
  { path: '/sessions', label: 'Sessions', icon: 'event_note' },
  { path: '/drills', label: 'Drills', icon: 'library_books' },
  { path: '/live', label: 'Live', icon: 'timer' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeRun = useActiveRun();
  const { isOwner, coach, exit } = useCoachAssist();

  // In coach mode the Live tab is suppressed: starting a live session would
  // write run/lap rows to the owner's local Dexie, not the coach's tenant.
  const visibleNavItems = navItems.filter((item) => !(coach && item.path === '/live'));

  const isActive = (path: string) => location.pathname.startsWith(path);
  const isLiveRoute = location.pathname === '/' || location.pathname === '/live';
  const isLiveRun = isLiveRoute && activeRun !== null;

  useEffect(() => {
    settingsService.getSettings().then(data => {
      if (data?.theme && data.theme !== 'auto') {
        document.documentElement.dataset.theme = data.theme
      } else {
        delete document.documentElement.dataset.theme
      }
      if (data?.font_size && data.font_size !== 'medium') {
        document.documentElement.dataset.fontSize = data.font_size
      } else {
        delete document.documentElement.dataset.fontSize
      }
    }).catch(() => {})
  }, [])

  return (
    <div
      className={
        isLiveRun
          ? 'bg-surface text-on-surface h-[100dvh] flex flex-col overflow-hidden'
          : 'bg-surface text-on-surface min-h-screen flex flex-col'
      }
    >
      {/* TopAppBar */}
      <header className="bg-surface border-b-2 border-outline-variant shadow-sm sticky top-0 z-40 w-full">
        <div className="r-container flex items-center justify-between py-3 md:py-4">
          <Link to="/" className="flex items-center gap-2 md:gap-3 min-w-0 no-underline">
            <Icon name="pool" size="xl" color="primary" className="shrink-0" />
            <h1 className="font-headline-md font-bold text-primary truncate">Swim Sheet</h1>
          </Link>
          <div className="hidden md:flex items-center">
            <nav className="flex gap-2 lg:gap-4 mr-2">
              {visibleNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative font-label-sm transition-colors px-3 py-1.5 rounded-full h-10 flex items-center ${
                    isActive(item.path)
                      ? 'text-primary font-bold bg-primary-container/10'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {item.label}
                  {item.path === '/live' && activeRun && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_0_3px_rgba(34,197,94,0.2)]" />
                  )}
                </Link>
              ))}
              {isOwner && (
                <Link
                  to="/admin/coach-assist"
                  className={`relative font-label-sm transition-colors px-3 py-1.5 rounded-full h-10 flex items-center ${
                    isActive('/admin/coach-assist')
                      ? 'text-primary font-bold bg-primary-container/10'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  Coach Assist
                </Link>
              )}
            </nav>
            <AccountIndicator />
          </div>
        </div>
      </header>

      {coach && (
        <div className="bg-secondary-container text-on-secondary-container text-label-sm px-4 py-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <Icon name="supervisor_account" size="sm" />
            <span className="truncate">Coach Assist — editing {coach.name}'s data</span>
          </span>
          <button
            type="button"
            onClick={() => {
              exit()
              navigate('/admin/coach-assist')
            }}
            className="shrink-0 font-label-sm underline underline-offset-2 cursor-pointer"
          >
            Exit
          </button>
        </div>
      )}

      {/* Main Content */}
      <main
        className={
          isLiveRun
            ? 'flex-1 min-h-0 r-container py-stack-md md:py-stack-lg pb-20 md:pb-12 overflow-x-hidden flex flex-col'
            : 'flex-1 r-container py-stack-md md:py-stack-lg pb-28 md:pb-12 overflow-x-hidden'
        }
      >
        <Outlet />
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 start-0 w-full flex justify-around items-end px-2 pb-3 pt-1 bg-surface-container shadow-[0px_-4px_20px_rgba(0,0,0,0.12)] z-50 rounded-t-xl safe-area-bottom">
        {visibleNavItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-3 py-1 rounded-xl transition-all duration-200 active:scale-90 tap-highlight-none ${
              isActive(item.path)
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <span className="relative">
              <Icon
                name={item.icon}
                fill={isActive(item.path)}
              />
              {item.path === '/live' && activeRun && (
                <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_0_3px_rgba(34,197,94,0.2)]" />
              )}
            </span>
            <span className="font-label-sm leading-none mt-0.5">{item.label}</span>
          </Link>
        ))}
        {isOwner && (
          <Link
            to="/admin/coach-assist"
            className={`relative flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-3 py-1 rounded-xl transition-all duration-200 active:scale-90 tap-highlight-none ${
              isActive('/admin/coach-assist')
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
            <Icon name="supervisor_account" fill={isActive('/admin/coach-assist')} />
            <span className="font-label-sm leading-none mt-0.5">Assist</span>
          </Link>
        )}
      </nav>
    </div>
  );
};
