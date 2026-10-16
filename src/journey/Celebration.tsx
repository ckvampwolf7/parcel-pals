/**
 * Delivered celebration: a one-shot confetti burst over the scene (plays once per mount = once per
 * visit, or when the parcel becomes delivered while the screen is open). With reduced motion we
 * show a few static sparkles instead.
 */
import { memo } from 'react';

const COLORS = ['var(--c-sun)', 'var(--c-coral)', 'var(--c-mint)', 'var(--c-sky)', 'var(--c-lilac)', 'var(--c-char-bunny)'];
const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 91.7 + salt * 47.3) * 15731.743;
  return v - Math.floor(v);
};

export const Celebration = memo(function Celebration({ reduced, label }: { reduced: boolean; label: string }) {
  return (
    <div className="jr-celebration" data-testid="celebration" role="img" aria-label={label} data-reduced={reduced || undefined}>
      {!reduced &&
        Array.from({ length: 34 }, (_, i) => {
          const shape = i % 3;
          return (
            <span
              key={i}
              className={`jr-confetti jr-confetti--${shape}`}
              style={{
                left: `${4 + rnd(i, 1) * 92}%`,
                background: COLORS[i % COLORS.length],
                animationDelay: `${rnd(i, 2) * 0.5}s`,
                animationDuration: `${1.9 + rnd(i, 3) * 1.3}s`,
                ['--jr-drift' as string]: `${(rnd(i, 4) - 0.5) * 90}px`,
                ['--jr-spin' as string]: `${(rnd(i, 5) > 0.5 ? 1 : -1) * (360 + rnd(i, 6) * 540)}deg`,
              }}
            />
          );
        })}
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} className={`jr-sparkle jr-sparkle--${i}`} viewBox="-10 -10 20 20" aria-hidden="true" focusable="false">
          <path d="M0-9 2.2-2.2 9 0 2.2 2.2 0 9-2.2 2.2-9 0-2.2-2.2z" />
        </svg>
      ))}
    </div>
  );
});
