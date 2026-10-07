/* ══════════════════════════════════════════════════════════════════════════
   Operator-chosen tour colours.

   A tour option can carry one or two colours, and those colours back its
   reservations in Grouping. The catch is that Grouping rows are dense text —
   reference, name, age, phone, price — so the colour cannot simply be dropped
   in as the background or half the screen becomes unreadable the moment
   somebody picks navy.

   So a chosen colour is used twice at two different strengths: heavily diluted
   behind the row, where it tints without competing with the text, and at full
   strength in a narrow stripe down the leading edge, where it is unmistakable.
   The stripe is what the eye actually matches on; the wash is what makes a
   multi-passenger booking read as one block.
   ══════════════════════════════════════════════════════════════════════════ */

const HEX = /^#[0-9a-f]{6}$/i;

/** A colour we are willing to put in a style attribute, or ''. */
export function hexOrBlank(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase();
  if (HEX.test(s)) return s;
  // #abc is valid CSS and worth accepting rather than discarding.
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return '';
}

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Mix towards white. `amount` is how much white, 0..1. */
export function lighten(hex: string, amount: number): string {
  const c = hexOrBlank(hex);
  if (!c) return '';
  const [r, g, b] = channels(c);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/**
 * Perceived brightness, 0..255 (ITU-R BT.601). Used to keep a pale pick from
 * vanishing: yellow at 88% white is indistinguishable from the plain row, so
 * light colours are diluted less than dark ones.
 */
export function luminance(hex: string): number {
  const c = hexOrBlank(hex);
  if (!c) return 255;
  const [r, g, b] = channels(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** How much white to add so every choice lands in the same readable band. */
const dilution = (hex: string, hovering: boolean): number => {
  const lum = luminance(hex);
  // Dark colours need more white to stay behind text; pale ones need less or
  // they disappear entirely.
  const base = lum > 200 ? 0.62 : lum > 140 ? 0.72 : 0.8;
  return hovering ? base - 0.1 : base;
};

export interface RowPaint {
  /** CSS background for the row, or '' when no colour is set. */
  background: string;
  /** Same, a touch stronger, for the hover state. */
  hover: string;
  /** CSS background for the full-strength leading stripe, or ''. */
  stripe: string;
}

const BLANK: RowPaint = { background: '', hover: '', stripe: '' };

/**
 * Paint one reservation's rows.
 *
 * `nth` is the reservation's position among the bookings sharing its tour
 * option on that day — 0, 1, 2, 3 — and it is what the second colour is for.
 * Two colours do not mix into one row: they alternate between reservations, so
 * four bookings of the same option read green, yellow, green, yellow and the
 * boundary between one party and the next is obvious. Every traveller on a
 * booking shares its colour, so a family of five is still one block.
 *
 * With a single colour there is nothing to alternate between, so the same
 * colour alternates between two strengths instead. That is exactly what the
 * default grey rows already do — the point of the feature is telling
 * consecutive bookings apart, and one flat colour would lose it.
 */
export function rowPaint(color: string, color2: string, nth = 0): RowPaint {
  const a = hexOrBlank(color);
  const b = hexOrBlank(color2);
  if (!a && !b) return BLANK;

  const odd = Math.abs(Math.trunc(nth)) % 2 === 1;

  // Both slots filled: the colours themselves take turns.
  if (a && b) {
    const pick = odd ? b : a;
    return {
      background: lighten(pick, dilution(pick, false)),
      hover: lighten(pick, dilution(pick, true)),
      stripe: pick,
    };
  }

  // One slot filled: two strengths of it take turns instead.
  const only = a || b;
  const base = dilution(only, false);
  const step = odd ? base - 0.07 : base;
  return {
    background: lighten(only, step),
    hover: lighten(only, step - 0.08),
    stripe: only,
  };
}

/** A swatch preview for the Tours list and the editor. */
export const swatchFill = (color: string, color2: string): string => {
  const a = hexOrBlank(color);
  const b = hexOrBlank(color2);
  if (a && b) return `linear-gradient(135deg, ${a} 0%, ${a} 50%, ${b} 50%, ${b} 100%)`;
  return a || b || '';
};

/** Colours offered as one-click choices before reaching for the full picker. */
export const PRESET_COLORS = [
  '#e5484d', '#f76808', '#ffb224', '#46a758', '#12a594',
  '#0091ff', '#3e63dd', '#8e4ec6', '#e93d82', '#7c6f64',
];
