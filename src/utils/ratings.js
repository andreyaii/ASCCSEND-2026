import { evaluationCriteria } from '../data/settings.js';

// Equal-weight average of the configured criteria. Weighting remains an instructor decision.
export function calcOverall(ratings, criteria = evaluationCriteria) {
  const values = criteria.map((criterion) => ratings?.[criterion.id]).filter((v) => typeof v === 'number');
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export const formatScore = (n) => (typeof n === 'number' ? n.toFixed(2) : '–');

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
