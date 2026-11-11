export default function EvaluationCounter({ status }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3.5">
      <p className="text-sm font-semibold">Evaluations submitted <span className="ml-1 text-emerald-700">{status.submitted}</span></p>
    </div>
  );
}
