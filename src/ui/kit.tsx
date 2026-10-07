/* ══════════════════════════════════════════════════════════════════════════
   Design primitives.

   Every value here is copied from design/SOLE.dc.html. The handoff expressed
   hover and focus states as `style-hover` / `style-focus` attributes that its
   runtime resolved; inline styles in React cannot carry pseudo-classes, so
   `Hov` reproduces them with mouse/focus state instead. Same pixels, same
   colours, same easing — just a different mechanism.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { uid } from '../utils/dates';

export { Icon };
export type { IconName };

export const MONO = "'JetBrains Mono', monospace";

export const C = {
  /* Kept in step with the :root custom properties in index.css — the same
     surfaces, softened away from pure white so a full shift on this screen is
     not tiring. See the note there for the reasoning. */
  ink: '#0b1220',
  inkHover: '#1b2437',
  paper: '#eef1f5',
  panel: '#fbfcfd',
  line: '#e2e6ec',
  lineSoft: '#eaedf2',
  lineFaint: '#eff2f6',
  border: '#dce1e8',
  text: '#0b1220',
  body: '#5b6472',
  muted: '#8a919e',
  muted2: '#79818f',
  muted3: '#98a0ac',
  faint: '#a4abb6',
  faint2: '#b9bfc8',
  accent: '#fd9707',
  accentInk: '#b26100',
  accentWash: '#fffaf2',
  /* Focus halo. Functional affordance, not decoration — the one place the flat
     rule bends, because a 1px border alone is not a legible focus state. */
  accentRing: 'rgba(253,151,7,.12)',
  wash: '#f5f7fa',
  /* Row banding. One reservation's travellers share a tint, and consecutive
     reservations alternate, so group size is readable without counting. Kept
     at the very edge of perceptible — the operator stares at this list for
     hours, and anything stronger turns a table into a colour chart. */
  bandA: '#f3f9f5', bandAHover: '#eaf4ee',
  bandB: '#f2f7fc', bandBHover: '#e7f0f9',
  good: '#0f6b48', goodBg: '#e8f5ef',
  warn: '#8a5106', warnBg: '#fdf3e3',
  bad: '#9c2743', badBg: '#fdecef', badLine: '#f3c9d2',
  info: '#1f4e8c', infoBg: '#eaf1fb',
} as const;

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Confirmed: { bg: C.goodBg, fg: C.good },
  Modified: { bg: C.infoBg, fg: C.info },
  Pending: { bg: C.warnBg, fg: C.warn },
  Cancelled: { bg: C.badBg, fg: C.bad },
};

export const PAY_COLORS: Record<string, { bg: string; fg: string }> = {
  Paid: { bg: C.goodBg, fg: C.good },
  'Partly paid': { bg: C.warnBg, fg: C.warn },
  Unpaid: { bg: C.badBg, fg: C.bad },
  // Both refunds read as "money went back out", so they share the neutral
  // treatment — a refund is not an error state, it is a closed one.
  'Full refund': { bg: C.paper, fg: C.body },
  'Partial refund': { bg: C.infoBg, fg: C.info },
  // Legacy wire value, in case a row is read before the mapper touches it.
  Refunded: { bg: C.paper, fg: C.body },
};

/* ── hover / focus wrapper ──────────────────────────────────────────────── */
type HovProps = {
  as?: 'div' | 'button' | 'span' | 'label' | 'section' | 'a' | 'li' | 'tr' | 'td';
  style?: CSSProperties;
  hover?: CSSProperties;
  children?: ReactNode;
  [key: string]: any;
};

export function Hov({ as = 'div', style, hover, children, ...rest }: HovProps) {
  const [on, setOn] = useState(false);
  const Tag = as as any;
  const enter = (e: any) => { setOn(true); rest.onMouseEnter?.(e); };
  const leave = (e: any) => { setOn(false); rest.onMouseLeave?.(e); };
  return (
    <Tag
      {...rest}
      onMouseEnter={enter}
      onMouseLeave={leave}
      style={on && hover ? { ...style, ...hover } : style}
    >
      {children}
    </Tag>
  );
}

/* ── buttons ────────────────────────────────────────────────────────────── */
type Variant = 'primary' | 'ghost' | 'quiet' | 'danger' | 'accent';

