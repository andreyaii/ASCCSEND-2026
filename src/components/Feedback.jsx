import { SearchX, AlertTriangle } from 'lucide-react';

export function Loading({ label = 'Getting things ready…', fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center py-16 ${fullScreen ? 'min-h-screen' : 'min-h-[calc(100vh-9.5rem)] lg:min-h-[calc(100vh-4rem)]'}`}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <svg className="techcon-flight-loader" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="techcon-flight-trail" cx="60" cy="60" r="42" />
        <image className="techcon-paper-plane" href="/airplane.png" x="40" y="-2" width="40" height="40" />
      </svg>
    </div>
  );
}

export function EmptyState({ title, message, icon: Icon = SearchX, action }) {
  return (
    <div className="col-span-full py-16 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted" />
      <h3 className="text-lg font-bold">{title}</h3>
      {message && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="py-16 text-center">
      <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
      <h3 className="text-lg font-bold">Something went wrong</h3>
      <p className="mt-1 text-sm text-muted">{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn-secondary mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}
