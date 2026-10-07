import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Empty, Hov, Input, MONO, Modal, ModalFoot, ModalHead, Section, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { uploadFile } from '../lib/upload';
import { today } from '../utils/dates';
import { PRESET_COLORS, hexOrBlank, swatchFill } from '../utils/colors';
import { RollingNumber } from '../ui/RollingNumber';
import type { Product, ProductOption } from '../types';
import type { ViewProps } from './types';

export function ToursView({ store, setConfirm }: ViewProps) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const t = today();

  const usage = useMemo(() => {
    const m = new Map<string, { upcoming: number; pax: number }>();
    for (const b of store.bookings) {
      if (b.status === 'Cancelled') continue;
      const e = m.get(b.code) ?? { upcoming: 0, pax: 0 };
      if (b.date >= t) { e.upcoming += 1; e.pax += b.travelers.length; }
      m.set(b.code, e);
    }
    return m;
  }, [store.bookings, t]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.products.filter(p =>
      !q || p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) || p.label.toLowerCase().includes(q));
  }, [store.products, query]);

  const startNew = () => {
    setIsNew(true);
    setEditing({
      code: '', name: '', label: '', defaultCap: 7,
      options: [{ tg: 'TG1', title: 'Standard', cap: 7, color: '', color2: '' }],
      image: '',
    });
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await uploadFile('products', file);
      setEditing(e => (e ? { ...e, image: url } : e));
      toast('Photo attached — save the tour to keep it');
    } catch (err) {
      toast((err as Error).message || 'Upload failed', 'bad');
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const save = () => {
    if (!editing) return;
    if (!editing.code.trim()) { toast('A product code is required.', 'bad'); return; }
    if (!editing.name.trim()) { toast('A short name is required.', 'bad'); return; }

    const clean: Product = {
      ...editing,
      code: editing.code.trim(),
      name: editing.name.trim(),
      label: editing.label.trim() || editing.name.trim(),
      options: editing.options.filter(o => o.tg.trim()),
    };

    const exists = store.products.some(p => p.code === clean.code);
    if (isNew && exists) { toast(`${clean.code} is already in the catalogue.`, 'bad'); return; }

    commit({
      products: exists
        ? store.products.map(p => (p.code === clean.code ? clean : p))
        : [...store.products, clean],
    });
    setEditing(null);
    toast(exists ? 'Tour saved' : 'Tour added');
  };

  const remove = (p: Product) => {
    const inUse = store.bookings.some(b => b.code === p.code);
    setConfirm({
      title: `Delete ${p.name}?`,
      body: inUse
        ? 'Bookings still reference this product code. They will keep working but will show the raw code instead of a name.'
        : 'It is removed from the shared catalogue for everyone.',
      confirmLabel: 'Delete',
      tone: 'danger',
      run: () => {
        commit({ products: store.products.filter(x => x.code !== p.code) });
        toast('Tour deleted');
      },
    });
  };

  const setOption = (i: number, patch: Partial<ProductOption>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      options: editing.options.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    });
  };

  /* Colours are set straight from the list rather than only inside the editor:
     choosing them is a quick visual job usually done while looking at Grouping,
     and making someone open a modal, save and close for one swatch is friction
     with nothing to show for it. */
  const setListColor = (code: string, tg: string, patch: Partial<ProductOption>) => {
    commit({
      products: store.products.map(p => (p.code !== code ? p : {
        ...p,
        options: p.options.map(o => (o.tg === tg ? { ...o, ...patch } : o)),
      })),
    });
  };

  return (
    <>
      <div data-r="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div data-grow style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Icon
            name="search"
            size={13}
            color={C.muted3}
            style={{ position: 'absolute', left: 9, pointerEvents: 'none' }}
          />
          <Input
            value={query}
            onChange={(e: any) => setQuery(e.target.value)}
            placeholder="Search a tour or product code"
            style={{ width: 260, paddingLeft: 28, background: C.panel }}
          />
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>
          <RollingNumber value={list.length} /> of{' '}
          <RollingNumber value={store.products.length} /> products
        </span>
        <div style={{ flex: 1 }} />
        <Btn variant="primary" icon="plus" style={{ padding: '6px 11px', fontSize: 12 }} onClick={startNew}>
          New tour
        </Btn>
      </div>

      {!list.length && (
        <Section><Empty pad={40}>No product matches that search.</Empty></Section>
      )}

      {/* One product per row rather than a card grid: the catalogue is read
          top-to-bottom when someone is looking for a tour code, and the nested
          options belong visually underneath their parent. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map(p => {
          const u = usage.get(p.code);
          const openEditor = () => {
            setIsNew(false);
            setEditing({ ...p, options: p.options.map(o => ({ ...o })) });
          };
          return (
            <Section key={p.code} className="up lift-shadow">
              <div data-r="listrow" style={{
                display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px',
              }}>
                <Thumb src={p.image} name={p.name} />

                <span style={{
                  fontFamily: MONO, fontSize: 10.5, color: C.body, background: C.paper,
                  borderRadius: 5, padding: '3px 8px', flexShrink: 0, marginTop: 1,
                }}>
                  {p.code}
                </span>

                <div data-grow style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, textWrap: 'pretty' }}>
                    {p.name}
                  </h3>
                  <p style={{
                    margin: '3px 0 0', fontSize: 11.5, color: C.muted2,
                    lineHeight: 1.5, textWrap: 'pretty',
                  }}>
                    {p.label}
                  </p>
                </div>

                <span style={{
                  fontSize: 11, color: C.muted, flexShrink: 0,
                  whiteSpace: 'nowrap', marginTop: 2,
                }}>
                  <RollingNumber value={u?.upcoming ?? 0} style={{ color: C.ink, fontWeight: 700 }} />
                  {' '}bookings ·{' '}
                  <RollingNumber value={u?.pax ?? 0} style={{ color: C.ink, fontWeight: 700 }} />
                  {' '}pax
                </span>

                <div className="row-actions" style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <Hov
                    as="button"
                    type="button"
                    title="Edit"
                    onClick={openEditor}
                    style={iconBtn}
                    hover={{ borderColor: C.accent, color: C.ink }}
                  >
                    <Icon name="edit" size={12} />
                  </Hov>
                  <Hov
                    as="button"
                    type="button"
                    title="Delete"
                    onClick={() => remove(p)}
                    style={iconBtn}
                    hover={{ borderColor: '#e0a3b3', color: C.bad }}
                  >
                    <Icon name="trash" size={12} />
                  </Hov>
                </div>
              </div>

              <div style={{
                padding: '0 15px 12px', display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                {/* The colours themselves belong to Grouping and are deliberately
                    not painted here: the catalogue is read to find a tour code,
                    and tinting these rows turned a reference list into a second
                    colour chart competing with the one that matters. The swatches
                    stay because this is where a colour is chosen — they show the
                    current pick without colouring the row around them. */}
                {p.options.map(o => (
                  <div key={o.tg} style={{
                    display: 'flex', alignItems: 'center', gap: 9, fontSize: 11.5,
                    border: `1px solid ${C.lineFaint}`, background: C.wash,
                    borderRadius: 6, padding: '6px 10px',
                  }}>
                    <span style={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 600,
                      color: C.accentInk, flexShrink: 0,
                    }}>
                      {o.tg}
                    </span>
                    <span style={{
                      flex: 1, minWidth: 0, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {o.title}
                    </span>

                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <ColorPick
                        value={o.color}
                        label="Colour"
                        onPick={hex => setListColor(p.code, o.tg, { color: hex })}
                      />
                      <ColorPick
                        value={o.color2}
                        label="Second colour"
                        onPick={hex => setListColor(p.code, o.tg, { color2: hex })}
                      />
                    </div>

                    <span style={{ fontSize: 10.5, color: C.muted, flexShrink: 0 }}>
                      max {o.cap}
                    </span>
                  </div>
                ))}

                <Hov
                  as="button"
                  type="button"
                  onClick={openEditor}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', border: `1px dashed ${C.border}`, background: 'transparent',
                    borderRadius: 6, padding: '6px 10px', fontSize: 11.5, fontWeight: 500,
                    color: C.muted, cursor: 'pointer',
                  }}
                  hover={{ borderColor: C.accent, color: C.ink }}
                >
                  <Icon name="plus" size={12} />
                  Add tour option
                </Hov>
              </div>
            </Section>
          );
        })}
      </div>

      {/* ── editor ── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} width={520}>
        {editing && (
          <>
            <ModalHead
              title={isNew ? 'New tour' : editing.name || 'Edit tour'}
              sub="Product codes must match the Viator export so imports land on the right tour."
              onClose={() => setEditing(null)}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div data-r="fields" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ width: 170, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Micro>Product code</Micro>
                  <Input
                    value={editing.code}
                    disabled={!isNew}
                    onChange={(e: any) => setEditing({ ...editing, code: e.target.value })}
                    placeholder="5524558P1"
                  />
                </label>
                <label style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Micro>Short name</Micro>
                  <Input
                    value={editing.name}
                    onChange={(e: any) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Colosseo guide"
                  />
                </label>
                <label style={{ width: 96, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Micro>Default cap</Micro>
                  <Input
                    type="number"
                    min={1}
                    value={String(editing.defaultCap)}
                    onChange={(e: any) => setEditing({ ...editing, defaultCap: Number(e.target.value) || 1 })}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Micro>Full title</Micro>
                <Input
                  value={editing.label}
                  onChange={(e: any) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Guided Tour of Colosseum, Roman Forum & Palatine Hill"
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Micro>Photo</Micro>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Thumb src={editing.image} name={editing.name} size={54} />
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => void pickPhoto(e.target.files?.[0])}
                  />
                  <Btn
                    small
                    icon={uploading ? 'spinner' : 'upload'}
                    disabled={uploading}
                    onClick={() => photoInput.current?.click()}
                  >
                    {uploading ? 'Uploading…' : editing.image ? 'Replace photo' : 'Upload photo'}
                  </Btn>
                  {editing.image && !uploading && (
                    <Btn small onClick={() => setEditing({ ...editing, image: '' })}>Remove</Btn>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Micro>Tour options</Micro>
                  <div style={{ flex: 1 }} />
                  <Btn
                    small
                    icon="plus"
                    onClick={() => setEditing({
                      ...editing,
                      options: [...editing.options, {
                        tg: `TG${editing.options.length + 1}`,
                        title: '',
                        cap: editing.defaultCap,
                        color: '', color2: '',
                      }],
                    })}
                  >
                    Add option
                  </Btn>
                </div>

                {editing.options.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Input
                      value={o.tg}
                      onChange={(e: any) => setOption(i, { tg: e.target.value })}
                      placeholder="TG1"
                      style={{ width: 72, fontFamily: MONO, fontSize: 11.5 }}
                    />
                    <Input
                      value={o.title}
                      onChange={(e: any) => setOption(i, { title: e.target.value })}
                      placeholder="Semi Private (max 7 people)"
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={String(o.cap)}
                      onChange={(e: any) => setOption(i, { cap: Number(e.target.value) || 1 })}
                      style={{ width: 68 }}
                    />
                    <ColorPick
                      value={o.color}
                      label="Colour"
                      onPick={hex => setOption(i, { color: hex })}
                    />
                    <ColorPick
                      value={o.color2}
                      label="Second colour"
                      onPick={hex => setOption(i, { color2: hex })}
                    />
                    <Hov
                      as="button"
                      type="button"
                      title="Remove option"
                      onClick={() => setEditing({
                        ...editing, options: editing.options.filter((_, j) => j !== i),
                      })}
                      style={{ ...iconBtn, width: 28, height: 30 }}
                      hover={{ borderColor: '#e0a3b3', color: C.bad }}
                    >
                      <Icon name="x" size={12} />
                    </Hov>
                  </div>
                ))}
              </div>
            </div>
            <ModalFoot>
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={save}>Save tour</Btn>
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
  cursor: 'pointer', color: C.body, padding: 0,
};

/**
 * Product photo, falling back to the initial so a row never collapses — and
 * falling back the same way when the bucket object behind the URL is gone.
 */
function Thumb({ src, name, size = 40 }: { src: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box: React.CSSProperties = {
    width: size, height: size, flexShrink: 0, borderRadius: 7,
    border: `1px solid ${C.line}`,
  };
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ ...box, objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div style={{
      ...box, background: C.ink, color: C.accent, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.4), fontWeight: 700,
    }}>
      {(name.trim()[0] || '?').toUpperCase()}
    </div>
  );
}

