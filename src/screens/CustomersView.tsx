import { useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Empty, Hov, Input, MONO, Modal, ModalFoot, ModalHead,
  Section, SectionHead, Textarea, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { uploadFile } from '../lib/upload';
import { longDate, short, today, uid } from '../utils/dates';
import { paxOf, productName } from '../utils/selectors';
import { download, toCsv } from '../utils/exports';
import { RollingNumber } from '../ui/RollingNumber';
import type { Customer } from '../types';
import type { ViewProps } from './types';

export function CustomersView({ store, setConfirm }: ViewProps) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<Customer | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = today();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.customers
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        || c.phone.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [store.customers, query]);

  const selected = store.customers.find(c => c.id === selectedId) ?? list[0] ?? null;

  /* Bookings that belong to this customer, matched on phone first (stable) and
     on the lead traveller's name second. */
  const history = useMemo(() => {
    if (!selected) return [];
    const phone = selected.phone.replace(/\D/g, '');
    const name = selected.name.trim().toLowerCase();
    return store.bookings
      .filter(b => {
        const bp = b.phone.replace(/\D/g, '');
        if (phone && bp && bp.endsWith(phone.slice(-8))) return true;
        return !!name && (b.travelers[0]?.[0] ?? '').trim().toLowerCase() === name;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [store.bookings, selected]);

  /* Lead travellers who have bookings but no CRM record yet. */
  const suggestions = useMemo(() => {
    const known = new Set(store.customers.map(c => c.name.trim().toLowerCase()));
    const seen = new Map<string, { name: string; phone: string; trips: number }>();
    for (const b of store.bookings) {
      // A cancelled reservation is not a trip. Counting it inflates how often
      // a traveller has actually been out with us.
      if (b.status === 'Cancelled') continue;
      const n = (b.travelers[0]?.[0] ?? '').trim();
      if (!n || known.has(n.toLowerCase())) continue;
      const e = seen.get(n.toLowerCase()) ?? { name: n, phone: b.phone, trips: 0 };
      e.trips += 1;
      if (!e.phone) e.phone = b.phone;
      seen.set(n.toLowerCase(), e);
    }
    return [...seen.values()].sort((a, b) => b.trips - a.trips).slice(0, 6);
  }, [store.bookings, store.customers]);

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast('A name is required.', 'bad'); return; }
    const exists = store.customers.some(c => c.id === draft.id);
    commit({
      customers: exists
        ? store.customers.map(c => (c.id === draft.id ? draft : c))
        : [...store.customers, draft],
    });
    setSelectedId(draft.id);
    setDraft(null);
    toast(exists ? 'Customer saved' : 'Customer added');
  };

  const addFromSuggestion = (s: { name: string; phone: string; trips: number }) => {
    const c: Customer = {
      id: uid('C'), name: s.name, email: '', phone: s.phone, country: '',
      trips: s.trips, preferences: [], documents: [], notes: '', journey: [],
    };
    commit({ customers: [...store.customers, c] });
    setSelectedId(c.id);
    toast(`${s.name} added to the CRM`);
  };

  const attachDocument = async (file: File | undefined) => {
    if (!file || !selected) return;
    setUploading(true);
    try {
      const url = await uploadFile(`customers/${selected.id}`, file);
      const next: Customer = {
        ...selected,
        documents: [...selected.documents, { name: file.name, type: file.type || 'file', url }],
      };
      commit({ customers: store.customers.map(c => (c.id === next.id ? next : c)) });
      toast('Document attached');
    } catch (e) {
      toast((e as Error).message || 'Upload failed', 'bad');
    } finally {
      setUploading(false);
    }
  };

  const patchSelected = (patch: Partial<Customer>) => {
    if (!selected) return;
    commit({
      customers: store.customers.map(c => (c.id === selected.id ? { ...c, ...patch } : c)),
    });
  };

  return (
    <div data-r="split" style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)',
      gap: 14, alignItems: 'start',
    }}>
      {/* ── directory ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section>
          <SectionHead title="Customers" note={`${store.customers.length}`}>
            <Btn
              small
              icon="plus"
              onClick={() => setDraft({
                id: uid('C'), name: '', email: '', phone: '', country: '',
                trips: 0, preferences: [], documents: [], notes: '', journey: [],
              })}
            >
              New
            </Btn>
          </SectionHead>

          <div style={{ padding: '9px 12px', borderBottom: `1px solid ${C.lineSoft}` }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon name="search" size={13} color={C.muted3} style={{ position: 'absolute', left: 9 }} />
              <Input
                value={query}
                onChange={(e: any) => setQuery(e.target.value)}
                placeholder="Search name, email, country"
                style={{ paddingLeft: 28 }}
              />
            </div>
          </div>

          {!list.length && <Empty pad={26}>No customer matches that search.</Empty>}

          {list.map(c => {
            const on = selected?.id === c.id;
            return (
              <Hov
                key={c.id}
                as="button"
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0,
                  borderLeft: `3px solid ${on ? C.accent : 'transparent'}`,
                  borderBottom: `1px solid ${C.lineFaint}`,
                  background: on ? C.accentWash : C.panel, padding: '10px 13px',
                  cursor: 'pointer', textAlign: 'left',
                }}
                hover={on ? undefined : { background: C.wash }}
              >
                <span style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: 7, background: C.ink,
                  color: C.accent, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 12, fontWeight: 700,
                }}>
                  {c.name.charAt(0).toUpperCase() || '?'}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: 12.5, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.name}
                  </span>
                  <span style={{
                    fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.country || 'Country not set'}
                  </span>
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 10, color: C.faint, flexShrink: 0,
                }}>
                  {c.trips}
                </span>
              </Hov>
            );
          })}
        </Section>

        {suggestions.length > 0 && (
          <Section>
            <SectionHead title="Seen in bookings" note="not in the CRM yet" />
            {suggestions.map(s => (
              <div key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px',
                borderBottom: `1px solid ${C.lineFaint}`,
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>
                    {s.trips} booking{s.trips === 1 ? '' : 's'}
                  </span>
                </span>
                <Btn small icon="plus" onClick={() => addFromSuggestion(s)}>Add</Btn>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* ── record ── */}
      {!selected && (
        <Section><Empty pad={44}>Select a customer, or add one.</Empty></Section>
      )}

      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              <span style={{
                width: 46, height: 46, flexShrink: 0, borderRadius: 11, background: C.ink,
                color: C.accent, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, fontWeight: 700,
              }}>
                {selected.name.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>
                  {selected.name}
                </h2>
                <div style={{
                  display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap', fontSize: 11.5,
                  color: C.muted2,
                }}>
                  {selected.email && (
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  )}
                  {selected.phone && (
                    <span style={{ fontFamily: MONO }}>{selected.phone}</span>
                  )}
                  {selected.country && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="mapPin" size={11} color={C.muted} />
                      {selected.country}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {selected.phone && (
                  <Btn
                    small
                    icon="message"
                    onClick={() => window.open(
                      `https://wa.me/${selected.phone.replace(/\D/g, '')}`, '_blank', 'noopener')}
                  >
                    WhatsApp
                  </Btn>
                )}
                <Btn small icon="edit" onClick={() => setDraft({ ...selected })}>Edit</Btn>
                <Btn
                  small
                  icon="trash"
                  hover={{ borderColor: '#e0a3b3', color: C.bad }}
                  onClick={() => setConfirm({
                    title: `Delete ${selected.name}?`,
                    body: 'The CRM record is removed for everyone. Their bookings are untouched.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                    run: () => {
                      commit({ customers: store.customers.filter(c => c.id !== selected.id) });
                      setSelectedId('');
                      toast('Customer deleted');
                    },
                  })}
                >
                  Delete
                </Btn>
              </div>
            </div>

            <div style={{
              display: 'flex', gap: 20, marginTop: 14, paddingTop: 12,
              borderTop: `1px solid ${C.lineSoft}`, flexWrap: 'wrap',
            }}>
              <Metric label="Bookings on file" value={<RollingNumber value={history.length} />} />
              <Metric
                label="Passengers carried"
                value={<RollingNumber value={history.reduce((n, b) => n + paxOf(b), 0)} />}
              />
              <Metric
                label="Last travelled"
                value={history.find(b => b.date <= t)?.date ? short(history.find(b => b.date <= t)!.date) : '—'}
              />
              <Metric
                label="Next tour"
                value={(() => {
                  const next = [...history].reverse().find(b => b.date >= t);
                  return next ? short(next.date) : '—';
                })()}
              />
            </div>
          </Section>

          <div data-r="g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <Section>
              <SectionHead title="Preferences">
                <Btn
                  small
                  icon="plus"
                  onClick={() => {
                    const v = window.prompt('Add a preference (e.g. “vegetarian”, “slow walker”)');
                    if (v?.trim()) {
                      patchSelected({ preferences: [...selected.preferences, v.trim()] });
                    }
                  }}
                >
                  Add
                </Btn>
              </SectionHead>
              <div style={{ padding: 13, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {!selected.preferences.length && (
                  <span style={{ fontSize: 11.5, color: C.muted }}>Nothing recorded yet.</span>
                )}
                {selected.preferences.map((p, i) => (
                  <span key={`${p}-${i}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5,
                    background: C.paper, border: `1px solid ${C.line}`, borderRadius: 20,
                    padding: '3px 5px 3px 10px',
                  }}>
                    {p}
                    <Hov
                      as="button"
                      type="button"
                      title="Remove"
                      onClick={() => patchSelected({
                        preferences: selected.preferences.filter((_, j) => j !== i),
                      })}
                      style={{
                        width: 16, height: 16, border: 0, background: 'transparent',
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', color: C.faint, padding: 0,
                      }}
                      hover={{ color: C.bad, background: C.badBg }}
                    >
                      <Icon name="x" size={9} width={2.6} />
                    </Hov>
                  </span>
                ))}
              </div>
            </Section>

            <Section>
              <SectionHead title="Documents" note={`${selected.documents.length}`}>
                <Btn
                  small
                  icon={uploading ? 'spinner' : 'paperclip'}
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? 'Uploading…' : 'Attach'}
                </Btn>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { void attachDocument(e.target.files?.[0]); e.target.value = ''; }}
                />
              </SectionHead>

              {!selected.documents.length && (
                <Empty pad={20}>
                  No document on file. Attachments go to the shared media bucket.
                </Empty>
              )}

              {selected.documents.map((d, i) => (
                <div key={`${d.name}-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px',
                  borderBottom: `1px solid ${C.lineFaint}`,
                }}>
                  <Icon name="fileText" size={13} color={C.muted} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 11.5, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer">{d.name}</a> : d.name}
                  </span>
                  <Hov
                    as="button"
                    type="button"
                    title="Remove from the record"
                    onClick={() => patchSelected({
                      documents: selected.documents.filter((_, j) => j !== i),
                    })}
                    style={{
                      width: 22, height: 22, border: `1px solid ${C.line}`, background: C.panel,
                      borderRadius: 5, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', color: C.faint, padding: 0,
                    }}
                    hover={{ borderColor: '#e0a3b3', color: C.bad }}
                  >
                    <Icon name="x" size={10} />
                  </Hov>
                </div>
              ))}
            </Section>
          </div>

          <Section>
            <SectionHead title="Travel history" note={`${history.length} bookings`}>
              <Btn
                small
                icon="download"
                onClick={() => {
                  download(
                    `sole-customer-${selected.name.replace(/\s+/g, '-').toLowerCase()}.csv`,
                    toCsv([
                      ['Reference', 'Date', 'Tour', 'Pax', 'Guide', 'Status'],
                      ...history.map(b => [
                        b.ref, b.date, productName(store.products, b),
                        paxOf(b), b.guide, b.status,
                      ]),
                    ]),
                  );
                  toast('Saved');
                }}
              >
                CSV
              </Btn>
            </SectionHead>

            {!history.length && (
              <Empty pad={26}>
                No booking is linked to this record yet. Bookings are matched on phone number,
                then on the lead passenger’s name.
              </Empty>
            )}

            {history.map(b => (
              <Hov
                key={b.ref}
                as="div"
                className="row"
                data-r="listrow"
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px',
                  borderBottom: `1px solid ${C.lineFaint}`,
                }}
                hover={{ background: C.wash }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: b.date >= t ? C.accent : '#d3d7de',
                }} />
                <span style={{
                  width: 78, flexShrink: 0, fontSize: 11.5, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {longDate(b.date).split(' ').slice(1).join(' ')}
                </span>
                <span data-grow style={{
                  flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {productName(store.products, b)}
                </span>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>
                  {paxOf(b)} pax
                </span>
                <span style={{ fontSize: 11, color: C.muted2, width: 96, flexShrink: 0 }}>
                  {b.guide || 'No guide'}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, flexShrink: 0 }}>
                  {b.ref}
                </span>
              </Hov>
            ))}
          </Section>

          <Section style={{ padding: 15 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 600 }}>Notes</h2>
            <Textarea
              value={selected.notes}
              onChange={(e: any) => patchSelected({ notes: e.target.value })}
              placeholder="Anything the team should know before this traveller arrives"
              style={{ minHeight: 80, background: C.accentWash, borderColor: '#f6e2c4' }}
            />
          </Section>
        </div>
      )}

      {/* ── editor ── */}
      <Modal open={!!draft} onClose={() => setDraft(null)} width={460}>
        {draft && (
          <>
            <ModalHead
              title={store.customers.some(c => c.id === draft.id) ? 'Edit customer' : 'New customer'}
              sub="Phone numbers link a record to its bookings, so include the country code."
              onClose={() => setDraft(null)}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <Fld label="Name">
                <Input value={draft.name} onChange={(e: any) => setDraft({ ...draft, name: e.target.value })} />
              </Fld>
              <div data-r="fields" style={{ display: 'flex', gap: 10 }}>
                <Fld label="Email" grow>
                  <Input
                    type="email"
                    value={draft.email}
                    onChange={(e: any) => setDraft({ ...draft, email: e.target.value })}
                  />
                </Fld>
                <Fld label="Phone" grow>
                  <Input
                    value={draft.phone}
                    onChange={(e: any) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="+1 …"
                  />
                </Fld>
              </div>
              <div data-r="fields" style={{ display: 'flex', gap: 10 }}>
                <Fld label="Country" grow>
                  <Input
                    value={draft.country}
                    onChange={(e: any) => setDraft({ ...draft, country: e.target.value })}
                  />
                </Fld>
                <Fld label="Trips on record">
                  <Input
                    type="number"
                    min={0}
                    value={String(draft.trips)}
                    onChange={(e: any) => setDraft({ ...draft, trips: Number(e.target.value) || 0 })}
                    style={{ width: 120 }}
                  />
                </Fld>
              </div>
              <Fld label="Notes">
                <Textarea
                  value={draft.notes}
                  onChange={(e: any) => setDraft({ ...draft, notes: e.target.value })}
                  style={{ minHeight: 60 }}
                />
              </Fld>
            </div>
            <ModalFoot>
              <Btn onClick={() => setDraft(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={save}>Save</Btn>
            </ModalFoot>
          </>
        )}
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function Fld({
  label, children, grow,
}: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: grow ? 1 : undefined, minWidth: 0,
    }}>
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