const BTN_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 0,
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  padding: '7px 14px',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};

const VARIANTS: Record<Variant, { style: CSSProperties; hover: CSSProperties }> = {
  primary: {
    style: { background: C.ink, color: '#fff' },
    hover: { background: C.inkHover },
  },
  ghost: {
    style: {
      borderWidth: 1, borderStyle: 'solid', borderColor: C.line,
      background: C.panel, color: C.body, fontWeight: 500,
    },
    hover: { borderColor: C.accent, color: C.ink },
  },
  quiet: {
    style: { background: 'transparent', color: C.body, fontWeight: 500 },
    hover: { background: C.paper, color: C.ink },
  },
  danger: {
    style: { background: C.bad, color: '#fff' },
    hover: { background: '#84203a' },
  },
  accent: {
    style: { background: C.accent, color: C.ink },
    hover: { background: '#e88a05' },
  },
};

interface BtnProps {
  variant?: Variant;
  icon?: IconName;
  iconSize?: number;
  small?: boolean;
  style?: CSSProperties;
  hover?: CSSProperties;
  children?: ReactNode;
  [key: string]: any;
}

export function Btn({
  variant = 'ghost', icon, iconSize, small, style, hover, children, className, ...rest
}: BtnProps) {
  const v = VARIANTS[variant];
  const size: CSSProperties = small
    ? { padding: '4px 9px', fontSize: 11.5, borderRadius: 5 }
    : {};
  return (
    <Hov
      as="button"
      type="button"
      // The hover lift lives in CSS, not in `hover` above: an inline transform
      // would outrank the :active rule and kill the press feedback at exactly
      // the moment the pointer is over the button.
      className={['btn', className].filter(Boolean).join(' ')}
      {...rest}
      style={{ ...BTN_BASE, ...v.style, ...size, ...style }}
      hover={rest.disabled ? undefined : { ...v.hover, ...hover }}
    >
      {icon && <Icon name={icon} size={iconSize ?? (small ? 12 : 13)} />}
      {children}
    </Hov>
  );
}

/** Square icon-only control, e.g. the range steppers. */
export function IconBtn({
  icon, size = 30, title, style, ...rest
}: { icon: IconName; size?: number; title?: string; style?: CSSProperties; [k: string]: any }) {
  return (
    <Hov
      as="button"
      type="button"
      title={title}
      aria-label={title}
      {...rest}
      style={{
        width: size, height: size, borderWidth: 1, borderStyle: 'solid', borderColor: C.border,
        background: C.panel,
        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: C.body, flexShrink: 0, padding: 0, ...style,
      }}
      hover={{ borderColor: C.accent, color: C.ink }}
    >
      <Icon name={icon} size={Math.round(size * 0.43)} />
    </Hov>
  );
}

/* ── surfaces ───────────────────────────────────────────────────────────── */
export function Card({
  style, className = 'up lift', hover, children, ...rest
}: { style?: CSSProperties; className?: string; hover?: CSSProperties; children?: ReactNode; [k: string]: any }) {
  return (
    <Hov
      as="div"
      className={className}
      {...rest}
      style={{
        background: C.panel, borderWidth: 1, borderStyle: 'solid', borderColor: C.line,
        borderRadius: 8, ...style,
      }}
      hover={hover ?? { borderColor: '#cfd4dc' }}
    >
      {children}
    </Hov>
  );
}

export function Section({
  style, className = 'up', children, ...rest
}: { style?: CSSProperties; className?: string; children?: ReactNode; [k: string]: any }) {
  return (
    <section
      className={className}
      {...rest}
      style={{
        background: C.panel, borderWidth: 1, borderStyle: 'solid', borderColor: C.line,
        borderRadius: 8, overflow: 'hidden', ...style,
      }}
    >
      {children}
    </section>
  );
}

export function SectionHead({
  title, note, children, style,
}: { title: ReactNode; note?: ReactNode; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      data-r="sechead"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 15px',
        // Fixed height so a header carrying buttons sits on the same baseline as
        // one carrying only a title — otherwise stacked sections drift apart.
        minHeight: 46,
        borderBottom: `1px solid ${C.lineSoft}`, flexShrink: 0, ...style,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{title}</h2>
      {note && <span style={{ fontSize: 11, color: C.muted }}>{note}</span>}
      <div style={{ flex: 1 }} />
      {children}
    </div>
  );
}