function Micro({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
      textTransform: 'uppercase', color: C.muted3,
    }}>
      {children}
    </span>
  );
}

/**
 * One colour slot on a tour option.
 *
 * The full picker lives behind the swatch rather than being an always-visible
 * `input[type=color]`, for one practical reason: a native colour input fires a
 * change on every pixel of a drag, and this writes straight to the shared
 * catalogue. Holding the choice locally and reporting it once — on a preset
 * click, or when the panel closes — turns what would be a hundred writes into
 * one, and keeps a half-dragged colour off every other operator's screen.
 */
const PICKER_W = 176;
const PICKER_H = 172;

function ColorPick({
  value, label, onPick,
}: { value: string; label: string; onPick: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Reopening on a colour someone else changed should show their colour.
  useEffect(() => { if (!open) setDraft(value); }, [value, open]);

  const close = (commitDraft: boolean) => {
    setOpen(false);
    if (commitDraft && hexOrBlank(draft) !== hexOrBlank(value)) onPick(hexOrBlank(draft));
  };

  /**
   * Where to put the panel.
   *
   * The root carries `zoom`, which scales everything inside it — the panel's
   * own width and height included — while getBoundingClientRect reports the
   * already-scaled result. Mixing the two units puts the panel roughly a tenth
   * of the page away from its swatch, further off the wider the screen.
   *
   * So the measurement is converted into the same CSS pixels the `top` and
   * `left` values are read in, and every comparison below happens in that one
   * unit.
   */
  const place = () => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const z = Number(getComputedStyle(document.documentElement).zoom) || 1;
    const swatch = { top: r.top / z, bottom: r.bottom / z, right: r.right / z };
    const vw = window.innerWidth / z;
    const vh = window.innerHeight / z;

    // Hangs below the swatch, flipping above when the row is near the bottom of
    // the window — which is where the last tour in a long catalogue always is.
    let top = swatch.bottom + 6;
    if (top + PICKER_H > vh - 8) top = Math.max(8, swatch.top - PICKER_H - 6);

    // Right-aligned to the swatch, pulled back in if that would overhang.
    let left = swatch.right - PICKER_W;
    if (left + PICKER_W > vw - 8) left = vw - 8 - PICKER_W;
    if (left < 8) left = 8;

    setAt({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      // The panel is portalled out of this subtree, so it needs checking too or
      // clicking inside it would count as clicking away.
      if (!box.current?.contains(t) && !panel.current?.contains(t)) close(true);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    // Anything that moves the swatch moves the panel with it.
    const track = () => place();
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  });

  const set = value ? swatchFill(value, '') : '';

  return (
    <div ref={box} style={{ position: 'relative', flexShrink: 0 }}>
      <Hov
        as="button"
        type="button"
        title={value ? `${label} — ${value}` : `${label} — not set`}
        aria-label={label}
        onClick={() => setOpen(o => !o)}
        style={{
          width: 26, height: 22, borderRadius: 5, cursor: 'pointer', padding: 0,
          background: set || 'transparent',
          border: set ? `1px solid rgba(0,0,0,.22)` : `1px dashed ${C.border}`,
        }}
        hover={{ borderColor: set ? 'rgba(0,0,0,.42)' : C.accent }}
      />

      {/* Every tour sits in a Section, and a Section clips its children so its
          rounded corners hold. A panel anchored inside one is therefore cut off
          at the card edge — which is what operations hit: only the first row of
          colours was reachable. Rendering it at the top of the document takes it
          out of reach of that clip, and of any stacking context along the way. */}
      {open && at && createPortal(
        <div
          ref={panel}
          className="up-sm"
          style={{
            // Above the tour editor (200), which also holds swatches, and below
            // the toasts (300) so a save confirmation is never hidden by it.
            position: 'fixed', top: at.top, left: at.left, zIndex: 260, width: PICKER_W,
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
            boxShadow: '0 10px 26px rgba(16,24,40,.16)', padding: 9,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <Micro>{label}</Micro>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
            {PRESET_COLORS.map(hex => (
              <Hov
                key={hex}
                as="button"
                type="button"
                title={hex}
                onClick={() => { setDraft(hex); setOpen(false); onPick(hex); }}
                style={{
                  height: 22, borderRadius: 4, cursor: 'pointer', background: hex,
                  border: hexOrBlank(draft) === hex
                    ? '2px solid #0b1220' : '1px solid rgba(0,0,0,.18)',
                  padding: 0,
                }}
                hover={{ transform: 'scale(1.08)' }}
              />
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
            <input
              type="color"
              value={hexOrBlank(draft) || '#cccccc'}
              onChange={e => setDraft(e.target.value)}
              style={{
                width: 30, height: 24, padding: 0, cursor: 'pointer',
                border: `1px solid ${C.line}`, borderRadius: 5, background: C.panel,
              }}
            />
            <span style={{ color: C.muted2 }}>Custom</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
              {hexOrBlank(draft) || '—'}
            </span>
          </label>

          <div style={{ display: 'flex', gap: 6 }}>
            <Btn small style={{ flex: 1 }} onClick={() => { setDraft(''); setOpen(false); onPick(''); }}>
              No colour
            </Btn>
            <Btn small variant="primary" style={{ flex: 1 }} onClick={() => close(true)}>
              Done
            </Btn>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
