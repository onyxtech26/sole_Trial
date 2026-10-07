import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Hov, IconBtn, Input, MONO, Modal, ModalFoot, ModalHead, NoteDot, Select,
  STATUS_COLORS, Section, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import {
  addDays, addMonths, delayOf, eur, inRange, rangeFor, rangeLabelFor, short, today,
  type RangeMode,
} from '../utils/dates';
import {
  hasNote, paxOf, productName, rankedGuides, syncBookingsToGroups, tgTitleOf,
} from '../utils/selectors';
import { isPlaceholderName } from '../utils/viator';
import { canSeeMoney } from '../utils/access';
import { MOBILE_QUERY, useMediaQuery } from '../ui/useMediaQuery';
import { RollingNumber } from '../ui/RollingNumber';
import { writeWorkbook } from '../utils/exports';
import { WF_STEPS, wfOutstanding } from '../utils/workflow';
import type { Booking } from '../types';
import type { Focus, ViewProps } from './types';
import { BookingDrawer } from './BookingDrawer';

const VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'ungrouped', label: 'Needs a guide' },
  { id: 'messages', label: 'Awaiting a message' },
  // A note is written to be acted on later, so there has to be a way back to it.
  { id: 'noted', label: 'Has a note' },
  { id: 'names', label: 'Names pending' },
  { id: 'all', label: 'All' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];
type SortCol =
  | 'manual' | 'ref' | 'date' | 'resTime' | 'tourTime' | 'tour' | 'tg' | 'lead' | 'pax'
  | 'guide' | 'status' | 'gross';

/* Time-slot filter. 'all' is the default so the saved views keep behaving the
   way they always have until someone deliberately narrows to a period. */
type Period = RangeMode | 'all';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
];

const PAGE_SIZE = 40;

/** Tickets are issued in passengers' names, so a placeholder is unfinished work. */
const namesPending = (b: Booking): boolean => b.travelers.some(t => isPlaceholderName(t[0]));

/** How long a jumped-to row keeps flashing before settling down. */
const FLASH_MS = 4200;

/**
 * A cancelled reservation is finished business. It cannot be grouped, it does
 * not run, and it earns nothing — leaving it in the list makes every count and
 * every scan of the table wrong, which is exactly what operations reported. So
 * the table hides them unless someone deliberately asks for them by choosing a
 * status of 'Cancelled' or 'Everything'.
 *
 * They are never deleted: the record stays, the Viator import keeps applying
 * cancellations to it, and every other screen already excludes it.
 */
const SHOW_ALL = 'everything';
const hidesCancelled = (fStatus: string): boolean =>
  fStatus !== 'Cancelled' && fStatus !== SHOW_ALL;

/**
 * How the table is sorted, remembered across reloads.
 *
 * The hand-placed order was already being saved to the database — what was not
 * saved was the *decision to use it*, so a refresh reset the table to date
 * order and the arrangement looked lost even though every position was still
 * on the row. Sorting is a per-operator preference, not shared data, so it
 * lives in this browser rather than in Supabase.
 */
const SORT_KEY = 'sole_bookings_sort_v1';

function readSort(): { col: SortCol; dir: 'asc' | 'desc' } {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { col?: string; dir?: string };
      if (v.col) {
        return {
          col: v.col as SortCol,
          dir: v.dir === 'desc' ? 'desc' : 'asc',
        };
      }
    }
  } catch {
    /* private mode, or someone hand-edited it — fall through to the default */
  }
  return { col: 'date', dir: 'asc' };
}

interface Props extends ViewProps {
  openRef: string | null;
  setOpenRef: (r: string | null) => void;
  /** Set when another screen sent the reader here to look at something. */
  focus?: Focus | null;
}

