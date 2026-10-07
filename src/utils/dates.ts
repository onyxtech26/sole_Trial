/* Date, time and money helpers — ported from the design handoff so every screen
   formats identically to the approved comps. All dates are plain YYYY-MM-DD
   strings in local time; nothing here ever constructs a UTC-shifted Date. */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_ABBR = MONTH_NAMES.map(m => m.slice(0, 3));
export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function iso(d: Date): string {
  return (
    d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0')
  );
}

export function parseISO(s: string): Date {
  const p = String(s || '').split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/** Today plus `off` days, as YYYY-MM-DD. */
export function rel(off: number): string {
  const d = new Date();
  d.setDate(d.getDate() + off);
  return iso(d);
}

export const today = (): string => rel(0);

export function short(isoStr: string): string {
  if (!isoStr) return '—';
  return parseISO(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function longDate(isoStr: string): string {
  if (!isoStr) return '—';
  return parseISO(isoStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function eur(n: number): string {
  return '€' + (Number(n) || 0).toLocaleString('en-GB', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

/** The Sunday-to-Saturday week containing `isoStr`. */
export function sundayWeek(isoStr: string): [string, string] {
  const d = parseISO(isoStr);
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return [iso(s), iso(e)];
}

export function addDays(isoStr: string, n: number): string {
  const d = parseISO(isoStr);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function addMonths(isoStr: string, n: number): string {
  const d = parseISO(isoStr);
  d.setMonth(d.getMonth() + n);
  return iso(d);
}

/** Normalise any time-ish string to HH:MM, or '' if there isn't one. */
export function hhmm(t: string): string {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : '';
}

export function minutesOf(t: string): number {
  const h = hhmm(t);
  return h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) : 0;
}

export function shiftTime(t: string, mins: number): string {
  const base = minutesOf(t) + mins;
  const m = ((base % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function uid(prefix: string): string {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Stagger delay for list entrance animations, capped so long lists still feel instant. */
export function delayOf(i: number): string {
  return Math.min(i * 0.022, 0.3).toFixed(3) + 's';
}

export type RangeMode = 'today' | 'week' | 'month' | 'year' | 'custom';

/** [start, end] inclusive, for the filter the header exposes on every screen. */
export function rangeFor(mode: RangeMode, anchor: string, endAnchor?: string): [string, string] {
  if (mode === 'today') return [anchor, anchor];
  if (mode === 'week') return sundayWeek(anchor);
  if (mode === 'month') {
    const d = parseISO(anchor);
    return [
      iso(new Date(d.getFullYear(), d.getMonth(), 1)),
      iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    ];
  }
  if (mode === 'year') {
    const d = parseISO(anchor);
    return [iso(new Date(d.getFullYear(), 0, 1)), iso(new Date(d.getFullYear(), 11, 31))];
  }
  // custom: an explicit start/end pair, ordered defensively.
  const end = endAnchor || anchor;
  return anchor <= end ? [anchor, end] : [end, anchor];
}

export function rangeLabelFor(mode: RangeMode, anchor: string, endAnchor?: string): string {
  const [a, b] = rangeFor(mode, anchor, endAnchor);
  if (mode === 'today') return longDate(anchor);
  if (mode === 'week') return short(a) + ' — ' + short(b) + ' · Sun to Sat';
  if (mode === 'month') return MONTH_NAMES[parseISO(anchor).getMonth()] + ' ' + parseISO(anchor).getFullYear();
  if (mode === 'year') return String(parseISO(anchor).getFullYear());
  return a === b ? longDate(a) : short(a) + ' — ' + short(b);
}

export const inRange = (d: string, r: [string, string]): boolean => d >= r[0] && d <= r[1];
