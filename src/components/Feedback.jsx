import { Loader2, SearchX, AlertTriangle } from 'lucide-react';

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-primary" /> {label}
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
