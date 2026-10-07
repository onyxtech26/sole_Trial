import { useMemo, useState } from 'react';
import { C, Btn, Empty, Hov, Input, MONO, useToast } from '../ui/kit';
import { addDays, longDate, today } from '../utils/dates';
import { manifestBands } from '../utils/selectors';
import { download, manifestCsv, manifestPdf, manifestText, copyText } from '../utils/exports';
import { RollingNumber } from '../ui/RollingNumber';
import type { ViewProps } from './types';
import { COMPANY } from '../lib/config';

export function ManifestsView({ store, user, onGo }: ViewProps) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  // A guide only ever sees their own runsheet.
  const guideFilter = user.role === 'guide' ? user.name : undefined;

  const bands = useMemo(
    () => manifestBands(store, date, guideFilter),
    [store, date, guideFilter],
  );

  const dayBookings = store.bookings.filter(b => b.date === date && b.status !== 'Cancelled');
  const totalPax = bands.reduce((n, g) => n + g.pax, 0);

  /* Passengers on this date who are not printed on any band above. Counted by
     what actually reached the runsheet rather than by guide/time, so this and
     the bands can never disagree. */
  const ungroupedPax = useMemo(() => {
    const total = dayBookings.reduce((n, b) => n + b.travelers.length, 0);
    const onSheet = bands.reduce((n, g) => n + g.rows.length, 0);
    return Math.max(0, total - onSheet);
  }, [dayBookings, bands]);

  /* Stamped when the sheet is rendered, which is what "generated" means on a
     printed copy. Recomputed when the day or its data changes, not per render. */
  const printedOn = useMemo(
    () => new Date().toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),
    [date, bands],
  );

  const savePdf = async () => {
    setBusy(true);
    try {
      const blob = await manifestPdf(bands, date);
      download(`sole-manifest-${date}.pdf`, blob, 'application/pdf');
      toast('Manifest PDF saved');
    } catch (e) {
      toast((e as Error).message || 'Could not build the PDF', 'bad');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div data-print="hide" data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon="chevronLeft" onClick={() => setDate(d => addDays(d, -1))} style={{ padding: '5px 9px' }}>
          Previous
        </Btn>
        <Input
          type="date"
          value={date}
          onChange={(e: any) => setDate(e.target.value)}
          style={{ width: 150, background: C.panel }}
        />
        <Btn onClick={() => setDate(d => addDays(d, 1))} style={{ padding: '5px 9px' }}>
          Next<span style={{ marginLeft: 2 }}>›</span>
        </Btn>
        <Btn onClick={() => setDate(today())}>Today</Btn>

        <span style={{ fontSize: 12, color: C.body, fontWeight: 500, marginLeft: 4 }}>
          <RollingNumber value={bands.length} /> group{bands.length === 1 ? '' : 's'} ·{' '}
          <RollingNumber value={totalPax} /> passenger{totalPax === 1 ? '' : 's'}
          {dayBookings.length > 0 && (
            <>
              {' · '}
              <RollingNumber value={dayBookings.length} /> booking
              {dayBookings.length === 1 ? '' : 's'} that day
            </>
          )}
        </span>

        {ungroupedPax > 0 && !guideFilter && (
          <Hov
            as="button"
            type="button"
            onClick={() => onGo('groups')}
            style={{
              fontSize: 11.5, fontWeight: 600, color: C.bad, background: C.badBg,
              border: `1px solid ${C.badLine}`, borderRadius: 5, padding: '4px 9px',
              cursor: 'pointer',
            }}
            hover={{ borderColor: '#e0a3b3' }}
          >
            {ungroupedPax} pax not yet grouped
          </Hov>
        )}

        <div style={{ flex: 1 }} />

        <Btn
          icon="copy"
          onClick={() => {
            void copyText(manifestText(bands, date)).then(ok =>
              toast(ok ? 'Manifest copied as text' : 'Copy was blocked by the browser', ok ? 'ok' : 'bad'));
          }}
        >
          Copy text
        </Btn>
        <Btn
          icon="download"
          onClick={() => {
            download(`sole-manifest-${date}.csv`, manifestCsv(bands));
            toast('CSV saved');
          }}
        >
          CSV
        </Btn>
        <Btn icon={busy ? 'spinner' : 'fileText'} onClick={savePdf} disabled={busy}>
          {busy ? 'Building…' : 'PDF'}
        </Btn>
        <Btn variant="primary" icon="printer" style={{ padding: '6px 11px', fontSize: 12 }} onClick={() => window.print()}>
          Print
        </Btn>
      </div>

      <section data-r="doc" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: '30px 32px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
          borderBottom: `1.5px solid ${C.ink}`, paddingBottom: 15, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* The brand lockup is drawn rather than loaded: the wordmark PNG is
                1212px wide and was being scaled to 18px, which prints soft and
                fails the whole header if the request does not land. The mark is
                a small icon and degrades to nothing if it is missing, so the
                name always survives. */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src="/logo-mark.png"
                alt=""
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                style={{ height: 22, width: 'auto', display: 'block' }}
              />
              <span style={{
                fontSize: 17, fontWeight: 700, letterSpacing: '.18em', lineHeight: 1,
              }}>
                SOLE
              </span>
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-.01em' }}>
              {COMPANY} — Daily Manifest
            </span>
          </div>
          <div style={{
            textAlign: 'right', fontSize: 11.5, color: C.body,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span><strong style={{ color: C.ink }}>Manifest date</strong> · {longDate(date)}</span>
            <span><strong style={{ color: C.ink }}>Generated</strong> · {printedOn}</span>
          </div>
        </div>

        {/* Two figures, not four. "Not grouped" and "Guides on duty" were
            dropped at the client's request: the guide holding the sheet knows
            who is on duty, and ungrouped passengers describe work that belongs
            back in the app rather than on a runsheet. The ungrouped count still
            appears as the toolbar's warning button, where it is actionable. */}
        <div data-r="g2" style={{
          display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, margin: '18px 0 20px',
        }}>
          <Stat label="Tours" value={String(bands.length)} />
          <Stat label="Passengers" value={String(totalPax)} />
        </div>

        {!bands.length && (
          <Empty pad={40}>
            {guideFilter
              ? 'You have no grouped departures on this day.'
              : 'No grouped departures on this day. A band needs both a tour time and a guide before it appears on the manifest.'}
          </Empty>
        )}

        {bands.map(g => (
          <div key={`${g.no}-${g.time}-${g.guide}`} className="up" style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: C.ink, color: '#fff', padding: '7px 12px', borderRadius: '5px 5px 0 0',
            }}>
              <span style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 600,
                background: 'rgba(253,151,7,.2)', color: '#fdb44e',
                borderRadius: 4, padding: '1px 6px',
              }}>
                GRP {g.no}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.tour}</span>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.85)' }}>
                {g.tg} · {g.tgTitle}
              </span>
              <div style={{ flex: 1 }} />
              {/* Both times carry their own label. Unlabelled they read as one
                  time printed twice — and on a group whose entry and departure
                  happen to match, that is exactly what it looked like. Entry
                  comes first because it is the earlier deadline. */}
              {g.ticketTime && (
                <>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>ticket time</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>
                    {g.ticketTime}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>·</span>
                </>
              )}
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.8)' }}>tour</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{g.time}</span>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>·</span>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>{g.guide}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: '#fdb44e' }}>{g.guidePhone}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#fff',
                background: 'rgba(255,255,255,.18)', borderRadius: 4, padding: '1px 6px',
              }}>
                {g.fill}
              </span>
            </div>

            {/* What operations wrote for the guide. It sits directly under the
                band header, above the passengers, because it is an instruction
                about the whole group — "First Roman Forum then Colosseum" is
                useless printed after the names. */}
            {g.notes && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 12px', background: C.warnBg,
                borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`,
                borderBottom: `1px solid ${C.line}`,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '.07em',
                  textTransform: 'uppercase', color: C.warn, flexShrink: 0, marginTop: 1,
                }}>
                  Note
                </span>
                <span style={{
                  fontSize: 11.5, color: '#6b4a10', lineHeight: 1.5,
                  fontWeight: 500, textWrap: 'pretty',
                }}>
                  {g.notes}
                </span>
              </div>
            )}

            <div data-r="scroll" style={{
              overflowX: 'auto', border: `1px solid ${C.line}`, borderTop: 0,
              borderRadius: '0 0 5px 5px',
            }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 660,
              }}>
                <thead>
                  <tr style={{ background: C.paper }}>
                    {['No', 'Reference', 'Name', 'Age', 'Role', 'Phone', 'Lang'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 12px',
                        borderBottom: `1px solid ${C.line}`, fontSize: 9, fontWeight: 600,
                        letterSpacing: '.07em', textTransform: 'uppercase', color: C.muted2,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map(r => (
                    <Hov
                      as="tr"
                      key={`${r.ref}-${r.no}`}
                      style={{ borderBottom: `1px solid ${C.lineFaint}` }}
                      hover={{ background: C.wash }}
                    >
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 10.5, color: C.faint }}>{r.no}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 10.5, color: C.body }}>{r.ref}</td>
                      <td style={{ ...cell, fontWeight: 500 }}>{r.name}</td>
                      <td style={{ ...cell, color: C.muted2 }}>{r.age}</td>
                      <td style={{ ...cell, color: C.muted2 }}>{r.role}</td>
                      <td style={{ ...cell, fontFamily: MONO, fontSize: 10.5, color: C.body }}>
                        {r.phone || '—'}
                      </td>
                      <td style={{ ...cell, fontSize: 10, fontWeight: 600, color: C.muted2 }}>{r.lang}</td>
                    </Hov>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <p style={{
          margin: 0, paddingTop: 14, borderTop: `1px solid ${C.lineSoft}`,
          fontSize: 10, color: C.faint2,
        }}>
          {COMPANY} · internal operational manifest
        </p>
      </section>
    </>
  );
}

const cell: React.CSSProperties = { padding: '6px 12px', verticalAlign: 'middle' };

/** One of the two figures the manifest opens with. */
function Stat({
  label, value, small,
}: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${C.lineSoft}`, background: C.wash, borderRadius: 7, padding: '11px 13px',
    }}>
      <p style={{
        margin: '0 0 4px', fontSize: 9, fontWeight: 600, letterSpacing: '.09em',
        textTransform: 'uppercase', color: C.muted2,
      }}>
        {label}
      </p>
      <p style={{
        margin: 0, fontWeight: 600, lineHeight: small ? 1.35 : 1,
        fontSize: small ? 12.5 : 19,
        fontVariantNumeric: 'tabular-nums', textWrap: 'pretty',
      }}>
        {value}
      </p>
    </div>
  );
}