export function BookingsView({
  store, user, setConfirm, openRef, setOpenRef, focus,
}: Props) {
  const toast = useToast();
  const t = today();
  // Revenue stays masked for anyone who cannot see finance, so the column keeps
  // its width and the table does not reflow between roles.
  const showMoney = canSeeMoney(user.role);
  const compact = useMediaQuery(MOBILE_QUERY);

  const [view, setView] = useState<ViewId>('upcoming');
  const [period, setPeriod] = useState<Period>('all');
  const [anchor, setAnchor] = useState(t);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fTour, setFTour] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fGuide, setFGuide] = useState('all');
  const [fLang, setFLang] = useState('all');
  const [sortCol, setSortCol] = useState<SortCol>(() => readSort().col);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => readSort().dir);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [timeAsk, setTimeAsk] = useState<string | null>(null);
  /* Hand-placing rows only makes sense when the machine is not already
     ordering them, so the handles appear in Manual mode alone. */
  const [dragRef, setDragRef] = useState<string | null>(null);
  const [overRef, setOverRef] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [view, query, fTour, fStatus, fGuide, fLang, period, anchor]);

  // Remember how this operator left the table.
  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify({ col: sortCol, dir: sortDir }));
    } catch {
      /* not being able to remember the sort is not worth failing over */
    }
  }, [sortCol, sortDir]);

  /**
   * Land where the reader was sent, and say which rows they were sent for.
   *
   * Arriving on a table of twelve hundred reservations having been told four of
   * them need attention is not much of an answer, so the view narrows to the
   * question that was asked and the rows that answered it are flashed. The
   * flash stops on its own — it is a pointer, not a permanent state, and a
   * table that never stops moving is worse than one that never pointed.
   */
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  /**
   * The exact reservations a jump was made for.
   *
   * The saved view alone was not enough. "1 still on placeholder names" counted
   * the fortnight ahead while Names pending shows every reservation on a
   * placeholder whatever its date, so the pill promised one row and the table
   * delivered dozens — which is precisely what makes a figure look invented.
   * Narrowing to the counted set makes the two agree by construction rather
   * than by two filters happening to be written the same way.
   */
  const [focusRefs, setFocusRefs] = useState<Set<string> | null>(null);
  const [focusLabel, setFocusLabel] = useState('');

  useEffect(() => {
    if (!focus) return;
    if (focus.view) {
      setView(focus.view as ViewId);
      // The rows being pointed at may be anywhere in the book, so a narrowed
      // period would hide the very thing the reader was sent to see.
      setPeriod('all');
      setPage(0);
    }
    if (!focus.refs.length) return;
    setFocusRefs(new Set(focus.refs));
    setFocusLabel(focus.label || '');
    setFlashing(new Set(focus.refs));
    /* Scrolling is deferred a tick: the view switch above re-renders the table,
       and the row being scrolled to does not exist until it has. */
    const scroll = setTimeout(() => {
      const first = document.getElementById(`bk-${focus.refs[0]}`);
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 90);
    const stop = setTimeout(() => setFlashing(new Set()), FLASH_MS);
    return () => { clearTimeout(scroll); clearTimeout(stop); };
  }, [focus]);

  /** Step back out to the whole view the dashboard narrowed. */
  const clearFocus = () => {
    setFocusRefs(null);
    setFocusLabel('');
    setFlashing(new Set());
  };

  const manualOrder = sortCol === 'manual';

  const periodRange = useMemo(
    () => (period === 'all' ? null : rangeFor(period, anchor, anchor)),
    [period, anchor],
  );

  /* Step the window by its own unit, so "next" on Weekly means next week. */
  const stepPeriod = (dir: 1 | -1) => {
    if (period === 'today') setAnchor(a => addDays(a, dir));
    else if (period === 'week') setAnchor(a => addDays(a, 7 * dir));
    else if (period === 'month') setAnchor(a => addMonths(a, dir));
    else if (period === 'year') setAnchor(a => addMonths(a, 12 * dir));
  };

  /* ── selection helpers ── */
  const countView = (v: ViewId): number => {
    // Counts respect the time slot too, otherwise a chip promises rows the
    // narrowed table cannot show.
    const base = hidesCancelled(fStatus)
      ? store.bookings.filter(x => x.status !== 'Cancelled')
      : store.bookings;
    const l = periodRange ? base.filter(x => inRange(x.date, periodRange)) : base;
    if (v === 'all') return l.length;
    if (v === 'today') return l.filter(x => x.date === t).length;
    if (v === 'upcoming') return l.filter(x => x.date >= t).length;
    if (v === 'ungrouped') return l.filter(x => !x.guide || !x.tourTime).length;
    if (v === 'noted') return l.filter(hasNote).length;
    if (v === 'names') return l.filter(namesPending).length;
    return l.filter(x => wfOutstanding(x.wf) && x.date >= t).length;
  };

  /** How many the saved view holds beyond the set the dashboard sent. */
  const outsideFocus = focusRefs ? Math.max(0, countView(view) - focusRefs.size) : 0;

  const filtered = useMemo(() => {
    let l = [...store.bookings];
    // The dashboard asked for these by name; nothing else should be on screen.
    if (focusRefs) l = l.filter(x => focusRefs.has(x.ref));
    if (periodRange) l = l.filter(x => inRange(x.date, periodRange));
    if (view === 'today') l = l.filter(x => x.date === t);
    else if (view === 'upcoming') l = l.filter(x => x.date >= t);
    else if (view === 'ungrouped') l = l.filter(x => !x.guide || !x.tourTime);
    else if (view === 'messages') l = l.filter(x => wfOutstanding(x.wf) && x.date >= t);
    else if (view === 'noted') l = l.filter(hasNote);
    else if (view === 'names') l = l.filter(namesPending);

    if (fTour !== 'all') l = l.filter(x => x.code === fTour);
    if (hidesCancelled(fStatus)) l = l.filter(x => x.status !== 'Cancelled');
    if (fStatus !== 'all' && fStatus !== SHOW_ALL) l = l.filter(x => x.status === fStatus);
    if (fLang !== 'all') l = l.filter(x => x.lang === fLang);
    if (fGuide === 'none') l = l.filter(x => !x.guide);
    else if (fGuide !== 'all') l = l.filter(x => x.guide === fGuide);

    const q = query.trim().toLowerCase();
    if (q) {
      l = l.filter(x =>
        x.ref.toLowerCase().includes(q) ||
        x.phone.toLowerCase().includes(q) ||
        productName(store.products, x).toLowerCase().includes(q) ||
        x.travelers.some(tv => tv[0].toLowerCase().includes(q)));
    }

    if (sortCol === 'manual') {
      // Unplaced rows (sortOrder 0) sit behind the placed ones, in date order,
      // so a half-arranged list still reads sensibly.
      return l.sort((a, b) => {
        const oa = a.sortOrder || Number.MAX_SAFE_INTEGER;
        const ob = b.sortOrder || Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return (a.date + a.ref).localeCompare(b.date + b.ref);
      });
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    const key = (x: Booking): string | number => {
      switch (sortCol) {
        case 'ref': return x.ref;
        case 'resTime': return x.resTime || '~';
        case 'tourTime': return x.tourTime || '~';
        case 'tour': return productName(store.products, x);
        case 'tg': return x.tg;
        case 'lead': return x.travelers[0]?.[0] ?? '';
        case 'pax': return paxOf(x);
        case 'guide': return x.guide || '~';
        case 'status': return x.status;
        case 'gross': return x.gross;
        default: return x.date + (x.tourTime || x.resTime);
      }
    };
    return l.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
      return String(ka).localeCompare(String(kb)) * dir;
    });
  }, [store.bookings, store.products, view, fTour, fStatus, fGuide, fLang, query,
    sortCol, sortDir, t, periodRange, focusRefs]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const filterCount =
    (query.trim() ? 1 : 0) +
    [fTour, fStatus, fGuide, fLang].filter(v => v !== 'all').length;

  const guideNames = useMemo(
    () => [...rankedGuides(store.guides).map(g => g.name), ...store.staff.map(s => s.name)],
    [store.guides, store.staff],
  );

  const langs = useMemo(
    () => [...new Set(store.bookings.map(b => b.lang).filter(Boolean))].sort(),
    [store.bookings],
  );

  /* ── writes ── */
  const patch = (refs: string[], fn: (b: Booking) => Partial<Booking>) => {
    const set = new Set(refs);
    commit({
      bookings: store.bookings.map(b => (set.has(b.ref) ? { ...b, ...fn(b) } : b)),
    });
  };

  /**
   * Drop `dragRef` in front of `targetRef` and renumber.
   *
   * The whole filtered list is renumbered 1..n, not just the visible page, so
   * the order the operator sees is the order that persists — including rows
   * further down the pagination. Bookings outside the current filter keep the
   * positions they already had.
   */
  const reorder = (targetRef: string) => {
    if (!dragRef || dragRef === targetRef) return;
    const order = filtered.map(b => b.ref).filter(r => r !== dragRef);
    const at = order.indexOf(targetRef);
    if (at < 0) return;
    order.splice(at, 0, dragRef);

    const position = new Map(order.map((r, i) => [r, i + 1]));
    commit({
      bookings: store.bookings.map(b => {
        const next = position.get(b.ref);
        return next && next !== b.sortOrder ? { ...b, sortOrder: next } : b;
      }),
    });
  };

  const toggleWf = (b: Booking, i: number) => {
    const wf = b.wf.slice();
    wf[i] = wf[i] ? 0 : 1;
    patch([b.ref], () => ({ wf }));
  };

  const removeBookings = (refs: string[]) => {
    const set = new Set(refs);
    const groups = store.groups.map(g => ({
      ...g, members: g.members.filter(m => !set.has(m.split('#')[0])),
    }));
    commit({ bookings: store.bookings.filter(b => !set.has(b.ref)), groups });
    setSelected([]);
    setOpenRef(null);
    toast(`${refs.length} booking${refs.length === 1 ? '' : 's'} deleted`);
  };

  const applyGuide = (refs: string[], guide: string) => {
    patch(refs, () => ({ guide }));
    toast(guide ? `Assigned to ${guide}` : 'Guide cleared');
  };

  const applyTourTime = (refs: string[], time: string) => {
    const set = new Set(refs);
    const groups = store.groups.map(g =>
      g.members.some(m => set.has(m.split('#')[0])) ? { ...g, time } : g);
    commit({
      bookings: store.bookings.map(b => (set.has(b.ref) ? { ...b, tourTime: time } : b)),
      groups,
    });
    toast(`Tour time set to ${time}`);
  };

  const exportRows = async () => {
    await writeWorkbook(`sole-bookings-${t}.xlsx`, [{
      name: 'Bookings',
      head: [
        'Reference', 'Date', 'Reserved', 'Tour time', 'Tour', 'Grade', 'Option', 'Lead passenger',
        'Pax', 'Language', 'Guide', 'Status', 'Payment', 'Revenue', 'Phone', 'Notes',
      ],
      rows: filtered.map(b => [
        b.ref, b.date, b.resTime, b.tourTime, productName(store.products, b), b.tg,
        tgTitleOf(store.products, b), b.travelers[0]?.[0] ?? '', paxOf(b), b.lang,
        b.guide, b.status, b.payment, b.gross, b.phone, b.notes,
      ]),
    }]);
    toast(`Exported ${filtered.length} bookings`);
  };

  const allChecked = rows.length > 0 && rows.every(r => selected.includes(r.ref));
  const sortBy = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };
  const arrow = (col: SortCol) => (sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  const drawerBooking = openRef ? store.bookings.find(b => b.ref === openRef) ?? null : null;

  return (
    <>
      {/* ── view tabs + actions ── */}
      <div data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {VIEWS.map(v => {
          const on = view === v.id;
          return (
            <Hov
              key={v.id}
              as="button"
              type="button"
              onClick={() => { setView(v.id); clearFocus(); }}
              aria-pressed={on}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: `1px solid ${on ? C.ink : C.line}`, borderRadius: 6,
                padding: '5px 10px', fontSize: 12, fontWeight: on ? 600 : 500,
                cursor: 'pointer', background: on ? C.ink : C.panel, color: on ? '#fff' : C.body,
              }}
              hover={on ? undefined : { borderColor: '#c9ced7' }}
            >
              {v.label}
              <RollingNumber
                value={countView(v.id)}
                style={{
                  fontFamily: MONO, fontSize: 10,
                  color: on ? 'rgba(255,255,255,.65)' : C.faint,
                }}
              />
            </Hov>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* ── time slot ── */}
        <div data-r="seg" style={{
          display: 'flex', border: `1px solid ${C.line}`, background: C.panel,
          borderRadius: 6, overflow: 'hidden',
        }}>
          {PERIODS.map(p => {
            const on = period === p.id;
            return (
              <Hov
                key={p.id}
                as="button"
                type="button"
                onClick={() => { setPeriod(p.id); setAnchor(t); }}
                aria-pressed={on}
                style={{
                  border: 0, borderRight: `1px solid ${C.lineSoft}`, padding: '5px 10px',
                  fontSize: 11.5, fontWeight: on ? 600 : 500, cursor: 'pointer',
                  background: on ? C.ink : C.panel, color: on ? '#fff' : C.body,
                }}
                hover={on ? undefined : { background: C.paper }}
              >
                {p.label}
              </Hov>
            );
          })}
        </div>

        {periodRange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <IconBtn icon="chevronLeft" title="Previous period" onClick={() => stepPeriod(-1)} />
            <span style={{
              minWidth: 118, textAlign: 'center', fontSize: 11.5,
              fontWeight: 500, color: C.body,
            }}>
              {rangeLabelFor(period as RangeMode, anchor, anchor)}
            </span>
            <IconBtn icon="chevronRight" title="Next period" onClick={() => stepPeriod(1)} />
          </div>
        )}

        <Hov
          as="button"
          type="button"
          onClick={() => setFiltersOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: `1px solid ${filterCount ? C.accent : C.line}`,
            background: filterCount ? C.accentWash : C.panel, borderRadius: 6,
            padding: '5px 10px', fontSize: 12, fontWeight: 500,
            color: filterCount ? C.accentInk : C.body, cursor: 'pointer',
          }}
          hover={{ borderColor: '#c9ced7' }}
        >
          <Icon name="sliders" size={13} />
          Filters
          {!!filterCount && <span style={{ fontFamily: MONO, fontSize: 10 }}>{filterCount}</span>}
        </Hov>

        {/* Manual order is a sort like any other, so it lives with the sorting
            rather than as a separate mode switch. Turning it on reveals the
            drag handles; picking any column header turns it back off. Hidden
            below the shell breakpoint, where rows are cards and there is no
            table to drag within. */}
        {!compact && (
        <Hov
          as="button"
          type="button"
          title={manualOrder
            ? 'Sorted by hand — drag the rows to rearrange them'
            : 'Arrange these bookings by hand'}
          aria-pressed={manualOrder}
          onClick={() => setSortCol(manualOrder ? 'date' : 'manual')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            border: `1px solid ${manualOrder ? C.accent : C.line}`,
            background: manualOrder ? C.accentWash : C.panel, borderRadius: 6,
            padding: '5px 10px', fontSize: 12, fontWeight: manualOrder ? 600 : 500,
            color: manualOrder ? C.accentInk : C.body, cursor: 'pointer',
          }}
          hover={{ borderColor: '#c9ced7' }}
        >
          <Icon name="rows" size={13} />
          Arrange
        </Hov>
        )}

        <Btn icon="download" small onClick={exportRows}>Export</Btn>

        <Btn
          variant="primary"
          icon="plus"
          style={{ padding: '6px 11px', fontSize: 12 }}
          onClick={() => setOpenRef('__new__')}
        >
          New booking
        </Btn>
      </div>

      {/* ── filters ── */}
      {filtersOpen && (
        <section className="up-sm" style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
          padding: '12px 14px', display: 'flex', alignItems: 'flex-end',
          gap: 11, flexWrap: 'wrap',
        }}>
          <FilterField label="Search" style={{ flex: 1, minWidth: 190 }}>
            <Input
              value={query}
              onChange={(e: any) => setQuery(e.target.value)}
              placeholder="Reference, traveller, phone or tour"
            />
          </FilterField>

          <FilterField label="Tour" style={{ minWidth: 168 }}>
            <Select
              value={fTour}
              onChange={(e: any) => setFTour(e.target.value)}
              options={[
                { v: 'all', t: 'All tours' },
                ...store.products.map(p => ({ v: p.code, t: p.name })),
              ]}
              style={{ background: C.panel }}
            />
          </FilterField>

          <FilterField label="Status" style={{ minWidth: 130 }}>
            <Select
              value={fStatus}
              onChange={(e: any) => setFStatus(e.target.value)}
              options={[
                { v: 'all', t: 'Active (hides cancelled)' },
                ...['Confirmed', 'Modified', 'Pending'].map(s => ({ v: s, t: s })),
                { v: 'Cancelled', t: 'Cancelled only' },
                { v: SHOW_ALL, t: 'Everything, incl. cancelled' },
              ]}
              style={{ background: C.panel }}
            />
          </FilterField>

          <FilterField label="Guide" style={{ minWidth: 120 }}>
            <Select
              value={fGuide}
              onChange={(e: any) => setFGuide(e.target.value)}
              options={[
                { v: 'all', t: 'Anyone' },
                { v: 'none', t: 'No guide yet' },
                ...guideNames.map(n => ({ v: n, t: n })),
              ]}
              style={{ background: C.panel }}
            />
          </FilterField>

          <FilterField label="Language" style={{ minWidth: 104 }}>
            <Select
              value={fLang}
              onChange={(e: any) => setFLang(e.target.value)}
              options={[{ v: 'all', t: 'Any' }, ...langs.map(l => ({ v: l, t: l }))]}
              style={{ background: C.panel }}
            />
          </FilterField>

          <Btn
            onClick={() => {
              setQuery(''); setFTour('all'); setFStatus('all'); setFGuide('all'); setFLang('all');
            }}
            style={{ height: 30 }}
          >
            Clear
          </Btn>
        </section>
      )}

      {/* ── bulk bar ── */}
      {selected.length > 0 && (
        <div className="up-sm" style={{
          display: 'flex', alignItems: 'center', gap: 8, background: C.ink, color: '#fff',
          borderRadius: 7, padding: '8px 13px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{selected.length} selected</span>
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,.16)' }} />

          <select
            value=""
            onChange={e => { if (e.target.value) applyGuide(selected, e.target.value); }}
            style={darkControl}
          >
            <option value="" style={{ color: C.ink }}>Assign guide…</option>
            {guideNames.map(n => (
              <option key={n} value={n} style={{ color: C.ink }}>{n}</option>
            ))}
          </select>

          <Hov
            as="button"
            type="button"
            onClick={() => setTimeAsk('09:00')}
            style={{ ...darkControl, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', cursor: 'pointer' }}
            hover={{ background: 'rgba(255,255,255,.14)' }}
          >
            <Icon name="clock" size={12} />
            Set tour time
          </Hov>

          <select
            value=""
            onChange={e => {
              const i = Number(e.target.value);
              if (Number.isNaN(i) || e.target.value === '') return;
              patch(selected, b => {
                const wf = b.wf.slice();
                wf[i] = 1;
                return { wf };
              });
              toast(`Marked “${WF_STEPS[i].label}” on ${selected.length} bookings`);
            }}
            style={darkControl}
          >
            <option value="" style={{ color: C.ink }}>Mark stage…</option>
            {WF_STEPS.map((w, i) => (
              <option key={w.letter} value={i} style={{ color: C.ink }}>{w.label}</option>
            ))}
          </select>

          <Hov
            as="button"
            type="button"
            onClick={() => {
              setConfirm({
                title: `Delete ${selected.length} booking${selected.length === 1 ? '' : 's'}?`,
                body: 'They are removed from the shared database and from any group they sit in. This cannot be undone.',
                confirmLabel: 'Delete',
                tone: 'danger',
                run: () => removeBookings(selected),
              });
            }}
            style={{
              ...darkControl, color: '#ffb3c1', display: 'flex',
              alignItems: 'center', gap: 6, padding: '4px 9px', cursor: 'pointer',
            }}
            hover={{ background: 'rgba(255,255,255,.14)' }}
          >
            <Icon name="trash" size={12} />
            Delete
          </Hov>

          <div style={{ flex: 1 }} />
          <Hov
            as="button"
            type="button"
            onClick={() => setSelected([])}
            style={{
              border: 0, background: 'transparent', color: 'rgba(255,255,255,.6)',
              fontSize: 11.5, fontWeight: 500, cursor: 'pointer', padding: '2px 4px',
            }}
            hover={{ color: '#fff' }}
          >
            Clear
          </Hov>
        </div>
      )}

      {/* ── narrowed by the dashboard ────────────────────────────────────────
          Says out loud that the table is showing a subset, and how many, so the
          figure on the pill and the rows underneath can be checked against each
          other at a glance. Stepping back out is one click. */}
      {focusRefs && (
        <Section
          className="up-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px',
            borderColor: C.accent, background: C.accentWash,
          }}
        >
          <Icon name="sparkles" size={13} color={C.accentInk} />
          <span style={{ fontSize: 12, color: C.body }}>
            Showing the{' '}
            <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{focusRefs.size}</b>
            {' '}booking{focusRefs.size === 1 ? '' : 's'}
            {focusLabel ? ` ${focusLabel}` : ' sent from the dashboard'}.
            {/* The chip above counts the whole book, past departures included,
                so without this line the two numbers look like a contradiction
                rather than two different questions. */}
            {outsideFocus > 0 && (
              <span style={{ color: C.muted2 }}>
                {' '}The tab counts{' '}
                <b style={{ color: C.body, fontVariantNumeric: 'tabular-nums' }}>
                  {focusRefs.size + outsideFocus}
                </b>
                {' '}in all, including {outsideFocus} already departed or further out.
              </span>
            )}
          </span>
          <div style={{ flex: 1 }} />
          <Hov
            as="button"
            type="button"
            onClick={clearFocus}
            style={{
              border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6,
              padding: '4px 11px', fontSize: 11.5, fontWeight: 600,
              color: C.body, cursor: 'pointer',
            }}
            hover={{ borderColor: C.accent, color: C.ink }}
          >
            Show the whole view
          </Hov>
        </Section>
      )}

      {/* ── table ── */}
      <Section data-r="scroll">
        <div data-r="tablewrap" style={{ minWidth: 1192 }}>
          <div data-r="thead" style={{
            display: 'flex', alignItems: 'center', gap: 10, height: 31, padding: '0 13px',
            borderBottom: `1px solid ${C.line}`, background: C.wash, fontSize: 9.5,
            fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: C.muted2,
          }}>
            {manualOrder && <span style={{ width: 14, flexShrink: 0 }} />}
            <CheckBox
              checked={allChecked}
              onClick={() => setSelected(allChecked ? [] : rows.map(r => r.ref))}
            />
            <SortHead w={104} onClick={() => sortBy('ref')} on={sortCol === 'ref'}>Reference{arrow('ref')}</SortHead>
            <SortHead w={52} onClick={() => sortBy('date')} on={sortCol === 'date'}>Date{arrow('date')}</SortHead>
            <SortHead w={52} onClick={() => sortBy('resTime')} on={sortCol === 'resTime'}>Res.{arrow('resTime')}</SortHead>
            <SortHead w={58} onClick={() => sortBy('tourTime')} on={sortCol === 'tourTime'}>Tour{arrow('tourTime')}</SortHead>
            <SortHead flex onClick={() => sortBy('tour')} on={sortCol === 'tour'}>Tour type{arrow('tour')}</SortHead>
            <SortHead w={58} onClick={() => sortBy('tg')} on={sortCol === 'tg'}>Grade{arrow('tg')}</SortHead>
            <SortHead w={124} onClick={() => sortBy('lead')} on={sortCol === 'lead'}>Lead passenger{arrow('lead')}</SortHead>
            <SortHead w={38} center onClick={() => sortBy('pax')} on={sortCol === 'pax'}>Pax{arrow('pax')}</SortHead>
            <span style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>Lng</span>
            <SortHead w={104} onClick={() => sortBy('guide')} on={sortCol === 'guide'}>Guide{arrow('guide')}</SortHead>
            <SortHead w={78} onClick={() => sortBy('status')} on={sortCol === 'status'}>Status{arrow('status')}</SortHead>
            <span style={{ width: 88, flexShrink: 0, textAlign: 'center' }}>Workflow</span>
            <SortHead w={70} right onClick={() => sortBy('gross')} on={sortCol === 'gross'}>Viator{arrow('gross')}</SortHead>
          </div>

          {!rows.length && (
            <div style={{
              padding: '44px 16px', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 7, textAlign: 'center',
            }}>
              <Icon name="alert" size={20} color="#c9ced7" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>No bookings match</span>
              <span style={{
                fontSize: 11.5, color: C.muted, maxWidth: 300,
                lineHeight: 1.5, textWrap: 'pretty',
              }}>
                Nothing in this saved view matches the current filters. Clear them, or import
                the latest booking export.
              </span>
            </div>
          )}

          {rows.map((r, i) => {
            const checked = selected.includes(r.ref);
            const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.Confirmed;
            const namesPending = r.travelers.some(tv => isPlaceholderName(tv[0]));

            // A 1180px-wide row is unreadable on a phone, and side-scrolling a
            // table to find a guide is not a workflow. Below 820px the same
            // record is rendered as a stacked card instead.
            if (compact) {
              return (
                <BookingCard
                  key={r.ref}
                  b={r}
                  index={i}
                  checked={checked}
                  status={sc}
                  namesPending={namesPending}
                  tour={productName(store.products, r)}
                  option={tgTitleOf(store.products, r)}
                  showMoney={showMoney}
                  flash={flashing.has(r.ref)}
                  onOpen={() => setOpenRef(r.ref)}
                  onToggleSelect={() =>
                    setSelected(s => (checked ? s.filter(x => x !== r.ref) : [...s, r.ref]))}
                  onToggleWf={wi => toggleWf(r, wi)}
                />
              );
            }

            const flash = flashing.has(r.ref);
            return (
              <Hov
                key={r.ref}
                as="div"
                id={`bk-${r.ref}`}
                className={`row up-sm${flash ? ' flash-row' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenRef(r.ref)}
                onKeyDown={(e: any) => { if (e.key === 'Enter') setOpenRef(r.ref); }}
                draggable={manualOrder}
                onDragStart={() => setDragRef(r.ref)}
                onDragEnd={() => { setDragRef(null); setOverRef(null); }}
                onDragOver={(e: any) => {
                  if (!manualOrder || !dragRef) return;
                  e.preventDefault();
                  setOverRef(r.ref);
                }}
                onDragLeave={() => setOverRef(o => (o === r.ref ? null : o))}
                onDrop={(e: any) => {
                  if (!manualOrder) return;
                  e.preventDefault();
                  reorder(r.ref);
                  setDragRef(null);
                  setOverRef(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 42,
                  padding: '0 13px', cursor: 'pointer',
                  borderBottom: `1px solid ${C.lineFaint}`,
                  // A dragged row lands *above* the one it is dropped on, so
                  // the indicator sits on the target's top edge. Drawn as an
                  // inset shadow rather than a border so nothing shifts by a
                  // pixel as it appears.
                  boxShadow: overRef === r.ref && dragRef
                    ? `inset 0 2px 0 0 ${C.accent}`
                    : 'none',
                  background: checked ? C.accentWash : C.panel,
                  opacity: dragRef === r.ref ? 0.4 : 1,
                  animationDelay: delayOf(i),
                }}
                hover={{ background: C.wash }}
              >
                {manualOrder && (
                  <span
                    className="grab"
                    title="Drag to reorder"
                    style={{ width: 14, flexShrink: 0, color: C.faint2, fontSize: 12 }}
                  >
                    ⠿
                  </span>
                )}
                <CheckBox
                  checked={checked}
                  onClick={(e: any) => {
                    e.stopPropagation();
                    setSelected(s => (checked ? s.filter(x => x !== r.ref) : [...s, r.ref]));
                  }}
                />
                <span style={{
                  width: 104, flexShrink: 0, fontFamily: MONO, fontSize: 11, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
                }}>
                  <NoteDot notes={r.notes} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.ref}</span>
                </span>
                <span style={{
                  width: 52, flexShrink: 0, fontSize: 11.5, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {short(r.date)}
                </span>
                <span style={{ width: 52, flexShrink: 0, fontFamily: MONO, fontSize: 11, color: C.muted }}>
                  {r.resTime || '—'}
                </span>
                <span style={{
                  width: 58, flexShrink: 0, fontFamily: MONO, fontSize: 11.5, fontWeight: 600,
                  color: r.tourTime ? C.ink : C.bad,
                }}>
                  {r.tourTime || 'set'}
                </span>
                <span style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {productName(store.products, r)}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 9.5, color: '#a9b0ba', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tgTitleOf(store.products, r)}
                  </span>
                </span>
                {/* The grade decides capacity and how a booking may be grouped,
                    so it gets its own sortable column rather than living as a
                    prefix on the option title. */}
                <span style={{
                  width: 58, flexShrink: 0, fontFamily: MONO, fontSize: 11,
                  fontWeight: 600, color: C.accentInk,
                }}>
                  {r.tg}
                </span>
                <span style={{
                  width: 124, flexShrink: 0, display: 'flex', flexDirection: 'column', minWidth: 0,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.travelers[0]?.[0] ?? '—'}
                  </span>
                  {namesPending && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, letterSpacing: '.05em',
                      textTransform: 'uppercase', color: C.warn,
                    }}>
                      Names pending
                    </span>
                  )}
                </span>
                <span style={{
                  width: 38, flexShrink: 0, textAlign: 'center', fontSize: 11.5,
                  fontVariantNumeric: 'tabular-nums', color: C.body,
                }}>
                  {paxOf(r)}
                </span>
                <span style={{
                  width: 30, flexShrink: 0, textAlign: 'center', fontSize: 10,
                  fontWeight: 600, color: C.muted2,
                }}>
                  {r.lang}
                </span>
                <span style={{
                  width: 104, flexShrink: 0, fontSize: 11.5,
                  color: r.guide ? C.ink : C.bad, fontWeight: r.guide ? 500 : 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.guide || 'No guide'}
                </span>
                <span style={{ width: 78, flexShrink: 0 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5,
                    fontWeight: 600, padding: '2px 7px', borderRadius: 11,
                    background: sc.bg, color: sc.fg,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                    {r.status}
                  </span>
                </span>
                <span style={{ width: 88, flexShrink: 0, display: 'flex', gap: 2, justifyContent: 'center' }}>
                  {WF_STEPS.map((w, wi) => {
                    const on = !!r.wf[wi];
                    return (
                      <Hov
                        key={w.letter}
                        as="button"
                        type="button"
                        title={`${w.label} — ${on ? 'done' : 'not yet'}`}
                        onClick={(e: any) => { e.stopPropagation(); toggleWf(r, wi); }}
                        style={{
                          width: 15, height: 15, border: 0, padding: 0, borderRadius: 4,
                          background: on ? C.ink : '#f0f2f5', color: on ? '#fff' : '#b9bfc8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8.5, fontWeight: 700, cursor: 'pointer',
                        }}
                        hover={{ opacity: 0.78 }}
                      >
                        {w.letter}
                      </Hov>
                    );
                  })}
                </span>
                <span style={{
                  width: 70, flexShrink: 0, textAlign: 'right', fontFamily: MONO,
                  fontSize: 11.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                  color: showMoney ? C.ink : C.faint2,
                }}>
                  {showMoney ? eur(r.gross) : '•••'}
                </span>
              </Hov>
            );
          })}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '9px 13px', fontSize: 11.5, color: C.muted, flexWrap: 'wrap',
        }}>
          <span>
            <RollingNumber value={filtered.length} /> of{' '}
            <RollingNumber value={store.bookings.length} /> bookings ·{' '}
            <RollingNumber value={filtered.reduce((n, x) => n + paxOf(x), 0)} /> passengers
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, color: C.faint }}>
              Page {safePage + 1} of {pageCount}
            </span>
            <Btn small disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              Previous
            </Btn>
            <Btn
              small
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Btn>
          </span>
        </div>
      </Section>

      {/* ── bulk tour time ── */}
      <Modal open={timeAsk !== null} onClose={() => setTimeAsk(null)} width={340}>
        <ModalHead
          title="Set the tour time"
          sub={`Applies to ${selected.length} selected booking${selected.length === 1 ? '' : 's'} and any group they sit in.`}
          onClose={() => setTimeAsk(null)}
        />
        <div style={{ padding: '4px 16px 14px' }}>
          <Input
            type="time"
            value={timeAsk ?? ''}
            onChange={(e: any) => setTimeAsk(e.target.value)}
            style={{ height: 36, fontSize: 14 }}
          />
        </div>
        <ModalFoot>
          <Btn onClick={() => setTimeAsk(null)}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (timeAsk) applyTourTime(selected, timeAsk);
              setTimeAsk(null);
            }}
          >
            Apply
          </Btn>
        </ModalFoot>
      </Modal>

      {/* ── drawer ── */}
      {openRef && (
        <BookingDrawer
          store={store}
          booking={drawerBooking}
          isNew={openRef === '__new__'}
          onClose={() => setOpenRef(null)}
          onSave={next => {
            const exists = store.bookings.some(b => b.ref === next.ref);
            const bookings = exists
              ? store.bookings.map(b => (b.ref === next.ref ? next : b))
              : [...store.bookings, next];
            commit({ bookings });
            toast(exists ? 'Booking saved' : 'Booking created');
            setOpenRef(exists ? next.ref : null);
          }}
          onDelete={ref => {
            setConfirm({
              title: 'Delete this booking?',
              body: `${ref} is removed from the shared database and from any group it sits in. This cannot be undone.`,
              confirmLabel: 'Delete',
              tone: 'danger',
              run: () => removeBookings([ref]),
            });
          }}
          onSyncGroups={next => {
            const bookings = syncBookingsToGroups(next, store.groups, store.groups);
            commit({ bookings });
          }}
        />
      )}
    </>
  );
}

const darkControl = {
  height: 24,
  border: '1px solid rgba(255,255,255,.18)',
  background: 'rgba(255,255,255,.06)',
  color: '#fff',
  borderRadius: 5,
  padding: '0 7px',
  fontSize: 11.5,
  fontWeight: 500,
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;

/** The phone rendering of one booking: same data, stacked instead of columnar. */
function BookingCard({
  b, index, checked, status, namesPending, tour, option, showMoney, flash,
  onOpen, onToggleSelect, onToggleWf,
}: {
  b: Booking; index: number; checked: boolean;
  status: { bg: string; fg: string }; namesPending: boolean;
  tour: string; option: string; showMoney: boolean;
  /** Briefly singled out because another screen sent the reader here for it. */
  flash?: boolean;
  onOpen: () => void; onToggleSelect: () => void; onToggleWf: (i: number) => void;
}) {
  return (
    <div
      id={`bk-${b.ref}`}
      className={`row up-sm${flash ? ' flash-row' : ''}`}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 13px',
        borderBottom: `1px solid ${C.lineFaint}`,
        background: checked ? C.accentWash : C.panel,
        animationDelay: delayOf(index),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckBox checked={checked} onClick={(e: any) => { e.stopPropagation(); onToggleSelect(); }} />
        <span
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e: any) => { if (e.key === 'Enter') onOpen(); }}
          style={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
        >
          <span style={{
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {tour}
          </span>
          <span style={{
            fontFamily: MONO, fontSize: 10, color: C.faint,
            display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
          }}>
            <NoteDot notes={b.notes} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {b.ref} · {b.tg} {option}
            </span>
          </span>
        </span>
        <span style={{
          flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5,
          fontWeight: 600, padding: '2px 7px', borderRadius: 11,
          background: status.bg, color: status.fg,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
          {b.status}
        </span>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
        fontSize: 11.5, color: C.body,
      }}>
        <span><strong style={{ fontWeight: 600 }}>{short(b.date)}</strong></span>
        <span style={{ fontFamily: MONO, color: C.muted }}>res {b.resTime || '—'}</span>
        <span style={{ fontFamily: MONO, fontWeight: 600, color: b.tourTime ? C.ink : C.bad }}>
          tour {b.tourTime || 'set'}
        </span>
        <span>{paxOf(b)} pax · {b.lang}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 120, fontSize: 11.5 }}>
          <span style={{ color: C.muted }}>Lead </span>
          {b.travelers[0]?.[0] ?? '—'}
          {namesPending && (
            <span style={{
              marginLeft: 6, fontSize: 9, fontWeight: 600, letterSpacing: '.05em',
              textTransform: 'uppercase', color: C.warn,
            }}>
              names pending
            </span>
          )}
        </span>
        <span style={{
          fontSize: 11.5, fontWeight: b.guide ? 500 : 600,
          color: b.guide ? C.ink : C.bad,
        }}>
          {b.guide || 'No guide'}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 12, fontWeight: 600,
          fontVariantNumeric: 'tabular-nums', color: showMoney ? C.ink : C.faint2,
        }}>
          {showMoney ? eur(b.gross) : '•••'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 5 }}>
        {WF_STEPS.map((w, wi) => {
          const on = !!b.wf[wi];
          return (
            <Hov
              key={w.letter}
              as="button"
              type="button"
              title={`${w.label} — ${on ? 'done' : 'not yet'}`}
              onClick={(e: any) => { e.stopPropagation(); onToggleWf(wi); }}
              style={{
                flex: 1, height: 26, border: 0, padding: 0, borderRadius: 5,
                background: on ? C.ink : '#f0f2f5', color: on ? '#fff' : '#b9bfc8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
              hover={{ opacity: 0.78 }}
            >
              {w.letter}
            </Hov>
          );
        })}
      </div>
    </div>
  );
}

function FilterField({
  label, children, style,
}: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckBox({ checked, onClick }: { checked: boolean; onClick: (e: any) => void }) {
  return (
    <Hov
      as="button"
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      style={{
        width: 14, height: 14, flexShrink: 0,
        border: `1px solid ${checked ? C.ink : '#cfd4dc'}`, borderRadius: 3,
        background: checked ? C.ink : C.panel, cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      hover={{ borderColor: C.accent }}
    >
      {checked && <Icon name="check" size={9} color="#fff" width={3} />}
    </Hov>
  );
}

function SortHead({
  children, w, flex, center, right, on, onClick,
}: {
  children: React.ReactNode; w?: number; flex?: boolean; center?: boolean;
  right?: boolean; on: boolean; onClick: () => void;
}) {
  return (
    <Hov
      as="span"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: any) => { if (e.key === 'Enter') onClick(); }}
      style={{
        width: w, flex: flex ? 1 : undefined, minWidth: flex ? 180 : undefined,
        flexShrink: w ? 0 : undefined, cursor: 'pointer',
        color: on ? C.ink : C.muted2,
        textAlign: center ? 'center' : right ? 'right' : 'left',
      }}
      hover={{ color: C.ink }}
    >
      {children}
    </Hov>
  );
}
