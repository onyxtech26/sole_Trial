import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../ui/Icon';
import { C, Hov, MONO } from '../ui/kit';
import { commandSearch, notifications, type CmdResult } from '../utils/selectors';
import { today } from '../utils/dates';
import type { StoreData, User } from '../types';
import type { Screen } from '../utils/access';
import { canSee } from '../utils/access';

interface Props {
  title: string;
  sub: string;
  user: User;
  store: StoreData;
  onGo: (screen: Screen, ref?: string) => void;
  onRefresh: () => void;
  syncing: boolean;
}

export function Header({ title, sub, user, store, onGo, onRefresh, syncing }: Props) {
  const [query, setQuery] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [read, setRead] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => commandSearch(store, query), [store, query]);
  const notes = useMemo(
    () => notifications(store, today()).filter(n => canSee(user.role, n.screen as Screen)),
    [store, user.role],
  );

  /* ⌘K / Ctrl-K focuses search; Escape closes whatever is open. */
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(true);
        setNotesOpen(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotesOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!searchRef.current?.contains(t)) setCmdOpen(false);
      if (!bellRef.current?.contains(t)) setNotesOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (r: CmdResult) => {
    onGo(r.screen as Screen, r.ref);
    setCmdOpen(false);
    setQuery('');
  };

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && results[0]) pick(results[0]);
    if (e.key === 'Escape') setCmdOpen(false);
  };

  const unread = notes.length > 0 && !read;

  return (
    <header
      data-r="topbar"
      data-print="hide"
      style={{
        minHeight: 54, flexShrink: 0, background: C.panel,
        borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center',
        gap: 14, padding: '0 18px', position: 'relative', zIndex: 30,
      }}
    >
      <div data-r="title" style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <h1 style={{
          margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap',
        }}>
          {title}
        </h1>
        <span data-r="sub" style={{
          fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {sub}
        </span>
      </div>

      {/* Collapses on a phone: with it in play the title takes the whole first
          line and the bell is pushed onto one of its own. */}
      <div data-spacer style={{ flex: 1 }} />

      {/* ── command search ── */}
      <div
        ref={searchRef}
        data-r="search"
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        <Icon
          name="search"
          size={13}
          color={C.muted3}
          style={{ position: 'absolute', left: 9, pointerEvents: 'none', zIndex: 1 }}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setCmdOpen(true); }}
          onFocus={() => setCmdOpen(true)}
          onKeyDown={onSearchKey}
          placeholder="Search booking ref, traveller, phone"
          aria-label="Search"
          style={{
            width: 250, height: 30,
            borderWidth: 1, borderStyle: 'solid',
            borderColor: cmdOpen ? C.accent : C.border,
            background: cmdOpen ? C.panel : C.wash, borderRadius: 6,
            boxShadow: cmdOpen ? `0 0 0 3px ${C.accentRing}` : 'none',
            padding: '0 44px 0 28px', fontSize: 12.5, color: C.ink, outline: 'none',
          }}
        />
        <span style={{
          position: 'absolute', right: 8, fontFamily: MONO, fontSize: 9, color: C.faint2,
          border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 4px', pointerEvents: 'none',
        }}>
          ⌘K
        </span>

        {cmdOpen && (
          <div
            className="drop"
            style={{
              position: 'absolute', top: 36, right: 0, width: 392,
              maxWidth: 'calc(100vw - 20px)', maxHeight: 414,
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              boxShadow: '0 16px 40px rgba(11,18,32,.14)', display: 'flex',
              flexDirection: 'column', overflow: 'hidden', zIndex: 60,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              background: C.wash, borderBottom: `1px solid ${C.lineSoft}`, flexShrink: 0,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '.08em',
                textTransform: 'uppercase', color: C.muted3,
              }}>
                Signed in as {user.name} · {user.roleLabel}
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>
                {query.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {!results.length && (
                <p style={{
                  margin: 0, padding: '26px 16px', textAlign: 'center',
                  fontSize: 11.5, color: C.muted, lineHeight: 1.6,
                }}>
                  {query.trim()
                    ? `Nothing matches “${query.trim()}”.`
                    : 'Search a booking reference, a traveller, a phone number, a guide or a tour.'}
                </p>
              )}

              {results.map(r => (
                <Hov
                  key={r.id}
                  as="button"
                  type="button"
                  className="nudge"
                  onClick={() => pick(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0,
                    borderBottom: '1px solid #f4f6f8', background: C.panel, padding: '9px 12px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  hover={{ background: C.wash }}
                >
                  <span style={{
                    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1,
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.title}
                    </span>
                    <span style={{
                      fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {r.sub}
                    </span>
                  </span>
                  <span style={{
                    flexShrink: 0, fontSize: 9, fontWeight: 600, letterSpacing: '.06em',
                    textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4,
                    background: r.tagBg, color: r.tagFg,
                  }}>
                    {r.tag}
                  </span>
                </Hov>
              ))}
            </div>

            <div style={{
              flexShrink: 0, padding: '6px 12px', borderTop: `1px solid ${C.lineSoft}`,
              background: C.wash, fontSize: 10, color: C.faint,
            }}>
              Enter opens the first result · Esc closes
            </div>
          </div>
        )}
      </div>

      {/* ── refresh ── */}
      <Hov
        as="button"
        type="button"
        onClick={onRefresh}
        title="Reload from the database"
        aria-label="Reload from the database"
        style={{
          width: 30, height: 30, border: `1px solid ${C.border}`, background: C.panel,
          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.body, flexShrink: 0, padding: 0,
        }}
        hover={{ borderColor: C.accent, color: C.ink }}
      >
        <Icon name="refresh" size={13} className={syncing ? 'spin' : undefined} />
      </Hov>

      {/* ── attention ── */}
      <div ref={bellRef} style={{ position: 'relative', flexShrink: 0 }}>
        <Hov
          as="button"
          type="button"
          onClick={() => {
            setNotesOpen(v => !v);
            setCmdOpen(false);
            setRead(true);
          }}
          aria-label="Attention"
          style={{
            position: 'relative', width: 30, height: 30, border: `1px solid ${C.border}`,
            background: notesOpen ? C.paper : C.panel, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          }}
          hover={{ background: C.paper }}
        >
          <Icon name="bell" size={14} color={C.body} />
          {unread && (
            <span
              className="blink"
              style={{
                position: 'absolute', top: 4, right: 4, width: 6, height: 6,
                borderRadius: '50%', background: C.accent, border: '1.5px solid #fff',
              }}
            />
          )}
        </Hov>

        {notesOpen && (
          <div
            className="drop"
            style={{
              position: 'absolute', top: 36, right: 0, width: 330,
              maxWidth: 'calc(100vw - 20px)', maxHeight: 400,
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              boxShadow: '0 16px 40px rgba(11,18,32,.14)', display: 'flex',
              flexDirection: 'column', overflow: 'hidden', zIndex: 60,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px',
              borderBottom: `1px solid ${C.lineSoft}`, flexShrink: 0,
            }}>
              <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>Attention</h2>
              <div style={{ flex: 1 }} />
              <Hov
                as="button"
                type="button"
                onClick={() => setRead(true)}
                style={{
                  border: 0, background: 'transparent', fontSize: 11, fontWeight: 600,
                  color: C.accentInk, cursor: 'pointer', padding: '2px 4px',
                }}
                hover={{ color: C.ink }}
              >
                Mark all read
              </Hov>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {!notes.length && (
                <p style={{
                  margin: 0, padding: '24px 16px', textAlign: 'center',
                  fontSize: 11.5, color: C.muted,
                }}>
                  Nothing needs attention right now.
                </p>
              )}

              {notes.map(n => (
                <Hov
                  key={n.id}
                  as="button"
                  type="button"
                  onClick={() => { onGo(n.screen as Screen); setNotesOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', border: 0,
                    borderBottom: '1px solid #f4f6f8', background: C.panel, padding: '10px 13px',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  hover={{ background: C.wash }}
                >
                  <span style={{
                    width: 5, height: 5, flexShrink: 0, marginTop: 5,
                    borderRadius: '50%', background: n.dot,
                  }} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{n.title}</span>
                    <span style={{
                      fontSize: 11, color: C.muted2, lineHeight: 1.45, textWrap: 'pretty',
                    }}>
                      {n.body}
                    </span>
                  </span>
                </Hov>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
