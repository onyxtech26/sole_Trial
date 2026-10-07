import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Empty, Hov, Input, MONO, Modal, ModalFoot, ModalHead, Section, Select, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { averageRating } from '../utils/ratings';
import { uploadFile } from '../lib/upload';
import { short, today, uid } from '../utils/dates';
import { GUIDE_SORTS, sortGuides, type GuideSort } from '../utils/selectors';
import { RollingNumber } from '../ui/RollingNumber';
import type { Guide, GuideReview, StaffMember } from '../types';
import type { ViewProps } from './types';

type Tab = 'guides' | 'staff';

const AVAIL: Guide['avail'][] = ['Active', 'On break', 'Unavailable'];
const AVAIL_COLORS: Record<string, { bg: string; fg: string }> = {
  Active: { bg: C.goodBg, fg: C.good },
  'On break': { bg: C.warnBg, fg: C.warn },
  Unavailable: { bg: C.badBg, fg: C.bad },
};

/**
 * How this operator left the directory sorted.
 *
 * Sorting is a personal working preference rather than shared data — one
 * dispatcher wants the lightest workload first, another wants to find a name —
 * so it lives in this browser rather than in Supabase.
 */
const SORT_KEY = 'sole_team_sort_v1';

function readSort(): GuideSort {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw && GUIDE_SORTS.some(s => s.v === raw)) return raw as GuideSort;
  } catch {
    /* private mode — fall through to the default */
  }
  return 'standing';
}

const nextId = (prefix: string, existing: { id: string }[]): string => {
  const nums = existing
    .map(x => Number(String(x.id).replace(/\D/g, '')))
    .filter(n => !Number.isNaN(n));
  return `${prefix}-${(nums.length ? Math.max(...nums) : prefix === 'G' ? 200 : 300) + 1}`;
};

