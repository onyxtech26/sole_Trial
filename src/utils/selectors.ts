/* Pure derivations shared by the screens. Everything here takes store data as
   arguments and returns new values — no component state, no side effects. */

import type {
  Booking, Guide, Product, StaffMember, StoreData, TourGroup, Traveler,
} from '../types';
import { addDays, longDate, shiftTime, uid } from './dates';
import { wfOutstanding } from './workflow';

/* ── catalogue lookups ──────────────────────────────────────────────────── */

/** A booking may quote a product code the catalogue does not stock yet. */
export function productOf(products: Product[], code: string): Product | null {
  return products.find(p => p.code === code) ?? null;
}

export function productName(products: Product[], b: Pick<Booking, 'code' | 'tourName'>): string {
  const p = productOf(products, b.code);
  if (p) return p.name;
  return b.tourName || b.code || 'Unknown product';
}

export function tgTitleOf(products: Product[], b: Pick<Booking, 'code' | 'tg' | 'tgTitle'>): string {
  const p = productOf(products, b.code);
  const o = p?.options.find(x => x.tg === b.tg);
  return o?.title || b.tgTitle || b.tg;
}

export function capOf(products: Product[], code: string, tg: string): number {
  const p = productOf(products, code);
  const o = p?.options.find(x => x.tg === tg);
  return o?.cap ?? p?.defaultCap ?? 7;
}

export const paxOf = (b: Booking): number => b.travelers.length;

/** Whether an operator has written anything against this reservation. */
export const hasNote = (b: Pick<Booking, 'notes'>): boolean => !!(b.notes || '').trim();

/**
 * What has been handed back to the traveller on a booking.
 *
 * A full refund returns the whole payout; a partial one returns its percentage
 * of it. Revenue used to be the plain sum of the payouts, so a refunded booking
 * still counted in full and the week read higher than the money actually taken —
 * which is what the client caught reconciling against their own total.
 */
export function refundOf(b: Booking): number {
  if (b.payment === 'Full refund') return b.gross;
  if (b.payment === 'Partial refund') {
    const pct = Math.min(100, Math.max(0, b.refundPct || 0));
    return (b.gross * pct) / 100;
  }
  return 0;
}

/** What the business actually keeps on a booking. */
export const netOf = (b: Booking): number => b.gross - refundOf(b);

/** Revenue for a set of bookings, refunds already taken off. */
export const netRevenue = (list: Booking[]): number =>
  list.reduce((n, b) => n + netOf(b), 0);

/** How much of that set was given back. */
export const refundTotal = (list: Booking[]): number =>
  list.reduce((n, b) => n + refundOf(b), 0);

export function guidePhone(guides: Guide[], staff: StaffMember[], name: string): string {
  if (!name) return '';
  return guides.find(g => g.name === name)?.phone
    || staff.find(s => s.name === name)?.phone
    || '';
}

/** How many reviews actually back a guide's score. */
export const reviewCount = (g: Guide): number => g.reviews?.length ?? 0;

/** Whether that score means anything yet. */
export const isReviewed = (g: Guide): boolean => reviewCount(g) > 0;

/**
 * Best rated first.
 *
 * A guide nobody has reviewed still carries a rating of 5 — that is the
 * placeholder a new record starts on, and the card says "5.0 no reviews" next
 * to it. Sorting on the number alone therefore put every brand-new guide above
 * colleagues with a wall of real five-star reviews, which is exactly what
 * operations reported. An unreviewed guide is not top-rated, they are unrated,
 * so they sort after everyone whose score has been earned.
 *
 * Among reviewed guides the score leads and the number of reviews breaks the
 * tie, so a 5.0 backed by twelve reviews outranks a 5.0 backed by one.
 */
export function byRatingThenReviews(a: Guide, b: Guide): number {
  const ra = isReviewed(a);
  const rb = isReviewed(b);
  if (ra !== rb) return ra ? -1 : 1;
  if (b.rating !== a.rating) return b.rating - a.rating;
  const ca = reviewCount(a);
  const cb = reviewCount(b);
  if (cb !== ca) return cb - ca;
  return a.name.localeCompare(b.name);
}

/**
 * How a guide list reads best: whoever can actually take a tour today, best
 * first. Availability outranks rating because a five-star guide who is away is
 * no use to the person filling tomorrow's departure, and the directory was
 * previously in database id order — effectively the order guides were created,
 * which carries no meaning at all.
 *
 * Name breaks the remaining ties so the order is stable between renders rather
 * than depending on how the rows happened to arrive.
 */
