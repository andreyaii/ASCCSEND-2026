import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { homePathFor } from '../utils/roles';

const roles = ['Student', 'Faculty'];
const identifierLabels = {
  Student: 'Student ID / Student No.',
  Faculty: 'Faculty ID / Institutional Email',
};
const identifierPlaceholders = {
  Student: 'Enter your Student ID or Student No.',
  Faculty: 'Faculty ID, institutional email, or Guest',
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('Student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activePanel, setActivePanel] = useState('');

  useEffect(() => {
    if (!activePanel) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setActivePanel('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activePanel]);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const signedInUser = await login(identifier, password, role);
      navigate(homePathFor(signedInUser), { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const moveGlow = (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--login-glow-x', `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty('--login-glow-y', `${event.clientY - bounds.top}px`);
  };

  const centerGlow = (event) => {
    event.currentTarget.style.setProperty('--login-glow-x', '50%');
    event.currentTarget.style.setProperty('--login-glow-y', '50%');
  };

  return (
    <main
      className="asccsend-login relative flex min-h-screen flex-col overflow-hidden"
      onPointerMove={moveGlow}
      onPointerLeave={centerGlow}
    >
      <div className="login-grid" aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />
      <div className="login-wireframe login-wireframe-left" aria-hidden="true">
        <span>&lt;/&gt;</span>
      </div>
      <svg className="login-wireframe login-wireframe-right" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <path d="M60 7 105 33v53L60 112 15 86V33L60 7Z" />
        <path d="m15 33 45 27 45-27M60 60v52M38 20l45 27v27L38 47V20Z" />
      </svg>

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
        <a href="/login" className="login-brand" aria-label="TekCon 2026 home">
          <span className="login-brand-mark" aria-hidden="true">T</span>
          <span className="login-brand-name">
            TekCon <span>2026</span>
          </span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="login-date-badge">
            <span className="login-status-dot" aria-hidden="true" />
            <CalendarDays className="h-3.5 w-3.5 text-[#ff7a3d] sm:hidden" aria-hidden="true" />
            <span>November 25 – 26, 2026</span>
          </span>
          <button type="button" className="login-agenda-button" onClick={() => setActivePanel('agenda')}>
            Agenda
          </button>
        </div>
      </header>

      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-5 pb-10 pt-5 sm:pt-8">
        <section className="w-full max-w-[620px] text-center" aria-labelledby="login-heading">
          <div className="login-portal-badge">
            <span className="login-status-dot" aria-hidden="true" />
            Proposal Evaluation Portal
          </div>
          <h1 id="login-heading" className="login-headline">
            Elevating Ideas.<br /><span className="login-headline-line">Advancing Innovation.</span>
          </h1>
          <p className="login-subtitle">
            TekCon 2026 — Project Showcase &amp; Innovation Festival
          </p>

          <div className="login-card mx-auto w-full max-w-[470px] text-left">
            <div className="login-role-tabs" role="tablist" aria-label="Choose account type">
              {roles.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  id={`role-${item.toLowerCase()}`}
                  aria-selected={role === item}
                  aria-controls="login-form-panel"
                  className={`login-role-tab${role === item ? ' is-active' : ''}`}
                  onClick={() => { setRole(item); setError(''); }}
                >
                  {item}
                </button>
              ))}
            </div>

            <form id="login-form-panel" role="tabpanel" aria-labelledby={`role-${role.toLowerCase()}`} onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="login-label" htmlFor="identifier">{identifierLabels[role]}</label>
                <div className="login-input-wrap">
                  <UserRound className="login-input-icon" aria-hidden="true" />
                  <input
                    id="identifier"
                    type="text"
                    required
                    className="login-input"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={identifierPlaceholders[role]}
                    autoComplete="username"
                    autoCapitalize="none"
                  />
                </div>
              </div>

              <div>
                <label className="login-label" htmlFor="password">Password</label>
                <div className="login-input-wrap">
                  <LockKeyhole className="login-input-icon" aria-hidden="true" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="login-input pr-12"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    className="login-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="login-error">{error}</p>}

              <button type="submit" className="login-submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Continue to Workspace'}
                {!busy && <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />}
              </button>
            </form>

            <div className="login-confidentiality">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#ff7440]" aria-hidden="true" />
              <span>Evaluations remain strictly confidential until officially published by System Administrators.</span>
            </div>
          </div>
        </section>
      </div>

      <footer className="relative z-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4 text-center text-[11px] text-[#74747f] sm:flex-row sm:px-8 sm:text-left lg:px-12">
        <p>TekCon 2026 — Project Showcase &amp; Innovation Festival</p>
        <nav className="flex items-center gap-4" aria-label="Footer">
          <span className="login-system-status"><span aria-hidden="true">●</span> System Online</span>
        </nav>
      </footer>

      {activePanel && (
        <div
          className="login-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePanel('');
          }}
        >
          <section className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-dialog-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff7440]">
                  About the event
                </p>
                <h2 id="login-dialog-title" className="font-display text-xl font-bold text-white">
                  TekCon 2026
                </h2>
              </div>
              <button type="button" className="login-dialog-close" onClick={() => setActivePanel('')} aria-label="Close dialog">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#a2a2ad]">
              TekCon 2026 is the CIT-U project showcase and evaluation event where students and faculty present, explore, and evaluate participating projects.
            </p>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-xs text-[#b9b9c3]">
              <CalendarDays className="h-4 w-4 text-[#ff7440]" aria-hidden="true" />
              November 25 – 26, 2026 <span className="text-[#595963]">·</span> CIT-U College of Computer Studies
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
