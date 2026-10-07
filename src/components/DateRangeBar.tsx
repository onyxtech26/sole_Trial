import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { C, Hov, IconBtn, Select } from '../ui/kit';
import {
  MONTH_NAMES, WEEKDAY_LABELS, addDays, addMonths, iso, parseISO,
  rangeFor, rangeLabelFor, today, type RangeMode,
} from '../utils/dates';

export interface RangeState {
  mode: RangeMode;
  anchor: string;   // start (or the single day / the day inside the week or month)
  end: string;      // only meaningful in custom mode
}

export const initialRange = (): RangeState => ({
  mode: 'today', anchor: today(), end: today(),
});

export const rangeOf = (r: RangeState): [string, string] =>
  rangeFor(r.mode, r.anchor, r.end);

const TABS: { id: RangeMode; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

interface Props {
  value: RangeState;
  onChange: (r: RangeState) => void;
  summary?: string;
  children?: React.ReactNode;
}

export function DateRangeBar({ value, onChange, summary, children }: Props) {
  const [calOpen, setCalOpen] = useState(false);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [cursor, setCursor] = useState(() => parseISO(value.anchor || today()));
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setCalOpen(false);
        setPickingEnd(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [calOpen]);

  const setMode = (mode: RangeMode) => {
    // Switching to custom seeds a sensible span from whatever is showing.
    if (mode === 'custom') {
      const [a, b] = rangeOf(value);
      onChange({ mode, anchor: a, end: b });
    } else {
      onChange({ ...value, mode });
    }
    setPickingEnd(false);
  };

  const step = (dir: 1 | -1) => {
    const { mode, anchor, end } = value;
    if (mode === 'today') {
      const d = addDays(anchor, dir);
      onChange({ ...value, anchor: d, end: d });
    } else if (mode === 'week') {
      onChange({ ...value, anchor: addDays(anchor, 7 * dir) });
    } else if (mode === 'month') {
      onChange({ ...value, anchor: addMonths(anchor, dir) });
    } else if (mode === 'year') {
      onChange({ ...value, anchor: addMonths(anchor, 12 * dir) });
    } else {
      // custom: slide the whole window by its own length
      const span = Math.round(
        (parseISO(end).getTime() - parseISO(anchor).getTime()) / 86400000,
      ) + 1;
      onChange({ ...value, anchor: addDays(anchor, span * dir), end: addDays(end, span * dir) });
    }
  };

  const pickDay = (d: string) => {
    if (value.mode === 'custom') {
      if (!pickingEnd) {
        onChange({ ...value, anchor: d, end: d });
        setPickingEnd(true);
        return;
      }
      const [a, b] = d < value.anchor ? [d, value.anchor] : [value.anchor, d];
      onChange({ ...value, anchor: a, end: b });
      setPickingEnd(false);
      setCalOpen(false);
      return;
    }
    onChange({ ...value, anchor: d, end: d });
    setCalOpen(false);
  };

  const cells = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const out: { key: string; label: string; date: string | null }[] = [];
    for (let i = 0; i < first; i++) out.push({ key: `b${i}`, label: '', date: null });
    for (let d = 1; d <= days; d++) {
      out.push({ key: `d${d}`, label: String(d), date: iso(new Date(y, m, d)) });
    }
    return out;
  }, [cursor]);

  const [selStart, selEnd] = rangeOf(value);
  const t = today();

  const years = useMemo(() => {
    const base = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => {
      const y = base - 5 + i;
      return { v: String(y), t: String(y) };
    });
  }, []);

  return (
    <div data-r="toolbar" style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      position: 'relative', zIndex: 20,
    }}>
      <div data-r="seg" style={{
        display: 'flex', border: `1px solid ${C.line}`, background: C.panel,
        borderRadius: 6, overflow: 'hidden',
      }}>
        {TABS.map(tab => {
          const on = value.mode === tab.id;
          return (
            <Hov
              key={tab.id}
              as="button"
              type="button"
              onClick={() => setMode(tab.id)}
              aria-pressed={on}
              style={{
                border: 0, borderRight: `1px solid ${C.lineSoft}`, padding: '6px 13px',
                fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer',
                background: on ? C.ink : C.panel, color: on ? '#fff' : C.body,
              }}
              hover={on ? undefined : { background: C.paper }}
            >
              {tab.label}
            </Hov>
          );
        })}
      </div>

      <div ref={wrap} style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
        <IconBtn icon="chevronLeft" title="Previous period" onClick={() => step(-1)} />

        <Hov
          as="button"
          type="button"
          onClick={() => { setCalOpen(v => !v); setCursor(parseISO(value.anchor || t)); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, minWidth: 186, height: 30,
            border: `1px solid ${calOpen ? C.accent : C.border}`, background: C.panel,
            borderRadius: 6, padding: '0 10px', fontSize: 12.5, fontWeight: 500,
            color: C.ink, cursor: 'pointer',
          }}
          hover={{ borderColor: C.accent }}
        >
          <Icon name="calendar" size={13} color={C.muted} />
          <span style={{
            flex: 1, textAlign: 'left', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {rangeLabelFor(value.mode, value.anchor, value.end)}
          </span>
          <Icon name="chevronDown" size={12} color={C.muted} />
        </Hov>

        <IconBtn icon="chevronRight" title="Next period" onClick={() => step(1)} />

        {calOpen && (
          <div
            className="drop"
            style={{
              position: 'absolute', top: 36, left: 35, width: 262,
              maxWidth: 'calc(100vw - 30px)', background: C.panel,
              border: `1px solid ${C.line}`, borderRadius: 8,
              boxShadow: '0 16px 40px rgba(11,18,32,.14)', padding: 11, zIndex: 60,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              paddingBottom: 9, borderBottom: `1px solid ${C.lineSoft}`,
            }}>
              <IconBtn
                icon="chevronLeft"
                size={24}
                title="Previous month"
                onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5 }}>
                <Select
                  value={String(cursor.getMonth())}
                  onChange={(e: any) =>
                    setCursor(c => new Date(c.getFullYear(), Number(e.target.value), 1))}
                  options={MONTH_NAMES.map((m, i) => ({ v: String(i), t: m }))}
                  style={{ height: 24, fontSize: 11.5, fontWeight: 600, padding: '0 4px', width: 'auto' }}
                />
                <Select
                  value={String(cursor.getFullYear())}
                  onChange={(e: any) =>
                    setCursor(c => new Date(Number(e.target.value), c.getMonth(), 1))}
                  options={years}
                  style={{ height: 24, fontSize: 11.5, fontWeight: 600, padding: '0 4px', width: 'auto' }}
                />
              </div>
              <IconBtn
                icon="chevronRight"
                size={24}
                title="Next month"
                onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              />
            </div>

            {value.mode === 'custom' && (
              <p style={{
                margin: '8px 0 0', fontSize: 10.5, color: C.muted2, textAlign: 'center',
              }}>
                {pickingEnd ? 'Now pick the last day' : 'Pick the first day'}
              </p>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginTop: 8,
            }}>
              {WEEKDAY_LABELS.map(w => (
                <span key={w} style={{
                  textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: C.faint, padding: '2px 0',
                }}>
                  {w}
                </span>
              ))}

              {cells.map(cell => {
                if (!cell.date) return <span key={cell.key} />;
                const inSel = cell.date >= selStart && cell.date <= selEnd;
                const isToday = cell.date === t;
                const isEdge = cell.date === selStart || cell.date === selEnd;
                return (
                  <Hov
                    key={cell.key}
                    as="button"
                    type="button"
                    onClick={() => pickDay(cell.date!)}
                    style={{
                      height: 26,
                      border: `1px solid ${isEdge ? C.ink : isToday ? C.accent : 'transparent'}`,
                      borderRadius: 5,
                      background: isEdge ? C.ink : inSel ? C.accentWash : C.panel,
                      color: isEdge ? '#fff' : C.ink,
                      fontSize: 11, fontWeight: isEdge || isToday ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                    hover={isEdge ? undefined : { borderColor: C.accent }}
                  >
                    {cell.label}
                  </Hov>
                );
              })}
            </div>

            <Hov
              as="button"
              type="button"
              onClick={() => {
                onChange({ mode: value.mode === 'custom' ? 'today' : value.mode, anchor: t, end: t });
                setCursor(parseISO(t));
                setPickingEnd(false);
                setCalOpen(false);
              }}
              style={{
                width: '100%', marginTop: 9, border: `1px solid ${C.line}`, background: C.wash,
                borderRadius: 6, padding: 5, fontSize: 11.5, fontWeight: 600,
                color: C.body, cursor: 'pointer',
              }}
              hover={{ borderColor: C.accent, color: C.ink }}
            >
              Jump to today
            </Hov>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />
      {children}
      {summary && <span style={{ fontSize: 11.5, color: C.muted }}>{summary}</span>}
    </div>
  );
}
