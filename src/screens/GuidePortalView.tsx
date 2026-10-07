import { useMemo, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Card, Empty, Hov, Label, MONO, Section, SectionHead, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { addDays, delayOf, longDate, minutesOf, short, today } from '../utils/dates';
import { manifestBands, paxOf, productName, tgTitleOf } from '../utils/selectors';
import { copyText, download, manifestPdf, manifestText } from '../utils/exports';
import { RollingNumber } from '../ui/RollingNumber';
import type { ViewProps } from './types';

/**
 * What a guide sees. Deliberately narrow: their own departures, the passengers
 * on each one, and a check-in tap. No revenue, no other guides' work, no
 * catalogue editing.
 */
export function GuidePortalView({ store, user }: ViewProps) {
  const toast = useToast();
  const t = today();
  const [day, setDay] = useState(t);
  const [busy, setBusy] = useState(false);

  const mine = useMemo(
    () => store.bookings.filter(b => b.guide === user.name && b.status !== 'Cancelled'),
    [store.bookings, user.name],
  );

  const todays = useMemo(
    () => mine.filter(b => b.date === day)
      .sort((a, b) => (a.tourTime || a.resTime).localeCompare(b.tourTime || b.resTime)),
    [mine, day],
  );

  const upcoming = useMemo(
    () => mine.filter(b => b.date > t).sort((a, b) => a.date.localeCompare(b.date)),
    [mine, t],
  );

  const bands = useMemo(
    () => manifestBands(store, day, user.name),
    [store, day, user.name],
  );

  const nowHM = new Date().getHours() * 60 + new Date().getMinutes();
  const dayPax = todays.reduce((n, b) => n + paxOf(b), 0);

  const toggleCheckIn = (ref: string, index: number) => {
    commit({
      bookings: store.bookings.map(b => {
        if (b.ref !== ref) return b;
        const has = b.checkedIn.includes(index);
        return {
          ...b,
          checkedIn: has ? b.checkedIn.filter(i => i !== index) : [...b.checkedIn, index],
        };
      }),
    });
  };

  const savePdf = async () => {
    setBusy(true);
    try {
      const blob = await manifestPdf(bands, day);
      download(`my-manifest-${day}.pdf`, blob, 'application/pdf');
      toast('Manifest saved');
    } catch (e) {
      toast((e as Error).message || 'Could not build the PDF', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div data-r="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <Card style={{ padding: '13px 15px' }}>
          <Label style={{ display: 'block', marginBottom: 9 }}>Selected day</Label>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em' }}>
            {longDate(day)}
          </span>
          <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: C.muted }}>
            <RollingNumber value={todays.length} /> departure{todays.length === 1 ? '' : 's'} ·{' '}
            <RollingNumber value={dayPax} /> passenger{dayPax === 1 ? '' : 's'}
          </span>
        </Card>

        <Card style={{ padding: '13px 15px' }}>
          <Label style={{ display: 'block', marginBottom: 9 }}>Coming up</Label>
          <RollingNumber
            value={upcoming.length}
            style={{ fontSize: 25, fontWeight: 600, lineHeight: 1 }}
          />
          <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: C.muted }}>
            {upcoming[0] ? `next on ${short(upcoming[0].date)}` : 'nothing scheduled'}
          </span>
        </Card>

        <Card style={{ padding: '13px 15px' }}>
          <Label style={{ display: 'block', marginBottom: 9 }}>Signed in as</Label>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{user.name}</span>
          <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: C.muted }}>
            {user.roleLabel} · you only see your own tours
          </span>
        </Card>
      </div>

      <div data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon="chevronLeft" onClick={() => setDay(d => addDays(d, -1))} style={{ padding: '5px 9px' }}>
          Previous day
        </Btn>
        <Btn onClick={() => setDay(t)}>Today</Btn>
        <Btn onClick={() => setDay(d => addDays(d, 1))} style={{ padding: '5px 9px' }}>
          Next day ›
        </Btn>
        <div style={{ flex: 1 }} />
        <Btn
          icon="copy"
          onClick={() => {
            void copyText(manifestText(bands, day)).then(ok =>
              toast(ok ? 'Runsheet copied' : 'Copy was blocked', ok ? 'ok' : 'bad'));
          }}
        >
          Copy runsheet
        </Btn>
        <Btn icon={busy ? 'spinner' : 'fileText'} onClick={savePdf} disabled={busy || !bands.length}>
          {busy ? 'Building…' : 'PDF'}
        </Btn>
      </div>

      {!todays.length && (
        <Section>
          <Empty pad={44}>
            Nothing assigned to you on {longDate(day)}. Check another day, or ask operations to
            put you on a group.
          </Empty>
        </Section>
      )}

      {todays.map((b, i) => {
        const tm = b.tourTime || b.resTime;
        const mins = minutesOf(tm);
        const isToday = b.date === t;
        const done = isToday && mins + 150 < nowHM;
        const live = isToday && !done && mins <= nowHM;
        const checked = b.checkedIn.length;

        return (
          <Section key={b.ref} className="up" style={{ animationDelay: delayOf(i) }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '12px 15px',
              borderBottom: `1px solid ${C.lineSoft}`,
              background: live ? C.accentWash : C.wash, flexWrap: 'wrap',
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 16, fontWeight: 600, letterSpacing: '-.02em',
              }}>
                {tm || '—'}
              </span>
              {live && (
                <span className="blink" style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: C.accentInk,
                  background: '#fdefd9', borderRadius: 4, padding: '2px 6px',
                }}>
                  Now
                </span>
              )}
              {done && (
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: C.faint,
                }}>
                  Done
                </span>
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {productName(store.products, b)}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>
                  {b.tg} · {tgTitleOf(store.products, b)}
                </div>
              </div>

              <div style={{ flex: 1 }} />

              <span style={{
                fontSize: 11, fontWeight: 600, borderRadius: 11, padding: '2px 9px',
                background: checked === paxOf(b) ? C.goodBg : C.paper,
                color: checked === paxOf(b) ? C.good : C.body,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {/* Counts up as the guide taps each passenger in. */}
                <RollingNumber value={checked} animateOnMount={false} duration={320} />
                /{paxOf(b)} checked in
              </span>

              {b.phone && (
                <Btn
                  small
                  icon="message"
                  onClick={() => window.open(
                    `https://wa.me/${b.phone.replace(/\D/g, '')}`, '_blank', 'noopener')}
                >
                  Lead
                </Btn>
              )}
            </div>

            <div style={{ padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {b.travelers.map((tv, idx) => {
                const on = b.checkedIn.includes(idx);
                return (
                  <Hov
                    key={idx}
                    as="button"
                    type="button"
                    onClick={() => toggleCheckIn(b.ref, idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      border: `1px solid ${on ? '#cfe4d9' : C.lineSoft}`,
                      background: on ? '#f4faf7' : C.panel, borderRadius: 7,
                      padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                    }}
                    hover={{ borderColor: on ? '#9fd0ba' : '#c9ced7' }}
                  >
                    <span style={{
                      width: 18, height: 18, flexShrink: 0, borderRadius: 5,
                      border: `1px solid ${on ? C.good : '#cfd4dc'}`,
                      background: on ? C.good : C.panel,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on && <Icon name="check" size={11} color="#fff" width={3} />}
                    </span>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 12.5,
                      fontWeight: idx === 0 ? 600 : 500,
                      textDecoration: on ? 'none' : 'none',
                      color: on ? C.good : C.ink,
                    }}>
                      {tv[0]}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 6px',
                      background: tv[1] === 'Child' ? C.warnBg : C.paper,
                      color: tv[1] === 'Child' ? C.warn : C.muted2,
                    }}>
                      {tv[1]}
                    </span>
                    {idx === 0 && (
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.muted }}>
                        {b.phone}
                      </span>
                    )}
                  </Hov>
                );
              })}

              {b.notes && (
                <p style={{
                  margin: '6px 0 0', fontSize: 11.5, color: '#3f4756', lineHeight: 1.55,
                  background: C.accentWash, border: '1px solid #f6e2c4', borderRadius: 7,
                  padding: '8px 10px', textWrap: 'pretty',
                }}>
                  {b.notes}
                </p>
              )}
            </div>
          </Section>
        );
      })}

      {upcoming.length > 0 && (
        <Section>
          <SectionHead title="Your next tours" note={`${upcoming.length}`} />
          {upcoming.slice(0, 10).map(b => (
            <Hov
              key={b.ref}
              as="div"
              className="row"
              role="button"
              tabIndex={0}
              onClick={() => setDay(b.date)}
              onKeyDown={(e: any) => { if (e.key === 'Enter') setDay(b.date); }}
              data-r="listrow"
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px',
                borderBottom: `1px solid ${C.lineFaint}`, cursor: 'pointer',
              }}
              hover={{ background: C.wash }}
            >
              <span style={{
                width: 52, flexShrink: 0, fontSize: 11.5, fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {short(b.date)}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, width: 46, flexShrink: 0 }}>
                {b.tourTime || b.resTime || '—'}
              </span>
              <span data-grow style={{
                flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {productName(store.products, b)}
              </span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
                {paxOf(b)} pax · {b.travelers[0]?.[0] ?? ''}
              </span>
            </Hov>
          ))}
        </Section>
      )}
    </>
  );
}