const AVAIL_RANK: Record<Guide['avail'], number> = {
  Active: 0, 'On break': 1, Unavailable: 2,
};

export function byGuideStanding(a: Guide, b: Guide): number {
  const av = (AVAIL_RANK[a.avail] ?? 3) - (AVAIL_RANK[b.avail] ?? 3);
  if (av !== 0) return av;
  return byRatingThenReviews(a, b);
}

/** The same order, as a list. Never mutates the caller's array. */
export const rankedGuides = (guides: Guide[]): Guide[] => [...guides].sort(byGuideStanding);

/**
 * The orders the guides directory can be put in.
 *
 * A single fixed order cannot serve every question asked of this page. Standing
 * answers "who should take this tour", but "who is carrying too much next week"
 * and "where is Fabio in this list" are different questions, and the operator
 * asking them is the only one who knows which they are asking.
 */
export type GuideSort = 'standing' | 'rating' | 'name' | 'busy' | 'quiet';

export const GUIDE_SORTS: { v: GuideSort; t: string }[] = [
  { v: 'standing', t: 'Available first, best rated' },
  { v: 'rating', t: 'Most reviewed, best rated' },
  { v: 'name', t: 'Name, A to Z' },
  { v: 'quiet', t: 'Fewest tours ahead' },
  { v: 'busy', t: 'Most tours ahead' },
];

/**
 * Order the directory. `toursAhead` is the guide's upcoming workload; it is
 * passed in because only the screen knows the booking window in view.
 *
 * Name settles every tie, so the list never reshuffles between renders just
 * because two guides happen to score the same.
 */
export function sortGuides(
  list: Guide[],
  mode: GuideSort,
  toursAhead: (g: Guide) => number = () => 0,
): Guide[] {
  const byName = (a: Guide, b: Guide) => a.name.localeCompare(b.name);
  const arr = [...list];
  switch (mode) {
    // Ignores availability, but still keeps unrated guides below rated ones.
    case 'rating': return arr.sort(byRatingThenReviews);
    case 'name': return arr.sort(byName);
    case 'busy': return arr.sort((a, b) => toursAhead(b) - toursAhead(a) || byName(a, b));
    case 'quiet': return arr.sort((a, b) => toursAhead(a) - toursAhead(b) || byName(a, b));
    default: return arr.sort(byGuideStanding);
  }
}

/* ── grouping ───────────────────────────────────────────────────────────── */
export interface TravelerRow {
  id: string;        // "REF#index"
  idx: number;
  name: string;
  age: Traveler[1];
  booking: Booking;
}

/** `range` of null means every date — used to resolve a band's own members. */
export function travelerRows(
  bookings: Booking[], range: [string, string] | null,
): TravelerRow[] {
  const rows: TravelerRow[] = [];
  for (const bk of bookings) {
    if (bk.status === 'Cancelled') continue;
    if (range && (bk.date < range[0] || bk.date > range[1])) continue;
    bk.travelers.forEach((t, i) => {
      rows.push({ id: `${bk.ref}#${i}`, idx: i, name: t[0], age: t[1], booking: bk });
    });
  }
  return rows;
}

/** travellerId -> groupId */
export function assignedIds(groups: TourGroup[]): Record<string, string> {
  const set: Record<string, string> = {};
  for (const g of groups) for (const m of g.members) set[m] = g.id;
  return set;
}

/** bookingRef -> 1-based band number, for the "G3" chips. */
export function groupNumbers(groups: TourGroup[]): Record<string, number> {
  const out: Record<string, number> = {};
  groups.forEach((g, i) => {
    for (const m of g.members) {
      const ref = m.split('#')[0];
      if (!out[ref]) out[ref] = i + 1;
    }
  });
  return out;
}

/**
 * Keep the flat booking fields (guide, tour time) in step with the group each
 * of its passengers sits in — that is what every other screen reads.
 *
 * Only bookings that are in a group, or that have just been pulled out of one,
 * are touched: a guide assigned straight from the Bookings drawer on an
 * ungrouped booking has to survive later group edits.
 */