export function TeamView({ store, user, setConfirm }: ViewProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('guides');
  const [query, setQuery] = useState('');
  const [guideDraft, setGuideDraft] = useState<Guide | null>(null);
  const [staffDraft, setStaffDraft] = useState<StaffMember | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Which guide card has its review list open. One at a time. */
  const [openReviews, setOpenReviews] = useState<string | null>(null);
  const [sort, setSort] = useState<GuideSort>(readSort);
  const photoInput = useRef<HTMLInputElement>(null);
  const t = today();

  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      /* not remembering the sort is not worth failing over */
    }
  }, [sort]);

  /* Both editors share one file input: only one modal is ever open. */
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile('team', file);
      setGuideDraft(d => (d ? { ...d, image: url } : d));
      setStaffDraft(d => (d ? { ...d, image: url } : d));
      toast('Photo attached — save to keep it');
    } catch (err) {
      toast((err as Error).message || 'Upload failed', 'bad');
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  /* Upcoming workload per guide — the number that actually matters when dispatching. */
  const load = useMemo(() => {
    const m = new Map<string, { tours: number; pax: number }>();
    for (const b of store.bookings) {
      if (!b.guide || b.date < t || b.status === 'Cancelled') continue;
      const e = m.get(b.guide) ?? { tours: 0, pax: 0 };
      e.tours += 1;
      e.pax += b.travelers.length;
      m.set(b.guide, e);
    }
    return m;
  }, [store.bookings, t]);

  const q = query.trim().toLowerCase();
  const guides = sortGuides(store.guides, sort, g => load.get(g.name)?.tours ?? 0)
    .filter(g =>
      !q || g.name.toLowerCase().includes(q) || g.skills.toLowerCase().includes(q) ||
      g.langs.toLowerCase().includes(q));
  // Office staff carry no rating or availability, so the only order that means
  // anything to a reader is alphabetical — which beats the database's own.
  const staff = [...store.staff].sort((a, b) => a.name.localeCompare(b.name)).filter(s =>
    !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) ||
    s.duties.toLowerCase().includes(q));

  const saveGuide = () => {
    if (!guideDraft) return;
    if (!guideDraft.name.trim()) { toast('A name is required.', 'bad'); return; }
    const exists = store.guides.some(g => g.id === guideDraft.id);
    commit({
      guides: exists
        ? store.guides.map(g => (g.id === guideDraft.id ? guideDraft : g))
        : [...store.guides, guideDraft],
    });
    setGuideDraft(null);
    toast(exists ? 'Guide saved' : 'Guide added');
  };

  const saveStaff = () => {
    if (!staffDraft) return;
    if (!staffDraft.name.trim()) { toast('A name is required.', 'bad'); return; }
    const exists = store.staff.some(s => s.id === staffDraft.id);
    commit({
      staff: exists
        ? store.staff.map(s => (s.id === staffDraft.id ? staffDraft : s))
        : [...store.staff, staffDraft],
    });
    setStaffDraft(null);
    toast(exists ? 'Staff member saved' : 'Staff member added');
  };

  const removeGuide = (g: Guide) => {
    const assigned = store.bookings.filter(b => b.guide === g.name && b.date >= t).length;
    setConfirm({
      title: `Remove ${g.name}?`,
      body: assigned
        ? `${g.name} is still on ${assigned} upcoming booking${assigned === 1 ? '' : 's'}. Those keep the name but the guide disappears from the directory and from every picker.`
        : 'They are removed from the shared directory for everyone.',
      confirmLabel: 'Remove',
      tone: 'danger',
      run: () => {
        commit({ guides: store.guides.filter(x => x.id !== g.id) });
        toast(`${g.name} removed`);
      },
    });
  };

  return (
    <>
      <div data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div data-r="seg" style={{
          display: 'flex', border: `1px solid ${C.line}`, background: C.panel,
          borderRadius: 6, overflow: 'hidden',
        }}>
          {([['guides', `Guides (${store.guides.length})`], ['staff', `Office staff (${store.staff.length})`]] as const)
            .map(([id, label]) => {
              const on = tab === id;
              return (
                <Hov
                  key={id}
                  as="button"
                  type="button"
                  onClick={() => setTab(id)}
                  style={{
                    border: 0, borderRight: `1px solid ${C.lineSoft}`, padding: '6px 13px',
                    fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer',
                    background: on ? C.ink : C.panel, color: on ? '#fff' : C.body,
                  }}
                  hover={on ? undefined : { background: C.paper }}
                >
                  {label}
                </Hov>
              );
            })}
        </div>

        <div data-grow style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Icon name="search" size={13} color={C.muted3} style={{ position: 'absolute', left: 9 }} />
          <Input
            value={query}
            onChange={(e: any) => setQuery(e.target.value)}
            placeholder="Search a name, language or skill"
            style={{ width: 240, paddingLeft: 28, background: C.panel }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Only on the guides tab: office staff carry no rating, availability or
            tour load, so every option but one would sort on nothing. */}
        {tab === 'guides' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
              textTransform: 'uppercase', color: C.muted3, whiteSpace: 'nowrap',
            }}>
              Sort by
            </span>
            <Select
              value={sort}
              onChange={(e: any) => setSort(e.target.value as GuideSort)}
              options={GUIDE_SORTS.map(s => ({ v: s.v, t: s.t }))}
              style={{ background: C.panel, width: 208 }}
            />
          </label>
        )}

        <Btn
          variant="primary"
          icon="plus"
          style={{ padding: '6px 11px', fontSize: 12 }}
          onClick={() => {
            setIsNew(true);
            if (tab === 'guides') {
              setGuideDraft({
                id: nextId('G', store.guides), name: '', phone: '', langs: 'EN',
                skills: '', rating: 5, avail: 'Active', image: '', reviews: [],
              });
            } else {
              setStaffDraft({
                id: nextId('S', store.staff), name: '', role: 'Operations',
                phone: '', duties: '', image: '',
                langs: '', rating: 5, avail: 'Active',
              });
            }
          }}
        >
          {tab === 'guides' ? 'New guide' : 'New staff member'}
        </Btn>
      </div>

      {tab === 'guides' && (
        <>
          {!guides.length && <Section><Empty pad={40}>No guide matches that search.</Empty></Section>}
          <div data-r="g3" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12,
          }}>
            {guides.map(g => {
              const l = load.get(g.name);
              const av = AVAIL_COLORS[g.avail] ?? AVAIL_COLORS.Active;
              return (
                <Section key={g.id} className="up lift-shadow" style={{ padding: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <Avatar src={g.image} name={g.name} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{g.name}</h3>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint }}>
                        {g.id} · {g.phone || 'no phone'}
                      </span>
                    </div>
                    <div className="row-actions" style={{ display: 'flex', gap: 5 }}>
                      <Hov
                        as="button" type="button" title="Edit"
                        onClick={() => { setIsNew(false); setGuideDraft({ ...g }); }}
                        style={iconBtn} hover={{ borderColor: C.accent, color: C.ink }}
                      >
                        <Icon name="edit" size={12} />
                      </Hov>
                      <Hov
                        as="button" type="button" title="Remove"
                        onClick={() => removeGuide(g)}
                        style={iconBtn} hover={{ borderColor: '#e0a3b3', color: C.bad }}
                      >
                        <Icon name="trash" size={12} />
                      </Hov>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, marginTop: 11, flexWrap: 'wrap',
                  }}>
                    <Hov
                      as="button"
                      type="button"
                      title="Toggle availability"
                      onClick={() => commit({
                        guides: store.guides.map(x => x.id === g.id
                          ? { ...x, avail: x.avail === 'Active' ? 'On break' : 'Active' }
                          : x),
                      })}
                      style={{
                        border: 0, fontSize: 10.5, fontWeight: 600, borderRadius: 11,
                        padding: '2px 8px', background: av.bg, color: av.fg, cursor: 'pointer',
                      }}
                      hover={{ opacity: 0.82 }}
                    >
                      {g.avail}
                    </Hov>
                    <Hov
                      as="button"
                      type="button"
                      disabled={!g.reviews.length}
                      aria-expanded={openReviews === g.id}
                      title={g.reviews.length ? 'Show the reviews behind this score' : 'No reviews yet'}
                      onClick={() => setOpenReviews(v => (v === g.id ? null : g.id))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                        color: C.muted2, border: 0, background: 'transparent',
                        padding: '1px 4px', borderRadius: 5, marginLeft: -4,
                        cursor: g.reviews.length ? 'pointer' : 'default',
                      }}
                      hover={g.reviews.length ? { background: C.accentWash, color: C.ink } : undefined}
                    >
                      <Icon name="star" size={11} color={C.accent} fill={C.accent} />
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {g.rating.toFixed(1)}
                      </strong>
                      <span style={{ color: C.faint }}>
                        {g.reviews.length
                          ? `${g.reviews.length} review${g.reviews.length === 1 ? '' : 's'}`
                          : 'no reviews'}
                      </span>
                      {g.reviews.length > 0 && (
                        <Icon
                          name="chevronDown"
                          size={11}
                          color={C.faint}
                          style={{
                            transform: openReviews === g.id ? 'rotate(180deg)' : 'none',
                            transition: 'transform .24s var(--ease)',
                          }}
                        />
                      )}
                    </Hov>
                    <span style={{ fontSize: 11, color: C.muted2 }}>{g.langs}</span>
                  </div>

                  {g.skills && (
                    <p style={{
                      margin: '9px 0 0', fontSize: 11.5, color: C.muted2,
                      lineHeight: 1.5, textWrap: 'pretty',
                    }}>
                      {g.skills}
                    </p>
                  )}

                  <ReviewPanel open={openReviews === g.id} reviews={g.reviews} />

                  <div style={{
                    display: 'flex', gap: 14, marginTop: 11, paddingTop: 10,
                    borderTop: `1px solid ${C.lineSoft}`, fontSize: 11,
                  }}>
                    <span style={{ color: C.muted }}>
                      <RollingNumber
                        value={l?.tours ?? 0}
                        style={{ color: C.ink, fontWeight: 700 }}
                      />{' '}
                      upcoming tours
                    </span>
                    <span style={{ color: C.muted }}>
                      <RollingNumber
                        value={l?.pax ?? 0}
                        style={{ color: C.ink, fontWeight: 700 }}
                      />{' '}
                      passengers
                    </span>
                  </div>
                </Section>
              );
            })}
          </div>
        </>
      )}

      {tab === 'staff' && (
        <>
          {!staff.length && <Section><Empty pad={40}>No staff member matches that search.</Empty></Section>}
          <Section>
            {staff.map(s => (
              <Hov
                key={s.id}
                as="div"
                className="row"
                data-r="listrow"
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '11px 15px',
                  borderBottom: `1px solid ${C.lineFaint}`,
                }}
                hover={{ background: C.wash }}
              >
                <Avatar src={s.image} name={s.name} size={30} tone="light" />
                <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{s.id}</span>
                </div>
                <span style={{
                  width: 130, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: C.accentInk,
                }}>
                  {s.role}
                </span>
                <span data-grow style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: C.muted2 }}>
                  {s.duties || '—'}
                </span>
                <span style={{
                  width: 140, flexShrink: 0, fontFamily: MONO, fontSize: 11, color: C.muted,
                }}>
                  {s.phone || '—'}
                </span>
                <div className="row-actions" style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <Hov
                    as="button" type="button" title="Edit"
                    onClick={() => { setIsNew(false); setStaffDraft({ ...s }); }}
                    style={iconBtn} hover={{ borderColor: C.accent, color: C.ink }}
                  >
                    <Icon name="edit" size={12} />
                  </Hov>
                  <Hov
                    as="button" type="button" title="Remove"
                    onClick={() => setConfirm({
                      title: `Remove ${s.name}?`,
                      body: 'They are removed from the shared team directory for everyone.',
                      confirmLabel: 'Remove',
                      tone: 'danger',
                      run: () => {
                        commit({ staff: store.staff.filter(x => x.id !== s.id) });
                        toast(`${s.name} removed`);
                      },
                    })}
                    style={iconBtn} hover={{ borderColor: '#e0a3b3', color: C.bad }}
                  >
                    <Icon name="trash" size={12} />
                  </Hov>
                </div>
              </Hov>
            ))}
          </Section>
        </>
      )}

      {/* ── guide editor ── */}
      <Modal open={!!guideDraft} onClose={() => setGuideDraft(null)} width={460}>
        {guideDraft && (
          <>
            <ModalHead
              title={isNew ? 'New guide' : guideDraft.name || 'Edit guide'}
              sub="Guides appear in every assignment picker and on the manifests."
              onClose={() => setGuideDraft(null)}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <PhotoField
                src={guideDraft.image}
                name={guideDraft.name}
                uploading={uploading}
                inputRef={photoInput}
                onPick={pickPhoto}
                onClear={() => setGuideDraft({ ...guideDraft, image: '' })}
              />
              <Fld label="Name">
                <Input
                  value={guideDraft.name}
                  onChange={(e: any) => setGuideDraft({ ...guideDraft, name: e.target.value })}
                />
              </Fld>
              <div data-r="fields" style={{ display: 'flex', gap: 10 }}>
                <Fld label="Phone" grow>
                  <Input
                    value={guideDraft.phone}
                    onChange={(e: any) => setGuideDraft({ ...guideDraft, phone: e.target.value })}
                    placeholder="+39 …"
                  />
                </Fld>
                <Fld label="Availability">
                  <Select
                    value={guideDraft.avail}
                    onChange={(e: any) => setGuideDraft({ ...guideDraft, avail: e.target.value as Guide['avail'] })}
                    options={AVAIL.map(a => ({ v: a, t: a }))}
                    style={{ width: 128, background: C.panel }}
                  />
                </Fld>
              </div>
              <Fld label="Languages">
                <Input
                  value={guideDraft.langs}
                  onChange={(e: any) => setGuideDraft({ ...guideDraft, langs: e.target.value })}
                  placeholder="EN · IT · ES"
                />
              </Fld>
              <Fld label="Skills">
                <Input
                  value={guideDraft.skills}
                  onChange={(e: any) => setGuideDraft({ ...guideDraft, skills: e.target.value })}
                  placeholder="Colosseum, Roman Forum, VIP escort"
                />
              </Fld>

              <Reviews
                reviews={guideDraft.reviews}
                by={user.name}
                onChange={reviews => setGuideDraft({
                  ...guideDraft,
                  reviews,
                  rating: averageRating(reviews, 5),
                })}
              />
            </div>
            <ModalFoot>
              <Btn onClick={() => setGuideDraft(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={saveGuide}>Save guide</Btn>
            </ModalFoot>
          </>
        )}
      </Modal>

      {/* ── staff editor ── */}
      <Modal open={!!staffDraft} onClose={() => setStaffDraft(null)} width={460}>
        {staffDraft && (
          <>
            <ModalHead
              title={isNew ? 'New staff member' : staffDraft.name || 'Edit staff member'}
              sub="Office staff can be assigned to a group in place of a guide."
              onClose={() => setStaffDraft(null)}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <PhotoField
                src={staffDraft.image}
                name={staffDraft.name}
                uploading={uploading}
                inputRef={photoInput}
                onPick={pickPhoto}
                onClear={() => setStaffDraft({ ...staffDraft, image: '' })}
              />
              <Fld label="Name">
                <Input
                  value={staffDraft.name}
                  onChange={(e: any) => setStaffDraft({ ...staffDraft, name: e.target.value })}
                />
              </Fld>
              <div data-r="fields" style={{ display: 'flex', gap: 10 }}>
                <Fld label="Job title" grow>
                  <Input
                    value={staffDraft.role}
                    onChange={(e: any) => setStaffDraft({ ...staffDraft, role: e.target.value })}
                    placeholder="Owner / Operations / Reservations"
                  />
                </Fld>
                <Fld label="Phone" grow>
                  <Input
                    value={staffDraft.phone}
                    onChange={(e: any) => setStaffDraft({ ...staffDraft, phone: e.target.value })}
                  />
                </Fld>
              </div>
              <Fld label="Duties">
                <Input
                  value={staffDraft.duties}
                  onChange={(e: any) => setStaffDraft({ ...staffDraft, duties: e.target.value })}
                  placeholder="Grouping, guide dispatch, on-site support"
                />
              </Fld>
            </div>
            <ModalFoot>
              <Btn onClick={() => setStaffDraft(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={saveStaff}>Save</Btn>
            </ModalFoot>
          </>
        )}
      </Modal>
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 26, height: 26, border: `1px solid ${C.line}`, background: C.panel,
  borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: C.body, padding: 0, flexShrink: 0,
};

/**
 * The reviews behind a guide's score, on the card itself.
 *
 * Height is animated to the content's own measurement rather than to a
 * max-height guess, so three reviews and thirty both open at the right size
 * and neither snaps at the end.
 *
 * The `grid-template-rows: 0fr -> 1fr` idiom looks tidier but does not work
 * here: the inner wrapper needs `overflow: hidden` to clip while collapsed,
 * and an overflow container's automatic minimum size is zero, so the `fr`
 * track resolves to 0 in a container with no definite height and the panel
 * never opens. Measured and confirmed before switching to this.
 */
function ReviewPanel({ open, reviews }: { open: boolean; reviews: GuideReview[] }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // Re-measure when it opens and whenever the list changes underneath it.
  useEffect(() => {
    setHeight(open ? inner.current?.scrollHeight ?? 0 : 0);
  }, [open, reviews]);

  if (!reviews.length) return null;
  return (
    <div
      style={{
        height,
        overflow: 'hidden',
        opacity: open ? 1 : 0,
        marginTop: open ? 10 : 0,
        transition: 'height .32s var(--ease), opacity .24s ease, margin-top .32s var(--ease)',
      }}
      aria-hidden={!open}
    >
      <div ref={inner}>
        <div style={{
          border: `1px solid ${C.lineSoft}`, borderRadius: 7, background: C.wash,
          display: 'flex', flexDirection: 'column',
          maxHeight: 210, overflowY: 'auto',
        }}>
          {reviews.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                borderBottom: `1px solid ${C.lineFaint}`,
              }}
            >
              <Stars value={r.rating} size={10} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {r.note
                  ? (
                    <span style={{ fontSize: 11.5, lineHeight: 1.45, textWrap: 'pretty' }}>
                      {r.note}
                    </span>
                  )
                  : (
                    <span style={{ fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>
                      Rated {r.rating} of 5, no comment
                    </span>
                  )}
                <span style={{ fontSize: 10, color: C.muted }}>
                  {short(r.date)}{r.by ? ` · ${r.by}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Five stars, filled to `value`. Interactive when `onPick` is supplied. */
function Stars({
  value, size = 13, onPick,
}: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n => {
        const on = n <= Math.round(value);
        const star = (
          <Icon
            name="star"
            size={size}
            color={on ? C.accent : C.faint2}
            fill={on ? C.accent : 'none'}
          />
        );
        if (!onPick) return <span key={n} style={{ display: 'flex' }}>{star}</span>;
        return (
          <Hov
            key={n}
            as="button"
            type="button"
            title={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onPick(n)}
            style={{
              border: 0, background: 'transparent', padding: 1, cursor: 'pointer',
              display: 'flex', borderRadius: 3,
            }}
            hover={{ background: C.accentWash }}
          >
            {star}
          </Hov>
        );
      })}
    </span>
  );
}

/**
 * A guide's review history. The average shown everywhere else is derived from
 * these, so the score can always be traced back to the reviews behind it —
 * a hand-typed 5.0 told you nothing about how many people it represented.
 */
function Reviews({
  reviews, by, onChange,
}: { reviews: GuideReview[]; by: string; onChange: (r: GuideReview[]) => void }) {
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');

  const avg = averageRating(reviews, 0);

  const add = () => {
    onChange([
      {
        id: uid('rv'),
        date: today(),
        rating,
        note: note.trim(),
        by,
      },
      ...reviews,
    ]);
    setRating(5);
    setNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
          textTransform: 'uppercase', color: C.muted3,
        }}>
          Reviews
        </span>
        <div style={{ flex: 1 }} />
        {reviews.length > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
            <Stars value={avg} size={12} />
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{avg.toFixed(1)}</strong>
            <span style={{ color: C.muted }}>
              from {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </span>
          </span>
        )}
      </div>

      {/* new review */}
      <div style={{
        border: `1px solid ${C.line}`, borderRadius: 7, padding: '9px 11px',
        display: 'flex', flexDirection: 'column', gap: 8, background: C.wash,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Stars value={rating} onPick={setRating} />
          <span style={{ fontSize: 11.5, color: C.muted }}>
            {rating} of 5
          </span>
        </div>
        <div data-r="fields" style={{ display: 'flex', gap: 8 }}>
          <Input
            value={note}
            onChange={(e: any) => setNote(e.target.value)}
            placeholder="What did the traveller say?"
            style={{ flex: 1, background: C.panel }}
          />
          <Btn small icon="plus" onClick={add}>Add review</Btn>
        </div>
      </div>

      {reviews.length === 0 && (
        <span style={{ fontSize: 11.5, color: C.muted }}>
          No reviews yet — the score stays at 5.0 until the first one is recorded.
        </span>
      )}

      {reviews.length > 0 && (
        <div style={{
          maxHeight: 190, overflowY: 'auto', border: `1px solid ${C.lineSoft}`,
          borderRadius: 7, display: 'flex', flexDirection: 'column',
        }}>
          {reviews.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 11px',
                borderBottom: `1px solid ${C.lineFaint}`,
              }}
            >
              <Stars value={r.rating} size={11} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {r.note && (
                  <span style={{ fontSize: 11.5, lineHeight: 1.45, textWrap: 'pretty' }}>
                    {r.note}
                  </span>
                )}
                <span style={{ fontSize: 10, color: C.muted }}>
                  {short(r.date)}{r.by ? ` · ${r.by}` : ''}
                </span>
              </div>
              <Hov
                as="button"
                type="button"
                title="Remove this review"
                onClick={() => onChange(reviews.filter(x => x.id !== r.id))}
                style={{
                  width: 20, height: 20, flexShrink: 0, border: 0, background: 'transparent',
                  borderRadius: 4, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: C.faint2, padding: 0,
                }}
                hover={{ color: C.bad, background: C.badBg }}
              >
                <Icon name="x" size={11} width={2.6} />
              </Hov>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Photo if there is one, the initial if not. A guide whose photo 404s (the
 * bucket object was removed) falls back rather than showing a broken image.
 */
function Avatar({
  src, name, size, tone = 'dark',
}: { src: string; name: string; size: number; tone?: 'dark' | 'light' }) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.23);
  const box: React.CSSProperties = { width: size, height: size, flexShrink: 0, borderRadius: radius };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ ...box, objectFit: 'cover', display: 'block', border: `1px solid ${C.line}` }}
      />
    );
  }
  return (
    <span style={{
      ...box,
      background: tone === 'dark' ? C.ink : C.paper,
      color: tone === 'dark' ? C.accent : C.body,
      border: tone === 'dark' ? undefined : `1px solid ${C.line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.37), fontWeight: 700,
    }}>
      {name.charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function PhotoField({
  src, name, uploading, inputRef, onPick, onClear,
}: {
  src: string;
  name: string;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File | undefined) => void | Promise<void>;
  onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        Photo
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar src={src} name={name} size={54} />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={e => void onPick(e.target.files?.[0])}
        />
        <Btn
          small
          icon={uploading ? 'spinner' : 'upload'}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : src ? 'Replace photo' : 'Upload photo'}
        </Btn>
        {src && !uploading && <Btn small onClick={onClear}>Remove</Btn>}
      </div>
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
