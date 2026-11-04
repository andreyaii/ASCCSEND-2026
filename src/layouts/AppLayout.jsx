import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { studentNav, facultyNav } from '../config/navigation';
import { isStudent, isFaculty } from '../utils/roles';
import RatingsAdminControl from '../components/RatingsAdminControl';
import DemoPanel from '../components/DemoPanel';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

// One layout for every role: only the nav items differ. Advisers and Admins get identical navigation.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const nav = isStudent(user) ? studentNav : facultyNav;
  const roleLabel = isFaculty(user) ? `Faculty · ${user.role}` : 'Student';
  const themeToggle = (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const doLogout = () => {
    try {
      logout();
    } catch (error) {
      toast.error(error.message);
    }
    navigate('/login', { replace: true });
  };
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-primary-light text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap className="h-5 w-5" /></span>
        <div>
          <p className="font-display text-lg font-bold leading-tight">TechCon</p>
          <p className="text-[11px] text-muted">Project Showcase & Evaluation</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass} onClick={() => setMenuOpen(false)}><Icon className="h-4 w-4" /> {label}</NavLink>
        ))}
      </nav>
      <div className="space-y-2 border-t border-line p-3">
        <div className="px-3">{themeToggle}</div>
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <span className={isFaculty(user) ? 'badge-primary' : 'badge-green'}>{roleLabel}</span>
        </div>
        <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmLogout(true)}>
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden h-screen w-60 border-r border-line bg-white lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="font-display text-lg font-bold leading-tight">TechCon</p>
          <p className="text-xs text-muted">{user.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:border-primary/40 hover:text-primary"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button onClick={() => setMenuOpen(true)} aria-label="Open navigation menu" aria-expanded={menuOpen} className="rounded-lg p-2 text-ink hover:bg-surface"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/35" aria-label="Close navigation menu" onClick={() => setMenuOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Main navigation" className="absolute inset-y-0 left-0 w-[min(18rem,88vw)] bg-white shadow-lift">
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-2 text-muted hover:bg-surface"><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <RatingsAdminControl />
        <Outlet />
      </main>

      <DemoPanel />
      <ConfirmDialog open={confirmLogout} title="Log out?" message="You will need to sign in again to continue." confirmLabel="Logout" onCancel={() => setConfirmLogout(false)} onConfirm={doLogout} />
    </div>
  );
}