export function syncBookingsToGroups(
  bookings: Booking[],
  groups: TourGroup[],
  prevGroups: TourGroup[],
): Booking[] {
  const byRef: Record<string, { guide: string; tourTime: string }> = {};
  for (const g of groups) {
    for (const m of g.members) {
      const ref = m.split('#')[0];
      if (!byRef[ref]) byRef[ref] = { guide: g.guide || '', tourTime: g.time || '' };
    }
  }

  const wasGrouped: Record<string, true> = {};
  for (const g of prevGroups) {
    for (const m of g.members) wasGrouped[m.split('#')[0]] = true;
  }

  return bookings.map(bk => {
    const hit = byRef[bk.ref];
    if (hit) {
      if (bk.guide === hit.guide && bk.tourTime === hit.tourTime) return bk;
      return { ...bk, ...hit };
    }
    if (wasGrouped[bk.ref] && (bk.guide || bk.tourTime)) {
      return { ...bk, guide: '', tourTime: '' };
    }
    return bk;
  });
}

/**
 * A traveller waiting to be grouped, and where they are stuck if they are.
 *
 * `strandedIn` is the crux. A traveller counted as grouped disappears from the
 * queue, and the band holding them is only drawn when its own date is on
 * screen — so a passenger sitting in a band dated a day either side of the one
 * being worked on vanished from Grouping altogether. Their booking was right
 * there in Bookings with a guide against it, but there was no row to drag and
 * no band to drag it out of, which is exactly what operations hit: names
 * entered, booking locked, and nothing to assign.
 *
 * They now come back to the queue carrying the band that holds them, so the
 * screen can say where they went. Dropping one somewhere else is safe —
 * moveTraveler strips a traveller out of every group before adding them to the
 * target, so no one ends up in two bands.
 */
export interface QueueRow extends TravelerRow {
  strandedIn?: TourGroup;
}

export function ungroupedRows(
  rows: TravelerRow[],
  groups: TourGroup[],
  range: [string, string],
): QueueRow[] {
  const holder = new Map<string, TourGroup>();
  for (const g of groups) for (const m of g.members) holder.set(m, g);

  const out: QueueRow[] = [];
  for (const r of rows) {
    const g = holder.get(r.id);
    if (!g) { out.push(r); continue; }
    const onScreen = g.date >= range[0] && g.date <= range[1];
    if (!onScreen) out.push({ ...r, strandedIn: g });
  }
  return out;
}

export function moveTraveler(
  groups: TourGroup[],
  travelerId: string,
  targetGroupId: string | null,
): TourGroup[] {
  const next = groups.map(g => ({ ...g, members: g.members.filter(m => m !== travelerId) }));
  if (targetGroupId) {
    const g = next.find(x => x.id === targetGroupId);
    if (g) g.members = [...g.members, travelerId];
  }
  return next;
}

export interface AutoGroupResult {
  groups: TourGroup[];
  placed: number;
}

/** First-fit packing, largest party first, never splitting a booking. */
export function autoGroup(
  store: Pick<StoreData, 'bookings' | 'groups' | 'products'>,
  range: [string, string],
): AutoGroupResult {
  const rows = travelerRows(store.bookings, range);
  const assigned = assignedIds(store.groups);
  const free = rows.filter(r => !assigned[r.id]);
  if (!free.length) return { groups: store.groups, placed: 0 };

  const parties = new Map<string, { bk: Booking; ids: string[] }>();
  for (const r of free) {
    const entry = parties.get(r.booking.ref) ?? { bk: r.booking, ids: [] };
    entry.ids.push(r.id);
    parties.set(r.booking.ref, entry);
  }
  const ordered = [...parties.values()].sort((a, b) => b.ids.length - a.ids.length);

  const groups: TourGroup[] = store.groups.map(g => ({ ...g, members: [...g.members] }));

  for (const party of ordered) {
    const bk = party.bk;
    const cap = capOf(store.products, bk.code, bk.tg);
    const wanted = bk.tourTime || bk.resTime;

    // Top up an existing band of the same product / option / time that still
    // has room; otherwise open a new one.
    let target = groups.find(g =>
      g.date === bk.date && g.code === bk.code && g.tg === bk.tg &&
      g.time === wanted && g.members.length + party.ids.length <= g.cap,
    );

    if (!target) {
      target = {
        id: uid('grp'),
        date: bk.date,
        code: bk.code,
        tg: bk.tg,
        time: wanted,
        ticketTime: wanted ? shiftTime(wanted, -30) : '',
        ticketStatus: 'Pending',
        guide: bk.guide || '',
        cap,
        notes: `Auto-grouped · ${bk.lang}`,
        members: [],
        tourName: bk.tourName,
      };
      groups.push(target);
    }
    target.members = [...target.members, ...party.ids];
  }

  return { groups, placed: free.length };
}

