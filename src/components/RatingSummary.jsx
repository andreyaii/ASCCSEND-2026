import { EyeOff } from 'lucide-react';
import StarRating from './StarRating';
import { useSettings } from '../context/SettingsContext';
import { formatScore } from '../utils/ratings';

// Shows an aggregate rating, or a "hidden" notice when the viewer may not see ratings.
export default function RatingSummary({ aggregate, variant = 'compact' }) {
  const { ratingsShown, ratingsHiddenReason } = useSettings();

  if (!ratingsShown) {
    return variant === 'compact' ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted" title={ratingsHiddenReason}><EyeOff className="h-3.5 w-3.5" /> Ratings hidden</span>
    ) : (
      <div className="flex items-start gap-2 rounded-[10px] bg-surface p-3 text-sm text-muted"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" />{ratingsHiddenReason}</div>
    );
  }
  if (!aggregate) return <span className="text-xs text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <StarRating value={aggregate.average} />
      <span className="text-xs font-bold text-star">{formatScore(aggregate.average)}</span>
      <span className="text-xs text-muted">({aggregate.count})</span>
    </span>
  );
}
