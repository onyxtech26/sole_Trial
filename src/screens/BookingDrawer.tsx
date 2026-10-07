import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Hov, Input, MONO, PAY_COLORS, STATUS_COLORS, Select, Textarea, useToast,
} from '../ui/kit';
import { eur, longDate, today } from '../utils/dates';
import {
  fillTemplate, paxOf, productName, rankedGuides, templateVars, tgTitleOf,
} from '../utils/selectors';
import { isPlaceholderName } from '../utils/viator';
import { copyText } from '../utils/exports';
import { ImageSendPanel } from '../ui/ImageSendPanel';
import { PAYMENT_STATUSES } from '../types';
import { WF_STEPS } from '../utils/workflow';
import type { Booking, StoreData, Traveler } from '../types';

const blank = (): Booking => ({
  ref: `BR-${Date.now().toString().slice(-10)}`,
  code: '', tg: 'TG1', date: today(), resTime: '', tourTime: '', lang: 'EN',
  guide: '', phone: '', travelers: [['', 'Adult']], gross: 0, spent: 0, sortOrder: 0,
  wf: [0, 0, 0, 0, 0], status: 'Confirmed', payment: 'Unpaid', refundPct: 0, notes: '',
  namesLocked: false, source: 'manual',
  tourName: '', tgTitle: '', meetingPoint: '', currency: 'EUR', leadTraveler: '',
  assignedDriver: 'None', okStatus: true, checkedIn: [], namesComplete: false,
  serviceLineItems: null,
});

interface Props {
  store: StoreData;
  booking: Booking | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (b: Booking) => void;
  onDelete: (ref: string) => void;
  onSyncGroups: (bookings: Booking[]) => void;
}