/* ── manifests ──────────────────────────────────────────────────────────── */
export interface ManifestRow {
  no: string; ref: string; name: string; age: string;
  role: 'Lead' | 'Guest'; phone: string; lang: string;
}

export interface ManifestBand {
  no: string; tour: string; tg: string; tgTitle: string;
  /** Departure time. */
  time: string;
  /** Venue entry / ticket time — when the group has to be at the gate. */
  ticketTime: string;
  /** What the operator wrote for the guide. Empty when there is nothing to say. */
  notes: string;
  guide: string; guidePhone: string;
  fill: string; pax: number; cap: number; rows: ManifestRow[];
}

/**
 * Auto-group stamps every band it creates with "Auto-grouped · EN". That is
 * the machine's own bookkeeping, not something a guide needs on a printed
 * sheet, so it is dropped — but only when it is the *entire* note. The moment
 * an operator adds anything of their own, the whole note prints.
 */
const AUTO_NOTE = /^Auto-grouped\s*·\s*\S+$/;
const printableNote = (note: string): string => {
  const n = (note || '').trim();
  return AUTO_NOTE.test(n) ? '' : n;
};

/**
 * The day's runsheet — one band per group built on the Grouping screen.
 *
 * The band *is* the group: its tour, option, time, guide and capacity are the
 * group's own, and its passengers are exactly the travellers dragged into it.
 * This used to re-derive bands from the bookings instead, keyed on
 * time|product|grade|guide, which quietly split a single group whenever it
 * mixed tour grades — operations would build one band of six and the manifest
 * would print two. A group is an operational decision; the manifest reports it
 * rather than second-guessing it.
 *
 * Bookings that carry a guide and a tour time without belonging to any group
 * still appear, grouped the old way, so setting those two fields directly on a
 * booking is not a silent way to fall off the runsheet.
 */
export function manifestBands(store: StoreData, date: string, guideFilter?: string): ManifestBand[] {
  const live = store.bookings.filter(x => x.status !== 'Cancelled');
  const byRef = new Map(live.map(b => [b.ref, b]));

  const rowFor = (b: Booking, i: number, no: number): ManifestRow => ({
    no: String(no),
    ref: b.ref,
    name: b.travelers[i]?.[0] ?? '',
    age: b.travelers[i]?.[1] ?? 'Adult',
    // "Lead" is the booking's first traveller — the person Viator holds the
    // contact details for — not the first person to land in the band.
    role: i === 0 ? 'Lead' : 'Guest',
    phone: i === 0 ? b.phone : '',
    lang: b.lang,
  });

  /* ── bands from the groups themselves ── */
  const groups = store.groups
    .filter(g => g.date === date && g.time && g.guide
      && (!guideFilter || g.guide === guideFilter))
    .sort((a, b) => (a.time + a.tourName).localeCompare(b.time + b.tourName));

  const bands: Omit<ManifestBand, 'no'>[] = [];

  for (const g of groups) {
    let no = 0;
    const rows: ManifestRow[] = [];
    for (const m of g.members) {
      const [ref, idxRaw] = m.split('#');
      const b = byRef.get(ref);
      const i = Number(idxRaw);
      // A member can dangle if its booking was cancelled or its travellers
      // were trimmed after grouping. Skip rather than print a blank line.
      if (!b || !Number.isInteger(i) || !b.travelers[i]) continue;
      no += 1;
      rows.push(rowFor(b, i, no));
    }
    if (!rows.length) continue;

    const cap = g.cap || capOf(store.products, g.code, g.tg);
    bands.push({
      tour: productName(store.products, { code: g.code, tourName: g.tourName }),
      tg: g.tg,
      tgTitle: tgTitleOf(store.products, { code: g.code, tg: g.tg, tgTitle: '' }),
      time: g.time,
      ticketTime: g.ticketTime,
      notes: printableNote(g.notes),
      guide: g.guide,
      guidePhone: guidePhone(store.guides, store.staff, g.guide),
      fill: `${rows.length}/${cap} pax`,
      pax: rows.length,
      cap,
      rows,
    });
  }

  /* ── anything scheduled but never grouped ── */
  const grouped = assignedIds(store.groups);
  const loose = live.filter(x =>
    x.date === date && x.guide && x.tourTime
    && (!guideFilter || x.guide === guideFilter)
    && x.travelers.some((_, i) => !grouped[`${x.ref}#${i}`]));

  const keys: string[] = [];
  for (const x of loose) {
    const k = [x.tourTime, x.code, x.tg, x.guide].join('|');
    if (!keys.includes(k)) keys.push(k);
  }
  keys.sort();

  for (const k of keys) {
    const [time, code, tg, guide] = k.split('|');
    const items = loose.filter(x =>
      x.tourTime === time && x.code === code && x.tg === tg && x.guide === guide);

    let no = 0;
    const rows: ManifestRow[] = [];
    for (const x of items) {
      x.travelers.forEach((_, i) => {
        if (grouped[`${x.ref}#${i}`]) return;
        no += 1;
        rows.push(rowFor(x, i, no));
      });
    }
    if (!rows.length) continue;

    const cap = capOf(store.products, code, tg);
    const first = items[0];
    bands.push({
      tour: first ? productName(store.products, first) : code,
      tg,
      tgTitle: first ? tgTitleOf(store.products, first) : tg,
      time,
      // These never went through Grouping, so nobody set an entry time or a note.
      ticketTime: '',
      notes: '',
      guide,
      guidePhone: guidePhone(store.guides, store.staff, guide),
      fill: `${rows.length}/${cap} pax`,
      pax: rows.length,
      cap,
      rows,
    });
  }

  return bands
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((band, gi) => ({ ...band, no: String(gi + 1) }));
}

