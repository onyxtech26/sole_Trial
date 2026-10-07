/* ══════════════════════════════════════════════════════════════════════════
   A number that counts to its new value instead of snapping to it.

   Every figure on this panel changes because real data moved — a booking
   landed, an expense was approved. Rolling makes that legible: the eye catches
   the movement and knows something happened, without a toast for every cell.

   The ramp is easeOutExpo, so it covers most of the distance immediately and
   then settles. A linear count reads like a slot machine; this reads like a
   figure arriving.
   ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface Props {
  value: number;
  /** Milliseconds for the full roll. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /**
   * Count up from zero the first time this mounts. Screens remount on
   * navigation, so metrics roll in as you arrive on them. Turn it off for
   * figures inside long lists, where dozens of simultaneous counters read as
   * noise rather than as data landing.
   */
  animateOnMount?: boolean;
  style?: CSSProperties;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function RollingNumber({
  value, duration = 640, decimals = 0, prefix = '', suffix = '',
  animateOnMount = true, style, className,
}: Props) {
  const seed = animateOnMount ? 0 : value;
  const [shown, setShown] = useState(seed);
  // What is on screen right now. Every new roll starts from here, so a value
  // that changes mid-animation bends toward the new target instead of jumping
  // back to the old start.
  const shownRef = useRef(seed);

  useEffect(() => {
    const from = shownRef.current;
    const to = value;

    if (from === to) return;

    if (prefersReducedMotion()) {
      shownRef.current = to;
      setShown(to);
      return;
    }

    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const next = from + (to - from) * eased;
      shownRef.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text =
    prefix +
    shown.toLocaleString('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {text}
    </span>
  );
}
