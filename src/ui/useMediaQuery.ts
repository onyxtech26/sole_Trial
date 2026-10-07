import { useEffect, useState } from 'react';

/**
 * The width at which the shell stops being a desktop layout: the sidebar
 * becomes a drawer, and the dense tables become card lists.
 *
 * 902, not 820, because <html> carries `zoom: var(--ui-scale)` (1.1). Media
 * queries evaluate against the unzoomed viewport, so the design's 820px
 * breakpoint is written as 820 × 1.1 everywhere — here and in index.css.
 * These two must agree: if they drift, a screen renders its phone markup
 * inside desktop styling, or the reverse.
 */
export const MOBILE_QUERY = '(max-width: 902px)';

/**
 * Live match for a CSS media query.
 *
 * Most of the responsive work in this app is done in `index.css`, which is
 * cheaper and cannot desync from paint. This hook exists for the cases CSS
 * genuinely cannot express — where a phone needs *different markup*, not
 * different styling, such as the bookings table becoming a card list.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);

  return matches;
}
