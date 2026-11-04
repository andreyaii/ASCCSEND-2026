import { useRef } from 'react';
import { Star } from 'lucide-react';
import { RATING_SCALE } from '../data/settings';

// Display mode (no onChange) or input mode (onChange provided).
export default function StarRating({ value = 0, onChange, size = 'h-4 w-4', label }) {
  const buttons = useRef([]);
  return (
    <div className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={label || `${value} out of ${RATING_SCALE}`}>
      {Array.from({ length: RATING_SCALE }, (_, i) => {
        const n = i + 1;
        const lit = n <= Math.round(value);
        const star = <Star className={`${onChange ? 'h-7 w-7' : size} ${lit ? 'fill-star text-star' : 'fill-line text-line'}`} />;
        return onChange ? (
          <button type="button" key={n} ref={(element) => { buttons.current[i] = element; }} onClick={() => onChange(n)}
            onKeyDown={(event) => {
              const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? Math.min(i + 1, RATING_SCALE - 1)
                : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? Math.max(i - 1, 0) : -1;
              if (nextIndex >= 0) {
                event.preventDefault();
                onChange(nextIndex + 1);
                buttons.current[nextIndex]?.focus();
              }
            }}
            role="radio" aria-checked={n === value} tabIndex={n === value || (!value && n === 1) ? 0 : -1}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">{star}</button>
        ) : <span key={n}>{star}</span>;
      })}
    </div>
  );
}