/* ── message templates ──────────────────────────────────────────────────── */
export function templateVars(products: Product[], bk: Booking | null): Record<string, string> {
  if (!bk) {
    return { lead: 'traveller', tour: 'your tour', ref: '', date: '', time: '', guide: '', pax: '' };
  }
  return {
    lead: bk.travelers[0]?.[0] || 'traveller',
    tour: productName(products, bk),
    ref: bk.ref,
    date: longDate(bk.date),
    time: bk.tourTime || bk.resTime,
    guide: bk.guide || 'your guide',
    pax: String(paxOf(bk)),
  };
}

/** Fill both the design's `{lead}` and the older build's `{leadTraveler}`. */
export function fillTemplate(body: string, vars: Record<string, string>): string {
  const alias: Record<string, string> = {
    leadTraveler: vars.lead, tourName: vars.tour, bookingRef: vars.ref,
    travelDate: vars.date, tourTime: vars.time, ...vars,
  };
  return String(body || '').replace(/\{(\w+)\}/g, (m, k: string) =>
    alias[k] !== undefined ? alias[k] : m);
}

/* ── attention feed ─────────────────────────────────────────────────────── */
export interface Note {
  id: string; title: string; body: string; dot: string; screen: string; ref?: string;
}

/**
 * How far ahead tickets have to be arranged. Venues differ — some want three
 * days, some five — so the reminder fires at the longest of them and covers
 * both rather than firing twice.
 */
export const TICKET_LEAD_DAYS = 5;

/** Ticket states that still need someone to act. */
const TICKETS_OUTSTANDING = ['Pending', 'Reserved'];