export function BookingDrawer({ store, booking, isNew, onClose, onSave, onDelete }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<Booking>(() => (isNew ? blank() : booking ?? blank()));
  const [dirty, setDirty] = useState(false);

  // Reopening on a different booking, or a realtime update landing, reseeds the
  // draft — unless the operator has unsaved edits in front of them.
  useEffect(() => {
    if (isNew || !booking || dirty) return;
    setDraft(booking);
  }, [booking, isNew, dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch: Partial<Booking>) => {
    setDraft(d => ({ ...d, ...patch }));
    setDirty(true);
  };

  const product = store.products.find(p => p.code === draft.code);
  const sc = STATUS_COLORS[draft.status] ?? STATUS_COLORS.Confirmed;
  const pc = PAY_COLORS[draft.payment] ?? PAY_COLORS.Unpaid;

  // Available guides first, best rated at the top — same order as everywhere else.
  const guideNames = useMemo(
    () => [...rankedGuides(store.guides).map(g => g.name), ...store.staff.map(s => s.name)],
    [store.guides, store.staff],
  );

  const setTraveler = (i: number, next: Traveler) => {
    const travelers = draft.travelers.map((t, j) => (j === i ? next : t));
    set({ travelers, leadTraveler: travelers[0]?.[0] ?? '' });
  };

  /** Images attached to the template a compose button most recently opened. */
  const [imagePanel, setImagePanel] = useState<{ label: string; images: string[] } | null>(null);

  const sendWhatsapp = (stage: number) => {
    const tpl = store.templates.find(x => x.stage === stage) ?? store.templates[0];
    if (!tpl) { toast('No message template is set up yet.', 'warn'); return; }
    const lang = draft.lang.toLowerCase();
    const body = fillTemplate(
      lang === 'es' ? tpl.es || tpl.en : lang === 'it' ? tpl.it || tpl.en : tpl.en,
      templateVars(store.products, draft),
    );
    const digits = draft.phone.replace(/[^\d]/g, '');
    if (!digits) {
      void copyText(body).then(ok =>
        toast(ok ? 'No phone number — message copied instead' : 'No phone number on this booking', ok ? 'warn' : 'bad'));
      return;
    }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
    // WhatsApp's click-to-chat link carries text only — it has no way to attach
    // media. The images panel is the next best thing: copy one to the clipboard
    // and paste it straight into the chat tab that just opened.
    if (tpl.images.length) setImagePanel({ label: tpl.name, images: tpl.images });
  };

  const save = () => {
    if (!draft.travelers.length || !draft.travelers[0][0].trim()) {
      toast('The lead passenger needs a name.', 'bad');
      return;
    }
    if (!draft.date) {
      toast('Pick a travel date.', 'bad');
      return;
    }
    const cleaned: Booking = {
      ...draft,
      travelers: draft.travelers.filter(t => t[0].trim() !== ''),
      leadTraveler: draft.travelers[0][0].trim(),
      namesComplete: draft.travelers.every(t => !isPlaceholderName(t[0])),
      tourName: draft.tourName || product?.label || '',
      tgTitle: draft.tgTitle || tgTitleOf(store.products, draft),
    };
    onSave(cleaned);
    setDirty(false);
  };

  const fields: { label: string; value: string }[] = [
    { label: 'Travel date', value: longDate(draft.date) },
    { label: 'Reserved for', value: draft.resTime || '—' },
    { label: 'Passengers', value: `${paxOf(draft)} · ${draft.travelers.filter(t => t[1] === 'Adult').length} adult, ${draft.travelers.filter(t => t[1] === 'Child').length} child` },
    { label: 'Language', value: draft.lang },
    { label: 'Viator payout', value: eur(draft.gross) },
  ];

  return createPortal(
    <>
      <div
        className="fade"
        data-print="hide"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,32,.22)', zIndex: 40 }}
      />
      <aside
        data-r="drawer"
        data-print="hide"
        className="slide-r"
        role="dialog"
        aria-label="Booking details"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 428, background: C.panel,
          borderLeft: `1px solid ${C.line}`, boxShadow: '-8px 0 28px rgba(11,18,32,.1)',
          zIndex: 41, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* header */}
        <div style={{
          flexShrink: 0, padding: '15px 18px', borderBottom: `1px solid ${C.line}`,
          display: 'flex', alignItems: 'flex-start', gap: 11,
        }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{draft.ref}</span>
            <h2 style={{
              margin: 0, fontSize: 14.5, fontWeight: 600,
              letterSpacing: '-.01em', textWrap: 'pretty',
            }}>
              {isNew ? 'New booking' : productName(store.products, draft)}
            </h2>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap',
            }}>
              <select
                value={draft.status}
                onChange={e => set({ status: e.target.value as Booking['status'] })}
                style={{
                  display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 11, border: 0, background: sc.bg,
                  color: sc.fg, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {['Confirmed', 'Modified', 'Pending', 'Cancelled'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span style={{
                fontFamily: MONO, fontSize: 10.5, color: C.muted2,
                background: C.paper, borderRadius: 4, padding: '2px 6px',
              }}>
                {draft.tg} · {tgTitleOf(store.products, draft)}
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 11,
                background: pc.bg, color: pc.fg,
              }}>
                {draft.payment}
              </span>
            </div>
          </div>
          <Hov
            as="button"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 26, height: 26, flexShrink: 0, border: `1px solid ${C.line}`,
              background: C.panel, borderRadius: 6, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', padding: 0,
            }}
            hover={{ background: C.paper, borderColor: '#c9ced7' }}
          >
            <Icon name="x" size={13} color={C.body} />
          </Hov>
        </div>

        {/* body — minHeight: 0 so this scrolls instead of growing and pushing
            the action bar off the bottom of the drawer. */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          {/* auto-fit rather than a breakpoint: this grid lives inside a
              fixed-width drawer, so it has to respond to its own box, not to
              the viewport. Two columns when they fit, one when they do not. */}
          {!isNew && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(148px,1fr))', gap: 12,
            }}>
              {fields.map(f => (
                <div key={f.label} style={{
                  display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
                }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
                    textTransform: 'uppercase', color: C.muted3,
                  }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, textWrap: 'pretty' }}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Group title={isNew ? 'Booking' : 'Operations · editable'}>
            {isNew && (
              <>
                <Row label="Reference">
                  <Input value={draft.ref} onChange={(e: any) => set({ ref: e.target.value })} />
                </Row>
                <Row label="Date">
                  <Input type="date" value={draft.date} onChange={(e: any) => set({ date: e.target.value })} />
                </Row>
                <Row label="Phone">
                  <Input
                    value={draft.phone}
                    onChange={(e: any) => set({ phone: e.target.value })}
                    placeholder="+39 …"
                  />
                </Row>
                <Row label="Language">
                  <Input
                    value={draft.lang}
                    onChange={(e: any) => set({ lang: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="EN"
                  />
                </Row>
                <Row label="Revenue">
                  <Input
                    type="number"
                    step="0.01"
                    value={String(draft.gross)}
                    onChange={(e: any) => set({ gross: Number(e.target.value) || 0 })}
                  />
                </Row>
              </>
            )}

            {/* Viator sends a phone number, but travellers correct it over
                WhatsApp constantly, so operations has to be able to fix it. */}
            {!isNew && (
              <Row label="Phone">
                <Input
                  value={draft.phone}
                  onChange={(e: any) => set({ phone: e.target.value })}
                  placeholder="+39 …"
                  style={{ background: C.panel }}
                />
              </Row>
            )}

            <Row label="Tour">
              <Select
                value={draft.code}
                onChange={(e: any) => {
                  const p = store.products.find(x => x.code === e.target.value);
                  set({
                    code: e.target.value,
                    tg: p?.options[0]?.tg ?? draft.tg,
                    tourName: p?.label ?? '',
                  });
                }}
                options={[
                  { v: '', t: 'Not set' },
                  ...store.products.map(p => ({ v: p.code, t: p.name })),
                ]}
                style={{ background: C.panel }}
              />
            </Row>

            <Row label="Tour option">
              <Select
                value={draft.tg}
                onChange={(e: any) => set({ tg: e.target.value })}
                options={
                  product?.options.length
                    ? product.options.map(o => ({ v: o.tg, t: `${o.tg} · ${o.title} (max ${o.cap})` }))
                    : [{ v: draft.tg, t: draft.tg }]
                }
                style={{ background: C.panel }}
              />
            </Row>

            <Row label="Tour time">
              <Input
                type="time"
                value={draft.tourTime}
                onChange={(e: any) => set({ tourTime: e.target.value })}
                style={{ background: C.panel }}
              />
            </Row>

            <Row label="Guide">
              <Select
                value={draft.guide}
                onChange={(e: any) => set({ guide: e.target.value })}
                options={[
                  { v: '', t: 'No guide yet' },
                  ...guideNames.map(n => ({ v: n, t: n })),
                ]}
                style={{ background: C.panel }}
              />
            </Row>

            <Row label="Payment">
              <Select
                value={draft.payment}
                onChange={(e: any) => {
                  const payment = e.target.value as Booking['payment'];
                  // Leaving the partial state clears the percentage, so a
                  // booking can never read "Paid" and still carry "refunded 30%".
                  set(payment === 'Partial refund'
                    ? { payment, refundPct: draft.refundPct || 50 }
                    : { payment, refundPct: 0 });
                }}
                options={PAYMENT_STATUSES.map(p => ({ v: p, t: p }))}
                style={{ background: C.panel }}
              />
            </Row>

            {draft.payment === 'Partial refund' && (
              <Row label="Refunded">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step="1"
                    value={String(draft.refundPct)}
                    onChange={(e: any) => set({
                      refundPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    })}
                    style={{ background: C.panel, width: 88 }}
                  />
                  <span style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>
                    % of {eur(draft.gross)} ={' '}
                    <strong style={{ color: C.ink }}>
                      {eur((draft.gross * draft.refundPct) / 100)}
                    </strong>
                  </span>
                </div>
              </Row>
            )}

            <Row label="Cost">
              <Input
                type="number"
                step="0.01"
                value={String(draft.spent)}
                onChange={(e: any) => set({ spent: Number(e.target.value) || 0 })}
                style={{ background: C.panel }}
              />
            </Row>
          </Group>

          {/* workflow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <SubLabel>Message workflow</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {WF_STEPS.map((w, i) => {
                const on = !!draft.wf[i];
                return (
                  <div key={w.letter} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Hov
                      as="button"
                      type="button"
                      onClick={() => {
                        const wf = draft.wf.slice();
                        wf[i] = wf[i] ? 0 : 1;
                        set({ wf });
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 9,
                        border: `1px solid ${on ? '#dfe8e3' : C.line}`,
                        background: on ? '#f4faf7' : C.panel, borderRadius: 6,
                        padding: '7px 9px', cursor: 'pointer', textAlign: 'left',
                      }}
                      hover={{ borderColor: '#c9ced7' }}
                    >
                      <span style={{
                        width: 16, height: 16, flexShrink: 0, borderRadius: 4,
                        background: on ? C.good : '#f0f2f5', color: on ? '#fff' : '#b9bfc8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700,
                      }}>
                        {w.letter}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{w.label}</span>
                      <span style={{
                        fontSize: 11, color: on ? C.good : C.faint, fontWeight: 600,
                      }}>
                        {on ? 'Done' : 'Pending'}
                      </span>
                    </Hov>
                    <Hov
                      as="button"
                      type="button"
                      title="Compose this message in WhatsApp"
                      onClick={() => sendWhatsapp(w.stage)}
                      style={{
                        width: 28, height: 31, flexShrink: 0, border: `1px solid ${C.line}`,
                        background: C.panel, borderRadius: 6, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: C.body, padding: 0,
                      }}
                      hover={{ borderColor: '#0f8a5f', color: C.good, background: C.goodBg }}
                    >
                      <Icon name="message" size={12} />
                    </Hov>
                  </div>
                );
              })}
            </div>
          </div>

          {/* passengers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SubLabel>Passengers</SubLabel>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
                {paxOf(draft)} total
              </span>
              <div style={{ flex: 1 }} />
              <Hov
                as="button"
                type="button"
                onClick={() => set({ namesLocked: !draft.namesLocked })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${draft.namesLocked ? '#cfe4d9' : C.line}`,
                  background: draft.namesLocked ? C.goodBg : C.panel, borderRadius: 5,
                  padding: '2px 7px', fontSize: 10.5, fontWeight: 600,
                  color: draft.namesLocked ? C.good : C.body, cursor: 'pointer',
                }}
                hover={{ borderColor: C.accent }}
              >
                <Icon name="lock" size={10} width={2.4} />
                {draft.namesLocked ? 'Names locked' : 'Lock names'}
              </Hov>
            </div>

            <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 7, overflow: 'hidden' }}>
              {draft.travelers.map((tv, i) => {
                const placeholder = isPlaceholderName(tv[0]);
                const initials = (tv[0] || '?')
                  .split(/\s+/).slice(0, 2).map(s => s.charAt(0).toUpperCase()).join('');
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '6px 8px 6px 10px', borderBottom: '1px solid #f4f6f8',
                  }}>
                    <span style={{
                      width: 18, height: 18, flexShrink: 0, borderRadius: '50%',
                      background: '#f0f2f5', color: C.body, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 600,
                    }}>
                      {initials}
                    </span>
                    <input
                      value={tv[0]}
                      disabled={draft.namesLocked}
                      onChange={e => setTraveler(i, [e.target.value, tv[1]])}
                      placeholder="Name as on the ID document"
                      style={{
                        flex: 1, minWidth: 0, height: 24, border: '1px solid transparent',
                        background: 'transparent', borderRadius: 5, padding: '0 6px',
                        fontSize: 12.5, color: placeholder ? C.faint : C.ink,
                        fontStyle: placeholder ? 'italic' : 'normal',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <select
                      value={tv[1]}
                      disabled={draft.namesLocked}
                      onChange={e => setTraveler(i, [tv[0], e.target.value as Traveler[1]])}
                      style={{
                        flexShrink: 0, height: 22, border: `1px solid ${C.lineSoft}`,
                        background: C.paper, borderRadius: 4, padding: '0 4px', fontSize: 10.5,
                        fontWeight: 600, color: C.muted2, outline: 'none',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="Adult">Adult</option>
                      <option value="Child">Child</option>
                    </select>
                    <Hov
                      as="button"
                      type="button"
                      title="Remove passenger"
                      disabled={draft.namesLocked || draft.travelers.length === 1}
                      onClick={() => set({ travelers: draft.travelers.filter((_, j) => j !== i) })}
                      style={{
                        width: 20, height: 20, flexShrink: 0, border: `1px solid ${C.lineSoft}`,
                        background: C.panel, borderRadius: 4, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: '#c9ced7', padding: 0,
                      }}
                      hover={{ borderColor: '#e0a3b3', color: C.bad }}
                    >
                      <Icon name="x" size={10} width={2.4} />
                    </Hov>
                  </div>
                );
              })}

              <Hov
                as="button"
                type="button"
                disabled={draft.namesLocked}
                onClick={() => set({
                  travelers: [...draft.travelers, [`Guest ${draft.travelers.length + 1}`, 'Adult']],
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', border: 0,
                  background: C.wash, padding: '7px 10px', fontSize: 11.5, fontWeight: 500,
                  color: C.muted2, cursor: 'pointer', textAlign: 'left',
                }}
                hover={{ background: C.accentWash, color: C.accentInk }}
              >
                <Icon name="plus" size={12} />
                Add passenger
              </Hov>
            </div>
          </div>

          {/* notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SubLabel>Notes</SubLabel>
            <Textarea
              value={draft.notes}
              onChange={(e: any) => set({ notes: e.target.value })}
              placeholder="Operational notes for this booking"
              style={{
                minHeight: 64, background: C.accentWash, borderColor: '#f6e2c4', color: '#3f4756',
              }}
            />
          </div>
        </div>

        {/* footer */}
        <div data-r="drawerfoot" style={{
          flexShrink: 0, padding: '12px 18px', borderTop: `1px solid ${C.line}`,
          display: 'flex', gap: 8,
        }}>
          <Btn
            variant="primary"
            onClick={save}
            style={{ flex: 1, height: 33 }}
          >
            {dirty ? 'Save changes' : 'Saved'}
          </Btn>
          <Btn
            onClick={() => {
              void copyText(draft.ref).then(ok => toast(ok ? 'Reference copied' : 'Copy was blocked', ok ? 'ok' : 'bad'));
            }}
            style={{ height: 33 }}
          >
            Copy ref
          </Btn>
          {!isNew && (
            <Hov
              as="button"
              type="button"
              title="Delete booking"
              onClick={() => onDelete(draft.ref)}
              style={{
                width: 33, height: 33, flexShrink: 0, border: `1px solid ${C.line}`,
                background: C.panel, color: C.bad, borderRadius: 6, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
              }}
              hover={{ borderColor: '#e0a3b3', background: C.badBg }}
            >
              <Icon name="trash" size={13} />
            </Hov>
          )}
        </div>
      </aside>

      {imagePanel && (
        <ImageSendPanel
          label={imagePanel.label}
          images={imagePanel.images}
          onClose={() => setImagePanel(null)}
        />
      )}
    </>,
    document.body,
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <SubLabel>{title}</SubLabel>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
      textTransform: 'uppercase', color: C.muted3,
    }}>
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 74, fontSize: 12, color: C.muted2, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </label>
  );
}

