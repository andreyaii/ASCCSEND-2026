export default function EvaluationCounter({ status }) {
  const full = status.remaining === 0;
  const progress = status.limit > 0 ? Math.min((status.submitted / status.limit) * 100, 100) : 0;
  return (
    <div className={`rounded-card border bg-white px-4 py-3.5 ${full ? 'border-amber-300' : 'border-line'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-semibold">Evaluation progress <span className="ml-1 font-semibold text-emerald-700">{status.submitted} of {status.limit} submitted</span></p>
        <p className={full ? 'font-semibold text-amber-800' : 'text-muted'}>{full ? 'Limit reached' : `${status.remaining} remaining`}</p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Evaluation limit progress"
        aria-valuemin={0} aria-valuemax={status.limit} aria-valuenow={status.submitted}>
        <div className={`h-full rounded-full transition-[width] ${full ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${progress}%` }} />
      </div>
      {full && <p className="mt-2 text-xs text-amber-800">You cannot evaluate additional groups.</p>}
    </div>
  );
}