export function notifications(store: StoreData, today: string): Note[] {
  const out: Note[] = [];
  const upcoming = store.bookings.filter(b => b.date >= today && b.status !== 'Cancelled');

  /* ── tickets to prepare ──
     First in the list because it is the only item with a hard external
     deadline: miss it and the tour cannot run, where the others are catch-up
     work. Ticket status lives on the group, so an ungrouped departure inside
     the window counts as outstanding too — nobody has booked its tickets. */
  const horizon = addDays(today, TICKET_LEAD_DAYS);
  const groupOfTraveler = new Map<string, TourGroup>();
  for (const g of store.groups) for (const m of g.members) groupOfTraveler.set(m, g);

  const groupFor = (b: Booking): TourGroup | null => {
    for (let i = 0; i < b.travelers.length; i += 1) {
      const g = groupOfTraveler.get(`${b.ref}#${i}`);
      if (g) return g;
    }
    return null;
  };

  const ticketsDue = upcoming.filter(b => {
    if (b.date > horizon) return false;
    const g = groupFor(b);
    return !g || TICKETS_OUTSTANDING.includes(g.ticketStatus);
  });

  if (ticketsDue.length) {
    const soonest = ticketsDue.reduce((a, b) => (b.date < a ? b.date : a), ticketsDue[0].date);
    const days = Math.max(0, Math.round(
      (new Date(`${soonest}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
    ));
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    out.push({
      id: 'n-tickets',
      title: `${ticketsDue.length} departure${ticketsDue.length === 1 ? '' : 's'} need tickets`,
      body: `Within the next ${TICKET_LEAD_DAYS} days — the soonest departs ${when}, on ${longDate(soonest)}. `
        + 'Mark a band as Reserved or Issued in Grouping once its tickets are arranged.',
      dot: '#fd9707',
      screen: 'groups',
    });
  }

  const noGuide = upcoming.filter(b => !b.guide || !b.tourTime);
  if (noGuide.length) {
    out.push({
      id: 'n-guide',
      title: `${noGuide.length} booking${noGuide.length === 1 ? '' : 's'} without a guide`,
      body: 'These departures still need a tour time and a guide before tickets can be issued.',
      dot: '#fdb44e',
      screen: 'groups',
    });
  }

  const noNames = upcoming.filter(b =>
    b.travelers.some(t => /^(Guest|Child|Traveller|Traveler)\s+\d+$/i.test(t[0])));
  if (noNames.length) {
    out.push({
      id: 'n-names',
      title: `${noNames.length} booking${noNames.length === 1 ? '' : 's'} missing passport names`,
      body: 'Tickets are issued in the passengers’ names, so placeholders have to be replaced first.',
      dot: '#ff9a9a',
      screen: 'bookings',
    });
  }

  const unmessaged = upcoming.filter(b => wfOutstanding(b.wf));
  if (unmessaged.length) {
    out.push({
      id: 'n-msg',
      title: `${unmessaged.length} traveller${unmessaged.length === 1 ? '' : 's'} awaiting a message`,
      body: 'Name collection, confirmation or ticketing has not been sent yet.',
      dot: '#5ad1a0',
      screen: 'messages',
    });
  }

  const pendingExpenses = store.expenses.filter(e => e.status === 'Pending');
  if (pendingExpenses.length) {
    out.push({
      id: 'n-exp',
      title: `${pendingExpenses.length} expense${pendingExpenses.length === 1 ? '' : 's'} pending approval`,
      body: 'Costs stay out of the balance until an owner approves them.',
      dot: '#fdb44e',
      screen: 'finance',
    });
  }

  return out;
}

/* ── command palette ────────────────────────────────────────────────────── */
export interface CmdResult {
  id: string; title: string; sub: string;
  tag: string; tagBg: string; tagFg: string;
  screen: string; ref?: string;
}

export function commandSearch(store: StoreData, query: string, limit = 8): CmdResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: CmdResult[] = [];

  for (const b of store.bookings) {
    if (out.length >= limit) break;
    const lead = b.travelers[0]?.[0] || '';
    const hit =
      b.ref.toLowerCase().includes(q) ||
      b.phone.toLowerCase().includes(q) ||
      lead.toLowerCase().includes(q) ||
      b.travelers.some(t => t[0].toLowerCase().includes(q));
    if (!hit) continue;
    out.push({
      id: `b-${b.ref}`,
      title: `${lead || 'Booking'} · ${b.ref}`,
      sub: `${productName(store.products, b)} · ${b.date}${b.tourTime ? ` · ${b.tourTime}` : ''}`,
      tag: 'Booking', tagBg: '#eaf1fb', tagFg: '#1f4e8c',
      screen: 'bookings', ref: b.ref,
    });
  }

  for (const g of store.guides) {
    if (out.length >= limit) break;
    if (!g.name.toLowerCase().includes(q) && !g.phone.toLowerCase().includes(q)) continue;
    out.push({
      id: `g-${g.id}`, title: g.name, sub: `${g.langs} · ${g.skills}`,
      tag: 'Guide', tagBg: '#e8f5ef', tagFg: '#0f6b48', screen: 'team',
    });
  }

  for (const c of store.customers) {
    if (out.length >= limit) break;
    if (!c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) continue;
    out.push({
      id: `c-${c.id}`, title: c.name, sub: `${c.country} · ${c.email}`,
      tag: 'Customer', tagBg: '#fdf3e3', tagFg: '#8a5106', screen: 'crm',
    });
  }

  for (const p of store.products) {
    if (out.length >= limit) break;
    if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) continue;
    out.push({
      id: `p-${p.code}`, title: p.name, sub: `${p.code} · ${p.label}`,
      tag: 'Tour', tagBg: '#f6f7f9', tagFg: '#5b6472', screen: 'tours',
    });
  }

  return out.slice(0, limit);
}
