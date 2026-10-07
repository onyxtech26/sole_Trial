/* ══════════════════════════════════════════════════════════════════════════
   GetYourGuide supplier bookings export → bookings.

   Unlike Viator's, this export is English, carries the tour's start time in
   the same cell as its date, and splits the party across a dozen ticket
   categories. The travellers' real names, when GetYourGuide collected them,
   arrive as free text in "Additional Information". There is no status column:
   the export lists live bookings only.
   ══════════════════════════════════════════════════════════════════════════ */

import type { Traveler } from '../types';
import { iso } from './dates';
import { intOf, moneyOf, type Row, type RowResult } from './viator';

const COL = {
  date: 'Date',
  ref: 'Booking Ref #',
  product: 'Product',
  option: 'Option',
  first: "Traveler's First Name",
  last: "Traveler's Last Name",
  phone: 'Phone',
  addOns: 'Add-ons',
  netPrice: 'Net Price',
  language: 'Language',
  info: 'Additional Information',
  payLater: 'Reserve Now Pay Later Booking',
} as const;

/** Ticket categories, and whether each one counts as an adult or a child seat. */
const CATEGORIES: [string, Traveler[1]][] = [
  ['Adult', 'Adult'],
  ['Senior', 'Adult'],
  ['Student (with ID)', 'Adult'],
  ['EU Citizens (with ID)', 'Adult'],
  ['Student EU Citizens (with ID)', 'Adult'],
  ['Military (with ID)', 'Adult'],
  ['Youth', 'Adult'],
  ['Child', 'Child'],
  ['Infant', 'Child'],
];

const LANG_MAP: Record<string, string> = {
  english: 'EN', spanish: 'ES', italian: 'IT', french: 'FR', german: 'DE',
  portuguese: 'PT', dutch: 'NL', russian: 'RU', chinese: 'ZH', japanese: 'JA',
  arabic: 'AR', korean: 'KO', greek: 'EL', polish: 'PL', turkish: 'TR',
};

const cell = (v: unknown): string => (v == null ? '' : String(v));
const pad = (n: number | string): string => String(n).padStart(2, '0');

export const isGygRow = (row: Row): boolean => COL.ref in row && COL.product in row;

/**
 * The tour's date and start time from the "Date" cell. SheetJS hands back a
 * Date in local wall-clock time that can sit a few seconds either side of the
 * minute, so it is rounded before reading. A CSV gives a string instead.
 */
function dateAndTime(v: unknown): [string, string] {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = new Date(Math.round(v.getTime() / 60000) * 60000);
    return [iso(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`];
  }
  const s = cell(v).trim();
  const time = (rest: string): string => {
    const t = rest.match(/(\d{1,2}):(\d{2})/);
    return t ? `${pad(t[1])}:${t[2]}` : '';
  };
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (m) return [`${m[1]}-${m[2]}-${m[3]}`, time(m[4])];
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(.*)$/); // dd/mm/yyyy or dd.mm.yyyy
  if (m) return [`${m[3]}-${pad(m[2])}-${pad(m[1])}`, time(m[4])];
  return ['', ''];
}

/** "709493 [ColosseoMe] Rome: Colosseum…" → ["709493", "[ColosseoMe] Rome: Colosseum…"] */
function splitProduct(raw: unknown): [string, string] {
  const s = cell(raw).trim();
  const m = s.match(/^(\d+)\s+(.*)$/);
  return m ? [m[1], m[2].trim()] : [s, s];
}

/** "[ColSolo] Colosseum Private Photoshoot" → ["ColSolo", "Colosseum Private Photoshoot"] */
function splitOption(raw: unknown): [string, string] {
  const s = cell(raw).trim();
  const m = s.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) return [m[1].trim(), m[2].trim() || m[1].trim()];
  return [s || 'TG1', s];
}

function translateLanguage(raw: unknown): string {
  const s = cell(raw).trim();
  if (!s) return 'EN';
  return LANG_MAP[s.toLowerCase()] || s.slice(0, 2).toUpperCase();
}

/**
 * Names GetYourGuide collected per traveller, in order. The text looks like
 * "Traveler 1:\nFirst Name: Sandra\nLast Name: Eiselt\nTraveler 2:…", often
 * with a stray leading apostrophe from the spreadsheet.
 */
function namesFromInfo(raw: unknown): string[] {
  const text = cell(raw);
  const names: string[] = [];
  const re = /First Name:\s*([^\n]*)\n\s*Last Name:\s*([^\n]*)/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = `${m[1].trim()} ${m[2].trim()}`.trim();
    if (name) names.push(name);
  }
  return names;
}

function buildTravelers(row: Row, lead: string): Traveler[] {
  const seats: Traveler[1][] = [];
  for (const [col, type] of CATEGORIES) {
    for (let i = intOf(row[col]); i > 0; i--) seats.push(type);
  }
  if (!seats.length) seats.push('Adult');
  // Adults first, so the lead traveller and the named guests line up with them.
  seats.sort((a, b) => (a === b ? 0 : a === 'Adult' ? -1 : 1));

  const named = namesFromInfo(row[COL.info]);
  if (!named.length && lead) named.push(lead);

  let adults = 0;
  let children = 0;
  return seats.map((type, i): Traveler => {
    const fallback = type === 'Adult' ? `Guest ${++adults}` : `Child ${++children}`;
    return [named[i] || (i === 0 && lead) || fallback, type];
  });
}

export function gygRowToBooking(row: Row): RowResult {
  const ref = cell(row[COL.ref]).trim();
  if (!ref) return { booking: null, reason: 'invalid' };

  const [date, resTime] = dateAndTime(row[COL.date]);
  if (!date) return { booking: null, reason: 'invalid' };

  const [code, tourName] = splitProduct(row[COL.product]);
  const [tg, tgTitle] = splitOption(row[COL.option]);
  const lead = `${cell(row[COL.first]).trim()} ${cell(row[COL.last]).trim()}`.trim();
  const travelers = buildTravelers(row, lead);

  const notes = [
    cell(row[COL.addOns]).trim() && `Add-ons: ${cell(row[COL.addOns]).trim()}`,
    /^yes$/i.test(cell(row[COL.payLater]).trim()) && 'Reserve now, pay later booking',
  ].filter(Boolean).join('\n');

  return {
    booking: {
      ref,
      code,
      tg,
      date,
      resTime,
      tourTime: '',                    // ops fills this in after grouping
      lang: translateLanguage(row[COL.language]),
      guide: '',
      phone: cell(row[COL.phone]).trim(),
      travelers,
      // The supplier's payout, matching what the Viator import records.
      gross: moneyOf(row[COL.netPrice]),
      spent: 0,
      wf: [0, 0, 0, 0, 0],
      status: 'Confirmed',
      payment: 'Paid',
      refundPct: 0,
      sortOrder: 0,
      notes,
      namesLocked: false,
      // The column predates GetYourGuide; it means "came from a report".
      source: 'viator_import',

      tourName,
      tgTitle,
      meetingPoint: '',
      currency: 'EUR',
      leadTraveler: travelers[0][0],
      assignedDriver: 'None',
      okStatus: true,
      checkedIn: [],
      namesComplete: false,
      serviceLineItems: null,
    },
  };
}