export function Empty({ children, pad = 28 }: { children: ReactNode; pad?: number }) {
  return (
    <p style={{
      margin: '0 auto', maxWidth: 380, padding: `${pad}px 16px`, textAlign: 'center',
      fontSize: 12, color: C.muted, lineHeight: 1.6, textWrap: 'pretty',
    }}>
      {children}
    </p>
  );
}

/** Uppercase micro-label used above every stat and field. */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '.09em',
      textTransform: 'uppercase', color: C.muted2, ...style,
    }}>
      {children}
    </span>
  );
}

export function Tag({
  children, bg = C.paper, fg = C.body, style,
}: { children: ReactNode; bg?: string; fg?: string; style?: CSSProperties }) {
  return (
    <span style={{
      flexShrink: 0, fontSize: 9, fontWeight: 600, letterSpacing: '.06em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
      background: bg, color: fg, ...style,
    }}>
      {children}
    </span>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: MONO, ...style }}>{children}</span>;
}

/* ── form controls ──────────────────────────────────────────────────────── */
/* Borders are declared as longhands throughout this file. Call sites routinely
   override just `borderColor` (an error state, a drag target, a focus ring);
   mixing that with the `border` shorthand makes React drop one of the two on
   re-render and warn about it. */
const FIELD_BASE: CSSProperties = {
  height: 30,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: C.border,
  background: C.wash,
  borderRadius: 6,
  padding: '0 9px',
  fontSize: 12.5,
  color: C.ink,
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
};

function useFocusRing() {
  const [on, setOn] = useState(false);
  return {
    focused: on,
    bind: { onFocus: () => setOn(true), onBlur: () => setOn(false) },
    style: on
      ? { borderColor: C.accent, background: C.panel, boxShadow: `0 0 0 3px ${C.accentRing}` }
      : undefined,
  };
}

export function Input({ style, ...rest }: { style?: CSSProperties; [k: string]: any }) {
  const f = useFocusRing();
  return (
    <input
      {...rest}
      onFocus={e => { f.bind.onFocus(); rest.onFocus?.(e); }}
      onBlur={e => { f.bind.onBlur(); rest.onBlur?.(e); }}
      style={{ ...FIELD_BASE, ...style, ...f.style }}
    />
  );
}

export function Textarea({ style, ...rest }: { style?: CSSProperties; [k: string]: any }) {
  const f = useFocusRing();
  return (
    <textarea
      {...rest}
      onFocus={e => { f.bind.onFocus(); rest.onFocus?.(e); }}
      onBlur={e => { f.bind.onBlur(); rest.onBlur?.(e); }}
      style={{
        ...FIELD_BASE, height: 'auto', padding: '8px 9px', lineHeight: 1.55,
        resize: 'vertical', ...style, ...f.style,
      }}
    />
  );
}

export function Select({
  options, style, ...rest
}: { options: { v: string; t: string }[]; style?: CSSProperties; [k: string]: any }) {
  const f = useFocusRing();
  return (
    <select
      {...rest}
      onFocus={e => { f.bind.onFocus(); rest.onFocus?.(e); }}
      onBlur={e => { f.bind.onBlur(); rest.onBlur?.(e); }}
      style={{ ...FIELD_BASE, cursor: 'pointer', ...style, ...f.style }}
    >
      {options.map(o => (
        <option key={o.v} value={o.v}>{o.t}</option>
      ))}
    </select>
  );
}

/** Labelled field used throughout the drawers and forms. */
export function Field({
  label, hint, children, style,
}: { label: ReactNode; hint?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, ...style }}>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10.5, color: C.muted }}>{hint}</span>}
    </label>
  );
}

