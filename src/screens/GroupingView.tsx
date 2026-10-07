import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Empty, Hov, Input, MONO, NoteDot, Section, SectionHead, Select, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { delayOf, eur, longDate, short, shiftTime, uid } from '../utils/dates';
import {
  autoGroup, capOf, isReviewed, moveTraveler, productName, rankedGuides,
  reviewCount, tgTitleOf, syncBookingsToGroups, travelerRows, ungroupedRows,
  type TravelerRow,
} from '../utils/selectors';
import { isPlaceholderName } from '../utils/viator';
import { canSeeMoney } from '../utils/access';
import { download, manifestCsv } from '../utils/exports';
import { RollingNumber } from '../ui/RollingNumber';
import { MOBILE_QUERY, useMediaQuery } from '../ui/useMediaQuery';
import { manifestBands } from '../utils/selectors';
import { rowPaint, type RowPaint } from '../utils/colors';
import type { Booking, TourGroup } from '../types';
import type { ViewProps } from './types';

/** An option nobody has coloured: the row keeps its plain alternating tint. */
const NO_PAINT: RowPaint = { background: '', hover: '', stripe: '' };
const NO_COLORS = ['', ''] as const;

export function GroupingView({ store, user, rangeValue, setConfirm }: ViewProps) {
  // Group pricing is a manager's decision, so the money column follows the same
  // rule as everywhere else: operations and guides never see it.
  const showMoney = canSeeMoney(user.role);
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overGroup, setOverGroup] = useState<string | null>(null);
  const [radarOpen, setRadarOpen] = useState(true);
  // A 1080px passenger table cannot be side-scrolled usefully on a phone, and
  // dragging is not a touch gesture here either — below 820px each passenger
  // becomes a card and moves between bands with a select instead.
  const compact = useMediaQuery(MOBILE_QUERY);

  const rows = useMemo(
    () => travelerRows(store.bookings, rangeValue),
    [store.bookings, rangeValue],
  );
  /* Bands resolve their own members against every booking, not just the ones
     dated inside the window. A band that holds a booking from the day either
     side used to drop that passenger without a word and count the band short. */
  const allRows = useMemo(() => travelerRows(store.bookings, null), [store.bookings]);
  const unassigned = useMemo(
    () => ungroupedRows(rows, store.groups, rangeValue),
    [rows, store.groups, rangeValue],
  );

  const bands = useMemo(
    () => store.groups
      .filter(g => g.date >= rangeValue[0] && g.date <= rangeValue[1])
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [store.groups, rangeValue],
  );

  const rowById = useMemo(() => {
    const m = new Map<string, TravelerRow>();
    for (const r of allRows) m.set(r.id, r);
    return m;
  }, [allRows]);

  /**
   * Which tint a reservation's rows carry. Consecutive reservations alternate,
   * so a four-passenger booking reads as one block of colour rather than four
   * unrelated lines — that is the whole point: group size at a glance.
   * Keyed on the order the refs appear, not on a hash, so neighbours always
   * differ.
   */
  const tintIndex = (list: { booking: { ref: string } }[]) => {
    const m = new Map<string, number>();
    let n = 0;
    for (const r of list) if (!m.has(r.booking.ref)) m.set(r.booking.ref, n++);
    return m;
  };

  /** The reservation price belongs to the booking, so it is printed once per
      booking rather than repeated against every traveller — repeating it reads
      as a per-head price and invites double counting. */
  const priceOnce = (list: { id: string; booking: { ref: string } }[]) => {
    const seen = new Set<string>();
    const show = new Set<string>();
    for (const r of list) {
      if (seen.has(r.booking.ref)) continue;
      seen.add(r.booking.ref);
      show.add(r.id);
    }
    return show;
  };

  /**
   * The colours an operator chose for a reservation's tour option. Colour is
   * held against the option rather than the booking so it is set once in Tour
   * setup and every reservation on that option follows — including ones
   * imported later, which is the whole point of colouring by tour.
   */
  const colorsFor = useMemo(() => {
    const m = new Map<string, readonly [string, string]>();
    for (const p of store.products) {
      for (const o of p.options) m.set(`${p.code}|${o.tg}`, [o.color, o.color2] as const);
    }
    return (b: Booking) => m.get(`${b.code}|${b.tg}`) ?? NO_COLORS;
  }, [store.products]);

  /**
   * Each reservation's turn among the bookings sharing its tour option on the
   * same day: 0, 1, 2, 3. This is what the second colour is for — consecutive
   * bookings of one option alternate between the two, so where one party ends
   * and the next begins is obvious at a glance.
   *
   * Counted per option and per day rather than across the whole list, because
   * that is the run of rows an operator is actually trying to separate; a
   * booking of a different tour is already a different colour.
   */
  const bookingTurn = (list: { booking: Booking }[]) => {
    const next = new Map<string, number>();
    const turn = new Map<string, number>();
    for (const r of list) {
      if (turn.has(r.booking.ref)) continue;
      const key = `${r.booking.date}|${r.booking.code}|${r.booking.tg}`;
      const n = next.get(key) ?? 0;
      turn.set(r.booking.ref, n);
      next.set(key, n + 1);
    }
    return turn;
  };

  /** Every traveller on a booking shares its colour, so a party reads as one block. */
  const paintRow = (b: Booking, turn: Map<string, number>): RowPaint => {
    const [c1, c2] = colorsFor(b);
    return c1 || c2 ? rowPaint(c1, c2, turn.get(b.ref) ?? 0) : NO_PAINT;
  };

  const queueTint = useMemo(() => tintIndex(unassigned), [unassigned]);
  const queueTurn = useMemo(() => bookingTurn(unassigned), [unassigned]);
  const queuePrice = useMemo(() => priceOnce(unassigned), [unassigned]);

  /* Every band a passenger can be sent to, plus the way back out. Used by the
     queue's "add to group" select and by the touch cards. */
  const groupOptions = useMemo(() => [
    { v: '', t: 'Not grouped' },
    ...bands.map((g, gi) => ({ v: g.id, t: `GRP ${gi + 1} · ${short(g.date)} ${g.time || '--:--'}` })),
  ], [bands]);

  /* ── writes ── */
  const applyGroups = (groups: TourGroup[]) => {
    const bookings = syncBookingsToGroups(store.bookings, groups, store.groups);
    commit({ groups, bookings });
  };

  const drop = (groupId: string | null) => {
    if (!dragId) return;
    applyGroups(moveTraveler(store.groups, dragId, groupId));
    setDragId(null);
    setOverGroup(null);
  };

  /**
   * Edit one band.
   *
   * Only the guide, the tour time and the membership are copied out onto the
   * bookings themselves. Every patch used to trigger that copy anyway, so
   * changing a note walked all 1151 bookings, rebuilt the array, and made
   * `commit` diff every row against the database — per keystroke. Nothing was
   * written, because nothing had changed; the work was pure waste, and it was
   * enough to be felt while typing.
   */
  const patchGroup = (id: string, patch: Partial<TourGroup>) => {
    const groups = store.groups.map(g => (g.id === id ? { ...g, ...patch } : g));
    const reachesBookings = 'guide' in patch || 'time' in patch || 'members' in patch;
    if (reachesBookings) applyGroups(groups);
    else commit({ groups });
  };

  const addGroup = () => {
    const first = store.products[0];
    const g: TourGroup = {
      id: uid('grp'),
      date: rangeValue[0],
      code: first?.code ?? '',
      tg: first?.options[0]?.tg ?? 'TG1',
      time: '09:00',
      ticketTime: '08:30',
      ticketStatus: 'Pending',
      guide: '',
      cap: first?.options[0]?.cap ?? 7,
      notes: '',
      members: [],
      tourName: first?.label ?? '',
    };
    applyGroups([...store.groups, g]);
    toast('Group added');
  };

  const runAutoGroup = () => {
    const { groups, placed } = autoGroup(store, rangeValue);
    if (!placed) {
      toast('Everyone in this period is already grouped.', 'warn');
      return;
    }
    applyGroups(groups);
    toast(`Auto-grouped ${placed} passenger${placed === 1 ? '' : 's'}`);
  };

  const exportManifest = () => {
    // One manifest per distinct service day in the period, concatenated.
    const days = [...new Set(bands.map(g => g.date))].sort();
    const rowsOut = days.flatMap(d => manifestBands(store, d));
    if (!rowsOut.length) {
      toast('Nothing to export — no band has both a time and a guide.', 'warn');
      return;
    }
    download(`sole-manifest-${rangeValue[0]}.csv`, manifestCsv(rowsOut));
    toast(`Manifest exported · ${days.length} day${days.length === 1 ? '' : 's'}`);
  };

  /* ── nominative gate radar ── */
  const radar = useMemo(() => store.bookings
    .filter(b =>
      b.date >= rangeValue[0] && b.date <= rangeValue[1] &&
      b.status !== 'Cancelled' && !b.namesLocked &&
      b.travelers.some(t => isPlaceholderName(t[0])))
    .slice(0, 6), [store.bookings, rangeValue]);

  return (
    <>
      <div data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.body, fontWeight: 500 }}>
          <RollingNumber value={bands.length} /> band{bands.length === 1 ? '' : 's'} ·{' '}
          <RollingNumber value={unassigned.length} /> passenger
          {unassigned.length === 1 ? '' : 's'} waiting
        </span>
        <div style={{ flex: 1 }} />
        <Btn icon="sparkles" onClick={runAutoGroup}>Auto-group</Btn>
        <Btn icon="plus" onClick={addGroup}>New group</Btn>
        <Btn variant="primary" icon="printer" style={{ padding: '6px 11px', fontSize: 12 }} onClick={exportManifest}>
          Export manifest
        </Btn>
      </div>

      {/* ── nominative gate radar ── */}
      {radarOpen && radar.length > 0 && (
        <section className="up-sm" style={{
          background: C.panel, border: `1px solid ${C.badLine}`, borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px',
            background: '#fdf4f6', borderBottom: '1px solid #f6dbe1',
          }}>
            <Icon name="info" size={13} color={C.bad} />
            <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: C.bad }}>
              Nominative gate radar
            </h2>
            <span style={{ fontSize: 11.5, color: '#a8566d' }}>
              {radar.length} booking{radar.length === 1 ? '' : 's'} still on placeholder names
            </span>
            <div style={{ flex: 1 }} />
            <Hov
              as="button"
              type="button"
              onClick={() => setRadarOpen(false)}
              style={{
                border: 0, background: 'transparent', fontSize: 11, fontWeight: 600,
                color: '#a8566d', cursor: 'pointer', padding: '2px 4px',
              }}
              hover={{ color: C.bad }}
            >
              Dismiss
            </Hov>
          </div>

          {radar.map(b => {
            const pending = b.travelers.filter(t => isPlaceholderName(t[0])).length;
            return (
              <Hov
                key={b.ref}
                as="div"
                className="row"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px',
                  borderBottom: '1px solid #f7f8fa',
                }}
                hover={{ background: C.wash }}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.accentInk }}>{b.ref}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{b.travelers[0]?.[0]}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: '.05em',
                      textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4,
                      background: C.warnBg, color: C.warn,
                    }}>
                      {short(b.date)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: C.muted2, lineHeight: 1.5, textWrap: 'pretty' }}>
                    {pending} of {b.travelers.length} passengers are still placeholders. Tickets are
                    issued in the passengers’ names, so these have to be collected first.
                  </span>
                </div>
              </Hov>
            );
          })}
        </section>
      )}

      {/* ── unassigned queue ── */}
      <Section
        onDragOver={(e: DragEvent) => e.preventDefault()}
        onDrop={() => drop(null)}
        style={{ borderColor: dragId ? C.accent : C.line }}
      >
        <SectionHead
          title="Not yet grouped"
          note={`${unassigned.length} passenger${unassigned.length === 1 ? '' : 's'}`}
        >
          <span style={{ fontSize: 10.5, color: C.muted }}>
            Drag a passenger into a band below
          </span>
        </SectionHead>

        {!unassigned.length && <Empty pad={22}>Everyone in this period is in a group.</Empty>}

        {unassigned.length > 0 && compact && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
            {unassigned.map((r, i) => (
              <PaxCard
                key={r.id}
                r={r}
                index={i}
                tour={productName(store.products, r.booking)}
                option={tgTitleOf(store.products, r.booking)}
                price={showMoney && queuePrice.has(r.id) ? eur(r.booking.gross) : undefined}
                currentGroup=""
                options={groupOptions}
                paint={paintRow(r.booking, queueTurn)}
                stranded={r.strandedIn}
                onMove={gid => applyGroups(moveTraveler(store.groups, r.id, gid || null))}
              />
            ))}
          </div>
        )}

        {unassigned.length > 0 && !compact && (
          <div data-r="scroll" style={{ overflowX: 'auto' }}>
            {unassigned.map((r, i) => {
              const even = (queueTint.get(r.booking.ref) ?? 0) % 2 === 0;
              const paint = paintRow(r.booking, queueTurn);
              return (
              <Hov
                key={r.id}
                as="div"
                className={`row ${dragId === r.id ? 'drag-ghost' : ''}`}
                draggable
                onDragStart={() => setDragId(r.id)}
                onDragEnd={() => { setDragId(null); setOverGroup(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, minWidth: 1150,
                  padding: '7px 14px', borderBottom: `1px solid ${C.lineFaint}`,
                  fontSize: 11.5, animationDelay: delayOf(i),
                  background: paint.background || (even ? C.bandA : C.bandB),
                }}
                hover={{ background: paint.hover || (even ? C.bandAHover : C.bandBHover) }}
              >
                {paint.stripe && <Stripe fill={paint.stripe} pad={7} lead={14} />}
                <span className="grab" style={{ width: 24, flexShrink: 0, color: '#c9ced7' }}>⠿</span>
                <span style={{
                  width: 96, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, color: C.muted,
                  display: 'flex', alignItems: 'center', gap: 5, minWidth: 0,
                }}>
                  {/* A note on a reservation usually says something that changes
                      how it is grouped — a wheelchair, a late arrival, a party
                      that must stay together — so it belongs here too. */}
                  <NoteDot notes={r.booking.notes} size={6} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.booking.ref}
                  </span>
                </span>
                <span style={{
                  width: 150, flexShrink: 0, fontWeight: 500, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {productName(store.products, r.booking)}
                </span>
                <span style={{ width: 52, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {short(r.booking.date)}
                </span>
                <span style={{
                  width: 46, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, color: C.muted,
                }}>
                  {r.booking.resTime || '—'}
                </span>
                <span style={{
                  flex: 1, minWidth: 120, fontWeight: 500, display: 'flex',
                  alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.name}
                  </span>
                  {isPlaceholderName(r.name) && <NameTag />}
                  {r.strandedIn && <StrandedTag group={r.strandedIn} />}
                </span>
                {/* Which option this reservation booked. The tour name alone is
                    not enough to group by: the same tour runs as a 24-seat
                    group and a 7-seat semi-private, and they cannot be mixed. */}
                <span style={{
                  width: 168, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 5,
                  minWidth: 0,
                }}>
                  <span style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 600,
                    color: C.accentInk, flexShrink: 0,
                  }}>
                    {r.booking.tg}
                  </span>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 10.5, color: C.muted,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {tgTitleOf(store.products, r.booking)}
                  </span>
                </span>
                {showMoney && (
                  <span style={{
                    width: 78, flexShrink: 0, textAlign: 'right', fontFamily: MONO,
                    fontSize: 10.5, fontWeight: 600,
                    color: queuePrice.has(r.id) ? C.ink : 'transparent',
                  }}>
                    {eur(r.booking.gross)}
                  </span>
                )}
                <span style={{ width: 48, flexShrink: 0, color: C.muted2 }}>{r.age}</span>
                <span style={{
                  width: 112, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, color: C.body,
                }}>
                  {r.booking.phone || '—'}
                </span>
                <Select
                  value=""
                  onChange={(e: any) => {
                    if (!e.target.value) return;
                    applyGroups(moveTraveler(store.groups, r.id, e.target.value));
                  }}
                  options={[
                    { v: '', t: 'Add to group…' },
                    ...bands.map((g, gi) => ({
                      v: g.id,
                      t: `GRP ${gi + 1} · ${short(g.date)} ${g.time}`,
                    })),
                  ]}
                  style={{
                    height: 22, width: 132, flexShrink: 0, fontSize: 11,
                    fontWeight: 600, color: C.accentInk, background: C.panel,
                  }}
                />
              </Hov>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── bands ── */}
      {!bands.length && (
        <Section>
          <Empty>
            No groups in this period yet. Use Auto-group to build them from the bookings, or add
            one by hand.
          </Empty>
        </Section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bands.map((g, gi) => {
          const members = g.members.map(m => rowById.get(m)).filter(Boolean) as TravelerRow[];
          const memberTint = tintIndex(members);
          const memberTurn = bookingTurn(members);
          const memberPrice = priceOnce(members);
          const over = overGroup === g.id;
          const full = members.length >= g.cap;
          const product = store.products.find(p => p.code === g.code);
          return (
            <Section
              key={g.id}
              className={`up ${over ? 'drop-live' : ''}`}
              style={{ animationDelay: delayOf(gi) }}
              onDragOver={(e: DragEvent) => { e.preventDefault(); setOverGroup(g.id); }}
              onDragLeave={() => setOverGroup(o => (o === g.id ? null : o))}
              onDrop={(e: DragEvent) => { e.preventDefault(); drop(g.id); }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px',
                borderBottom: `1px solid ${C.lineSoft}`, background: C.wash, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, background: C.ink, color: '#fff',
                  borderRadius: 4, padding: '2px 7px',
                }}>
                  G{gi + 1}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {product?.name || g.tourName || g.code || 'Unassigned tour'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
                  {g.tg} · {short(g.date)}
                </span>

                <div style={{ flex: 1 }} />

                <span style={{
                  fontSize: 11, fontWeight: 600, borderRadius: 11, padding: '1px 8px',
                  background: full ? C.badBg : C.goodBg, color: full ? C.bad : C.good,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {/* Capacity changes as passengers are dragged in and out, so
                      the fill counts rather than flickering to a new figure. */}
                  <RollingNumber value={members.length} animateOnMount={false} duration={380} />
                  /{g.cap}
                </span>

                <Hov
                  as="button"
                  type="button"
                  title="Delete group"
                  onClick={() => setConfirm({
                    title: 'Delete this group?',
                    body: 'Its passengers go back to the ungrouped queue and the bookings lose their assigned guide and tour time.',
                    confirmLabel: 'Delete group',
                    tone: 'danger',
                    run: () => applyGroups(store.groups.filter(x => x.id !== g.id)),
                  })}
                  style={{
                    width: 24, height: 24, border: `1px solid ${C.line}`, background: C.panel,
                    borderRadius: 5, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: C.faint, padding: 0,
                  }}
                  hover={{ borderColor: '#e0a3b3', color: C.bad }}
                >
                  <Icon name="trash" size={12} />
                </Hov>
              </div>

              <div data-r="fields" style={{
                display: 'flex', gap: 10, padding: '10px 14px', flexWrap: 'wrap',
                borderBottom: `1px solid ${C.lineSoft}`,
              }}>
                <BandField label="Tour">
                  <Select
                    value={g.code}
                    onChange={(e: any) => {
                      const p = store.products.find(x => x.code === e.target.value);
                      patchGroup(g.id, {
                        code: e.target.value,
                        tg: p?.options[0]?.tg ?? g.tg,
                        cap: p?.options[0]?.cap ?? g.cap,
                        tourName: p?.label ?? '',
                      });
                    }}
                    options={store.products.map(p => ({ v: p.code, t: p.name }))}
                    style={{ background: C.panel, width: 168 }}
                  />
                </BandField>

                <BandField label="Option">
                  <Select
                    value={g.tg}
                    onChange={(e: any) => patchGroup(g.id, {
                      tg: e.target.value,
                      cap: capOf(store.products, g.code, e.target.value),
                    })}
                    options={
                      product?.options.length
                        ? product.options.map(o => ({ v: o.tg, t: `${o.tg} · ${o.title}` }))
                        : [{ v: g.tg, t: g.tg }]
                    }
                    style={{ background: C.panel, width: 168 }}
                  />
                </BandField>

                <BandField label="Date">
                  <Input
                    type="date"
                    value={g.date}
                    onChange={(e: any) => patchGroup(g.id, { date: e.target.value })}
                    style={{ background: C.panel, width: 132 }}
                  />
                </BandField>

                <BandField label="Departs">
                  <Input
                    type="time"
                    value={g.time}
                    onChange={(e: any) => patchGroup(g.id, {
                      time: e.target.value,
                      ticketTime: e.target.value ? shiftTime(e.target.value, -30) : '',
                    })}
                    style={{ background: C.panel, width: 96 }}
                  />
                </BandField>

                <BandField label="Tickets">
                  <Input
                    type="time"
                    value={g.ticketTime}
                    onChange={(e: any) => patchGroup(g.id, { ticketTime: e.target.value })}
                    style={{ background: C.panel, width: 96 }}
                  />
                </BandField>

                <BandField label="Ticket status">
                  <Select
                    value={g.ticketStatus}
                    onChange={(e: any) => patchGroup(g.id, { ticketStatus: e.target.value })}
                    options={['Pending', 'Reserved', 'Issued', 'Not needed'].map(s => ({ v: s, t: s }))}
                    style={{ background: C.panel, width: 124 }}
                  />
                </BandField>

                <BandField label="Guide">
                  <Select
                    value={g.guide}
                    onChange={(e: any) => patchGroup(g.id, { guide: e.target.value })}
                    options={[
                      { v: '', t: 'No guide yet' },
                      /* Best available guide first — the person filling this band
                         wants the top of the list to be the obvious choice, and
                         the rating and any absence are spelled out so the order
                         explains itself. */
                      ...rankedGuides(store.guides).map(x => ({
                        v: x.name,
                        // A guide nobody has reviewed shows as unrated rather than
                        // as a five-star one — the 5 is only a placeholder.
                        t: `${x.name} · ${isReviewed(x)
                          ? `${x.rating}★ ×${reviewCount(x)}`
                          : 'no reviews'}${x.avail === 'Active' ? '' : ` (${x.avail})`}`,
                      })),
                      ...store.staff.map(x => ({ v: x.name, t: `${x.name} (staff)` })),
                    ]}
                    style={{ background: C.panel, width: 152 }}
                  />
                </BandField>

                <BandField label="Capacity">
                  <LiveText
                    type="number"
                    min={1}
                    value={String(g.cap)}
                    onCommit={v => patchGroup(g.id, { cap: Number(v) || 1 })}
                    style={{ background: C.panel, width: 74 }}
                  />
                </BandField>

                <BandField label="Notes" grow>
                  <LiveText
                    value={g.notes}
                    onCommit={v => patchGroup(g.id, { notes: v })}
                    placeholder="Meeting point, radios, anything the guide needs"
                    style={{ background: C.panel }}
                  />
                </BandField>
              </div>

              {!members.length && (
                <Empty pad={20}>
                  Empty band — drag passengers here, or run Auto-group.
                </Empty>
              )}

              {members.length > 0 && compact && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                  {members.map((m, mi) => (
                    <PaxCard
                      key={m.id}
                      r={m}
                      index={mi}
                      no={mi + 1}
                      tour={product?.name || g.tourName || g.code}
                      option={tgTitleOf(store.products, m.booking)}
                      price={showMoney && memberPrice.has(m.id) ? eur(m.booking.gross) : undefined}
                      guide={g.guide}
                      time={g.time}
                      currentGroup={g.id}
                      options={groupOptions}
                      paint={paintRow(m.booking, memberTurn)}
                      onMove={gid => applyGroups(moveTraveler(store.groups, m.id, gid || null))}
                    />
                  ))}
                </div>
              )}

              {members.length > 0 && !compact && (
                <div data-r="scroll" style={{ overflowX: 'auto' }}>
                  <div style={{ minWidth: 1080 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, height: 30, padding: '0 14px',
                      borderBottom: `1px solid ${C.line}`, background: C.wash, fontSize: 9.5,
                      fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase',
                      color: C.muted2,
                    }}>
                      <span style={{ width: 34, flexShrink: 0 }}>Grp</span>
                      <span style={{ width: 26, flexShrink: 0 }}>No</span>
                      <span style={{ width: 96, flexShrink: 0 }}>Reference</span>
                      <span style={{ width: 52, flexShrink: 0 }}>Date</span>
                      <span style={{ width: 46, flexShrink: 0 }}>Res.</span>
                      <span style={{ width: 46, flexShrink: 0 }}>Time</span>
                      <span style={{ flex: 1, minWidth: 150 }}>Name &amp; last name</span>
                      {showMoney && (
                        <span style={{ width: 78, flexShrink: 0, textAlign: 'right' }}>Price</span>
                      )}
                      <span style={{ width: 48, flexShrink: 0 }}>Age</span>
                      <span style={{ width: 112, flexShrink: 0 }}>Telephone</span>
                      <span style={{ width: 30, flexShrink: 0, textAlign: 'center' }}>Lng</span>
                      <span style={{ width: 104, flexShrink: 0 }}>Guide</span>
                    </div>

                    {members.map((m, mi) => {
                      const even = (memberTint.get(m.booking.ref) ?? 0) % 2 === 0;
                      const paint = paintRow(m.booking, memberTurn);
                      return (
                      <Hov
                        key={m.id}
                        as="div"
                        className={`row ${dragId === m.id ? 'drag-ghost' : ''}`}
                        draggable
                        onDragStart={() => setDragId(m.id)}
                        onDragEnd={() => { setDragId(null); setOverGroup(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px',
                          borderBottom: `1px solid ${C.lineFaint}`, fontSize: 11.5,
                          background: paint.background || (even ? C.bandA : C.bandB),
                        }}
                        hover={{ background: paint.hover || (even ? C.bandAHover : C.bandBHover) }}
                      >
                        {paint.stripe && <Stripe fill={paint.stripe} pad={6} lead={14} />}
                        <span className="grab" style={{ width: 34, flexShrink: 0, color: '#c9ced7' }}>⠿</span>
                        <span style={{
                          width: 26, flexShrink: 0, fontFamily: MONO, fontSize: 10.5,
                          color: C.faint, fontVariantNumeric: 'tabular-nums',
                        }}>
                          {mi + 1}
                        </span>
                        <span style={{
                          width: 96, flexShrink: 0, fontFamily: MONO, fontSize: 10.5,
                          color: m.idx === 0 ? C.accentInk : C.muted,
                        }}>
                          {m.booking.ref}
                        </span>
                        <span style={{
                          width: 52, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: C.body,
                        }}>
                          {short(m.booking.date)}
                        </span>
                        <span style={{
                          width: 46, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, color: C.muted,
                        }}>
                          {m.booking.resTime || '—'}
                        </span>
                        <span style={{
                          width: 46, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, fontWeight: 600,
                        }}>
                          {g.time || '—'}
                        </span>
                        <span style={{
                          flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{
                            fontWeight: 500, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {m.name}
                          </span>
                          {isPlaceholderName(m.name) && <NameTag />}
                        </span>
                        {showMoney && (
                          <span style={{
                            width: 78, flexShrink: 0, textAlign: 'right', fontFamily: MONO,
                            fontSize: 10.5, fontWeight: 600,
                            color: memberPrice.has(m.id) ? C.ink : 'transparent',
                          }}>
                            {eur(m.booking.gross)}
                          </span>
                        )}
                        <span style={{ width: 48, flexShrink: 0, color: C.muted2 }}>{m.age}</span>
                        <span style={{
                          width: 112, flexShrink: 0, fontFamily: MONO, fontSize: 10.5, color: C.body,
                        }}>
                          {m.booking.phone || '—'}
                        </span>
                        <span style={{
                          width: 30, flexShrink: 0, textAlign: 'center', fontSize: 10,
                          fontWeight: 600, color: C.muted2,
                        }}>
                          {m.booking.lang}
                        </span>
                        <span style={{
                          width: 104, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 11, color: C.muted,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {g.guide || '—'}
                          </span>
                          <Hov
                            as="button"
                            type="button"
                            title="Remove from this group"
                            onClick={() => applyGroups(moveTraveler(store.groups, m.id, null))}
                            style={{
                              width: 19, height: 19, flexShrink: 0, border: `1px solid ${C.line}`,
                              background: C.panel, borderRadius: 5, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                              color: C.body, padding: 0,
                            }}
                            hover={{ borderColor: '#e0a3b3', color: C.bad }}
                          >
                            <Icon name="x" size={10} width={2.6} />
                          </Hov>
                        </span>
                      </Hov>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          );
        })}
      </div>
    </>
  );
}

/**
 * One passenger as a stacked card, for touch. The same record the wide table
 * shows in a row — reference, date, tour, phone — reflowed into three lines,
 * with the band picker doing the job drag-and-drop does on a laptop.
 */
/**
 * A text field that keeps hold of what is being typed into it.
 *
 * The band fields used to write to the store on every keystroke, and each write
 * went straight out to Supabase. Every character therefore produced an upsert, a
 * realtime notification, and a refetch of the whole table — and when that
 * refetch landed, `value` was replaced by whatever the server had last
 * confirmed, which was a character or two behind the person typing. The caret
 * jumped, letters reappeared after being deleted, and words rewrote themselves.
 * That is the glitch operations reported.
 *
 * So the field owns its text while it has the caret, and reports upward only
 * once the typing pauses or the field is left. A note becomes one write instead
 * of forty, and nothing arriving from the network can overwrite a half-typed
 * word: updates from elsewhere are adopted only when this field is not being
 * edited.
 */
function LiveText({
  value, onCommit, delay = 500, ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  delay?: number;
  [k: string]: any;
}) {
  const [text, setText] = useState(value);
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Someone else's edit, or a reload — but never over the top of live typing.
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);

  // A pending keystroke must not fire after the field has gone.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const stop = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const send = (v: string) => {
    stop();
    if (v !== value) onCommit(v);
  };

  return (
    <Input
      {...rest}
      value={text}
      onFocus={() => { editing.current = true; }}
      onChange={(e: any) => {
        const v = e.target.value;
        setText(v);
        stop();
        timer.current = setTimeout(() => send(v), delay);
      }}
      onBlur={() => {
        editing.current = false;
        // Leaving the field saves immediately rather than waiting out the pause.
        send(text);
      }}
    />
  );
}

/**
 * The full-strength colour, down the leading edge of a row.
 *
 * The wash behind the text has to be diluted to stay readable, which costs it
 * exactly the vividness that makes colours quick to match. This puts the colour
 * back undiluted in a place where nothing has to be read through it. The
 * negative margins let it bleed into the row's own padding so it reads as an
 * edge rather than a floating bar.
 */
function Stripe({ fill, pad, lead }: { fill: string; pad: number; lead: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: 4, alignSelf: 'stretch', flexShrink: 0, background: fill,
        margin: `-${pad}px 0 -${pad}px -${lead}px`,
      }}
    />
  );
}

function PaxCard({
  r, index, no, tour, option, guide, time, price, currentGroup, options, onMove, paint,
  stranded,
}: {
  r: TravelerRow;
  index: number;
  no?: number;
  tour: string;
  /** Tour option title; the grade code is read off the booking. */
  option?: string;
  guide?: string;
  time?: string;
  /** Shown once per reservation, and only to roles that may see money. */
  price?: string;
  currentGroup: string;
  options: { v: string; t: string }[];
  onMove: (groupId: string) => void;
  /** The tour option's colour, so a phone reads the same as a desktop. */
  paint?: RowPaint;
  /** Set when a band that is off-screen already holds this passenger. */
  stranded?: TourGroup;
}) {
  const stripe = paint?.stripe;
  return (
    <div
      className="up-sm"
      style={{
        border: `1px solid ${C.line}`, borderRadius: 7,
        background: paint?.background || C.panel,
        // Room for the stripe, which is laid over the padding rather than
        // pushed into the flow so the card's text keeps its alignment.
        padding: stripe ? '9px 11px 9px 16px' : '9px 11px',
        display: 'flex', flexDirection: 'column', gap: 7,
        animationDelay: delayOf(index),
        position: 'relative', overflow: 'hidden',
      }}
    >
      {stripe && (
        <span aria-hidden style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: stripe,
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        {no !== undefined && (
          <span style={{
            fontFamily: MONO, fontSize: 10.5, color: C.faint,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>
            {no}
          </span>
        )}
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {r.name}
        </span>
        {isPlaceholderName(r.name) && <NameTag />}
        {stranded && <StrandedTag group={stranded} />}
        {price && (
          <span style={{
            flexShrink: 0, fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.ink,
          }}>
            {price}
          </span>
        )}
        <span style={{
          flexShrink: 0, fontSize: 9.5, fontWeight: 700,
          color: r.age === 'Child' ? C.warn : C.body,
          background: r.age === 'Child' ? C.warnBg : C.paper,
          borderRadius: 4, padding: '1px 6px',
        }}>
          {r.age}
        </span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontSize: 11, color: C.muted2,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.accentInk }}>{r.booking.ref}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{short(r.booking.date)}</span>
        {time
          ? <span style={{ fontFamily: MONO, fontWeight: 600, color: C.ink }}>{time}</span>
          : r.booking.resTime && <span style={{ fontFamily: MONO }}>res {r.booking.resTime}</span>}
        <span style={{ fontSize: 10, fontWeight: 600 }}>{r.booking.lang}</span>
        {r.booking.phone && (
          <span style={{ fontFamily: MONO, fontSize: 10.5 }}>{r.booking.phone}</span>
        )}
      </div>

      <div style={{
        fontSize: 11.5, color: C.body,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {tour}
        {option && (
          <span style={{ color: C.muted }}>
            {' · '}
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.accentInk }}>{r.booking.tg}</span>
            {' '}{option}
          </span>
        )}
        {guide && <span style={{ color: C.muted }}> · {guide}</span>}
      </div>

      <Select
        value={currentGroup}
        onChange={(e: any) => onMove(e.target.value)}
        options={options}
        style={{ background: C.panel, width: '100%', fontSize: 11.5, fontWeight: 600 }}
      />
    </div>
  );
}

/** Tickets are issued in passenger names, so a placeholder has to be loud. */
/**
 * A passenger the queue is showing even though a band already holds them,
 * because that band is not on screen. Naming the day is the whole point:
 * without it the row reads as ungrouped, and moving it would look like losing
 * an arrangement rather than correcting one.
 */
function StrandedTag({ group }: { group: TourGroup }) {
  return (
    <span
      title={`Currently in a group on ${longDate(group.date)}`
        + `${group.guide ? ` with ${group.guide}` : ''}. Drag it into the right band to move it.`}
      style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase',
        padding: '1px 6px', borderRadius: 4, background: C.warnBg, color: C.warn,
        border: '1px solid #f0dbb3', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      in {short(group.date)} group
    </span>
  );
}

function NameTag() {
  return (
    <span style={{
      flexShrink: 0, fontSize: 9, fontWeight: 600, letterSpacing: '.05em',
      textTransform: 'uppercase', color: C.warn, background: C.warnBg,
      borderRadius: 4, padding: '1px 5px',
    }}>
      name?
    </span>
  );
}

function BandField({
  label, children, grow,
}: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: grow ? 1 : undefined, minWidth: grow ? 200 : undefined,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}