/* ── modal ──────────────────────────────────────────────────────────────── */
export function Modal({
  open, onClose, width = 460, children, labelledBy,
}: {
  open: boolean; onClose: () => void; width?: number;
  children: ReactNode; labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fade"
      data-r="modalwrap"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(11,18,32,.28)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      }}
    >
      <div
        className="pop"
        data-r="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{
          // dvh, not vh: a phone's collapsing address bar otherwise leaves the
          // footer buttons under the browser chrome. Divided by --ui-scale for
          // the same reason the shell is — <html> carries a zoom.
          width: '100%', maxWidth: width,
          maxHeight: 'calc(90dvh / var(--ui-scale))', overflowY: 'auto',
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10,
          boxShadow: '0 24px 60px rgba(11,18,32,.2)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHead({
  title, sub, onClose, id,
}: { title: ReactNode; sub?: ReactNode; onClose: () => void; id?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px',
      borderBottom: `1px solid ${C.lineSoft}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 id={id} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h2>
        {sub && (
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
            {sub}
          </p>
        )}
      </div>
      <IconBtn icon="x" size={26} title="Close" onClick={onClose} />
    </div>
  );
}

export function ModalFoot({ children }: { children: ReactNode }) {
  return (
    <div data-r="modalfoot" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      padding: '12px 16px', borderTop: `1px solid ${C.lineSoft}`, background: C.wash,
    }}>
      {children}
    </div>
  );
}

export interface ConfirmSpec {
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  run: () => void;
}

export function ConfirmDialog({
  spec, onClose,
}: { spec: ConfirmSpec | null; onClose: () => void }) {
  return (
    <Modal open={!!spec} onClose={onClose} width={400}>
      {spec && (
        <>
          <div style={{ padding: '18px 18px 4px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: spec.tone === 'danger' ? C.badBg : C.paper,
              border: `1px solid ${spec.tone === 'danger' ? C.badLine : C.line}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <Icon name="alert" size={16} color={spec.tone === 'danger' ? C.bad : C.body} />
            </div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{spec.title}</h2>
            <p style={{
              margin: '6px 0 16px', fontSize: 12, color: C.muted2,
              lineHeight: 1.55, textWrap: 'pretty',
            }}>
              {spec.body}
            </p>
          </div>
          <ModalFoot>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn
              variant={spec.tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => { spec.run(); onClose(); }}
            >
              {spec.confirmLabel || 'Confirm'}
            </Btn>
          </ModalFoot>
        </>
      )}
    </Modal>
  );
}

/* ── toasts ─────────────────────────────────────────────────────────────── */
export type ToastTone = 'ok' | 'warn' | 'bad';
interface Toast { id: string; text: string; tone: ToastTone }

const ToastCtx = createContext<(text: string, tone?: ToastTone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

const TONE_DOT: Record<ToastTone, string> = {
  ok: '#5ad1a0', warn: '#fdb44e', bad: '#ff9a9a',
};

export function ToastHost({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const push = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = uid('t');
    setToasts(list => [...list, { id, text, tone }]);
    timers.current.push(
      setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 3600),
    );
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div
          data-r="toasts"
          aria-live="polite"
          style={{
            position: 'fixed', right: 16, bottom: 16, zIndex: 300,
            display: 'flex', flexDirection: 'column', gap: 7, pointerEvents: 'none',
          }}
        >
          {toasts.map(t => (
            <div
              key={t.id}
              className="slide-r"
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: C.ink, color: '#fff', borderRadius: 7,
                padding: '9px 13px', fontSize: 12, fontWeight: 500,
                boxShadow: '0 12px 30px rgba(11,18,32,.24)', maxWidth: 340,
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: TONE_DOT[t.tone], flexShrink: 0,
              }} />
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/**
 * Marks a reservation somebody has written a note against.
 *
 * A note is written so it can be acted on later, but it lived inside the
 * drawer — invisible until the booking was opened, which meant scanning a
 * table row by row to find the ones that mattered. The dot puts it on the row,
 * and hovering shows the note itself, so most of the time the drawer does not
 * need opening at all.
 *
 * When there is no note it renders a spacer of the same width, so references
 * stay on one vertical line instead of jogging left and right down the table.
 */
export function NoteDot({ notes, size = 7 }: { notes?: string; size?: number }) {
  const note = (notes || '').trim();
  if (!note) return <span aria-hidden style={{ width: size, flexShrink: 0 }} />;
  return (
    <span
      title={`Note: ${note}`}
      aria-label={`Has a note: ${note}`}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: C.bad, boxShadow: `0 0 0 2px rgba(200,62,88,.16)`,
      }}
    />
  );
}
