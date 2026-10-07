import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../ui/Icon';
import { C, Hov, MONO } from '../ui/kit';
import { MOBILE_QUERY, useMediaQuery } from '../ui/useMediaQuery';
import { canSee, type Screen } from '../utils/access';
import type { User } from '../types';
import { COMPANY } from '../lib/config';

interface NavItem {
  id: Screen;
  label: string;
  icon: IconName;
  group: 'Daily work' | 'Setup';
}

const NAV: NavItem[] = [
  { id: 'portal', label: 'My tours', icon: 'route', group: 'Daily work' },
  { id: 'today', label: 'Dashboard', icon: 'dashboard', group: 'Daily work' },
  { id: 'bookings', label: 'Bookings', icon: 'calendarDays', group: 'Daily work' },
  { id: 'groups', label: 'Grouping', icon: 'rows', group: 'Daily work' },
  { id: 'manifests', label: 'Manifests', icon: 'fileText', group: 'Daily work' },
  { id: 'messages', label: 'Messages', icon: 'message', group: 'Daily work' },
  { id: 'crm', label: 'Customers', icon: 'users', group: 'Setup' },
  { id: 'tours', label: 'Tours', icon: 'layers', group: 'Setup' },
  { id: 'team', label: 'Team', icon: 'idCard', group: 'Setup' },
  { id: 'finance', label: 'Finance', icon: 'finance', group: 'Setup' },
];

/* The rail is what stays on screen; the panel expands over the content rather
   than pushing it, so hovering never reflows the table underneath. ICON_BOX is
   half the rail, which keeps every glyph on the rail's centre line and — since
   the box width never changes — perfectly still as the panel opens. */
const RAIL = 52;
const PANEL = 212;
const ICON_BOX = 36;

interface Props {
  user: User;
  screen: Screen;
  onNavigate: (s: Screen) => void;
  onSignOut: () => void;
  badges: Partial<Record<Screen, number>>;
}

export function Sidebar({ user, screen, onNavigate, onSignOut, badges }: Props) {
  const [open, setOpen] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const visible = NAV.filter(n => canSee(user.role, n.id));
  const groups: NavItem['group'][] = ['Daily work', 'Setup'];

  /* Hover-to-expand is a pointer affordance. On touch the same panel becomes a
     drawer that is opened deliberately, so `open` has to start closed whenever
     the layout flips — otherwise a hover left the drawer latched open. */
  useEffect(() => { setOpen(false); }, [mobile]);

  if (mobile) {
    return (
      <MobileNav
        user={user}
        screen={screen}
        items={visible}
        groups={groups}
        badges={badges}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />
    );
  }

  /* Everything that is not a glyph fades out with the rail. The panel clips,
     so the text is already gone before the width finishes animating. */
  const fade = (extra?: CSSProperties): CSSProperties => ({
    opacity: open ? 1 : 0,
    // A few pixels of travel makes the label look like it slid out from behind
    // the icon rather than simply materialising on top of it.
    transform: open ? 'translateX(0)' : 'translateX(-6px)',
    transition: 'opacity .2s ease, transform .26s var(--ease)',
    whiteSpace: 'nowrap',
    pointerEvents: open ? undefined : 'none',
    ...extra,
  });

  return (
    <aside
      data-r="side"
      data-print="hide"
      style={{ width: RAIL, flexShrink: 0, position: 'relative' }}
    >
      <div
        data-r="sidepanel"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
        }}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: open ? PANEL : RAIL,
          background: C.ink, color: '#fff', zIndex: 45,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width .24s var(--ease), box-shadow .24s ease',
          boxShadow: open ? '6px 0 28px rgba(11,18,32,.22)' : 'none',
        }}
      >
        <div
          data-r="brand"
          style={{
            height: 54, flexShrink: 0, display: 'flex', alignItems: 'center',
            padding: '0 8px', borderBottom: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <span style={{
            width: ICON_BOX, flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src="/logo-mark.png"
              alt=""
              style={{ height: 18, width: 'auto', display: 'block' }}
            />
          </span>
          <span className="side-label" style={fade({ display: 'flex', flexDirection: 'column', gap: 2 })}>
            <span style={{
              fontSize: 13, fontWeight: 600, letterSpacing: '.18em', lineHeight: 1,
            }}>
              SOLE
            </span>
            <span style={{
              fontSize: 7.5, fontWeight: 500, letterSpacing: '.15em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.38)', lineHeight: 1,
            }}>
              {COMPANY}
            </span>
          </span>
        </div>

        <nav
          data-r="sidenav"
          style={{
            // minHeight: 0 — without it a short window makes the nav grow past
            // the panel and shove the account footer out of sight.
            flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}
        >
          {groups.map(g => {
            const items = visible.filter(n => n.group === g);
            if (!items.length) return null;
            return (
              <div key={g} style={{ display: 'contents' }}>
                <div
                  data-r="navgroup"
                  className="side-label"
                  style={fade({
                    fontSize: 8.5, fontWeight: 600, letterSpacing: '.14em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,.3)',
                    padding: g === 'Setup' ? '16px 10px 6px' : '5px 10px 6px',
                  })}
                >
                  {g}
                </div>

                {items.map(n => {
                  const on = screen === n.id;
                  const badge = badges[n.id];
                  return (
                    <Hov
                      key={n.id}
                      as="button"
                      type="button"
                      className="nav-item"
                      onClick={() => onNavigate(n.id)}
                      aria-current={on ? 'page' : undefined}
                      title={open ? undefined : n.label}
                      style={{
                        position: 'relative', display: 'flex', alignItems: 'center',
                        width: '100%', border: 0, padding: '8px 0', borderRadius: 6,
                        fontSize: 12.5, cursor: 'pointer', textAlign: 'left', flexShrink: 0,
                        background: on ? 'rgba(255,255,255,.1)' : 'transparent',
                        color: on ? '#fff' : 'rgba(255,255,255,.62)',
                        fontWeight: on ? 600 : 400,
                      }}
                      hover={on ? undefined : { background: 'rgba(255,255,255,.07)', color: '#fff' }}
                    >
                      {on && (
                        <span style={{
                          position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
                          borderRadius: '0 3px 3px 0', background: C.accent,
                        }} />
                      )}

                      <span style={{
                        width: ICON_BOX, flexShrink: 0, position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={n.icon} size={15} />
                        {/* Collapsed, the count has nowhere to go — a dot still says
                            "something in here needs you". */}
                        {!!badge && !open && (
                          <span style={{
                            position: 'absolute', top: -1, right: 3, width: 6, height: 6,
                            borderRadius: '50%', background: C.accent,
                            border: `1.5px solid ${C.ink}`,
                          }} />
                        )}
                      </span>

                      <span className="side-label" style={fade({ flex: 1 })}>{n.label}</span>

                      {!!badge && (
                        <span className="side-label" style={fade({
                          fontFamily: MONO, fontSize: 9.5, fontWeight: 500, padding: '1px 5px',
                          borderRadius: 4, background: 'rgba(253,151,7,.16)', color: '#fdb44e',
                        })}>
                          {badge}
                        </span>
                      )}

                      <span style={{ width: 10, flexShrink: 0 }} />
                    </Hov>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div
          data-r="sidefoot"
          style={{ flexShrink: 0, padding: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}
        >
          <Hov
            as="button"
            type="button"
            onClick={onSignOut}
            title={`Sign out (${user.username})`}
            style={{
              display: 'flex', alignItems: 'center', width: '100%', border: 0,
              background: 'transparent', padding: '7px 0', borderRadius: 6, cursor: 'pointer',
              textAlign: 'left', color: 'rgba(255,255,255,.6)',
            }}
            hover={{ background: 'rgba(255,255,255,.07)' }}
          >
            <span style={{
              width: ICON_BOX, flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: 5, background: C.accent,
                color: C.ink, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10.5, fontWeight: 700,
              }}>
                {user.initial}
              </span>
            </span>

            <span className="side-label" style={fade({
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            })}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                {user.name}
              </span>
              <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.4)', lineHeight: 1.3 }}>
                {user.roleLabel}
              </span>
            </span>

            <span className="side-label" style={fade({ display: 'flex', paddingRight: 9 })}>
              <Icon name="logout" size={13} />
            </span>
          </Hov>

          <p className="side-label" style={fade({
            margin: '6px 9px 2px', fontSize: 9, color: 'rgba(255,255,255,.3)',
          })}>
            Powered by{' '}
            <a
              href="https://onyxx-tech.vercel.app/index.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(253,151,7,.75)' }}
            >
              Onyxx Tech Hub
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Mobile navigation.

   The rail does not survive being turned on its side: ten destinations in a
   horizontally scrolling strip shows one of them and hides the rest behind a
   gesture nobody knows is there. On a phone the same navigation becomes a bar
   that is only ever a brand, a menu button and the account — and a drawer that
   shows every destination at once, grouped exactly as the desktop panel does.
   ══════════════════════════════════════════════════════════════════════════ */
const BAR = 54;

function MobileNav({
  user, screen, items, groups, badges, onNavigate, onSignOut,
}: {
  user: User;
  screen: Screen;
  items: NavItem[];
  groups: NavItem['group'][];
  badges: Partial<Record<Screen, number>>;
  onNavigate: (s: Screen) => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  /* While the drawer is up it owns the screen: the page behind must not scroll
     under it, and Escape closes it the same way the backdrop does. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (s: Screen) => { onNavigate(s); setOpen(false); };

  /* A count on any hidden screen still has to reach the user, so the menu
     button carries a dot whenever something behind it needs attention. */
  const pending = Object.entries(badges)
    .some(([id, n]) => !!n && id !== screen);

  const current = items.find(n => n.id === screen);

  return (
    <>
      <header
        data-r="mobilebar"
        data-print="hide"
        style={{
          height: BAR, flexShrink: 0, background: C.ink, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
          position: 'relative', zIndex: 46,
        }}
      >
        <Hov
          as="button"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          style={{
            position: 'relative', width: 38, height: 38, flexShrink: 0, border: 0,
            background: 'rgba(255,255,255,.08)', color: '#fff', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
          hover={{ background: 'rgba(255,255,255,.16)' }}
        >
          <Icon name="menu" size={17} />
          {pending && (
            <span style={{
              position: 'absolute', top: 7, right: 7, width: 7, height: 7,
              borderRadius: '50%', background: C.accent, border: `1.5px solid ${C.ink}`,
            }} />
          )}
        </Hov>

        <img src="/logo-mark.png" alt="" style={{ height: 17, width: 'auto', flexShrink: 0 }} />

        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '.16em', lineHeight: 1 }}>
            SOLE
          </span>
          {/* The current screen, so the bar answers "where am I" without the
              drawer having to be opened. */}
          <span style={{
            fontSize: 9, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,.42)', lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {current?.label ?? COMPANY}
          </span>
        </span>

        <div style={{ flex: 1 }} />

        <Hov
          as="button"
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Account: ${user.name}`}
          style={{
            width: 32, height: 32, flexShrink: 0, border: 0, borderRadius: 8,
            background: C.accent, color: C.ink, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
          }}
          hover={{ opacity: 0.88 }}
        >
          {user.initial}
        </Hov>
      </header>

      {open && createPortal(
        <>
          <div
            className="fade"
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(11,18,32,.5)',
              backdropFilter: 'blur(2px)', zIndex: 90,
            }}
          />

          <aside
            className="slide-l"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 91,
              width: 'min(300px, 86vw)', background: C.ink, color: '#fff',
              display: 'flex', flexDirection: 'column',
              boxShadow: '10px 0 40px rgba(11,18,32,.4)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div style={{
              height: BAR, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
              padding: '0 10px 0 14px', borderBottom: '1px solid rgba(255,255,255,.08)',
            }}>
              <img src="/logo-mark.png" alt="" style={{ height: 18, width: 'auto' }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 13, fontWeight: 600, letterSpacing: '.18em', lineHeight: 1,
                }}>
                  SOLE
                </span>
                <span style={{
                  fontSize: 7.5, fontWeight: 500, letterSpacing: '.15em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,.38)', lineHeight: 1,
                }}>
                  {COMPANY}
                </span>
              </span>
              <div style={{ flex: 1 }} />
              <Hov
                as="button"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{
                  width: 34, height: 34, flexShrink: 0, border: 0, borderRadius: 8,
                  background: 'rgba(255,255,255,.08)', color: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                }}
                hover={{ background: 'rgba(255,255,255,.18)' }}
              >
                <Icon name="x" size={15} />
              </Hov>
            </div>

            <nav style={{
              // As above: the drawer's account block and sign-out must stay
              // pinned to the bottom on a short screen, with the list scrolling.
              flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {groups.map(g => {
                const list = items.filter(n => n.group === g);
                if (!list.length) return null;
                return (
                  <div key={g} style={{ display: 'contents' }}>
                    <div style={{
                      fontSize: 8.5, fontWeight: 600, letterSpacing: '.14em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,.3)',
                      padding: g === 'Setup' ? '18px 10px 7px' : '4px 10px 7px',
                    }}>
                      {g}
                    </div>

                    {list.map(n => {
                      const on = screen === n.id;
                      const badge = badges[n.id];
                      return (
                        <Hov
                          key={n.id}
                          as="button"
                          type="button"
                          onClick={() => go(n.id)}
                          aria-current={on ? 'page' : undefined}
                          style={{
                            position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
                            width: '100%', minHeight: 44, border: 0, padding: '0 12px',
                            borderRadius: 8, fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
                            background: on ? 'rgba(255,255,255,.12)' : 'transparent',
                            color: on ? '#fff' : 'rgba(255,255,255,.66)',
                            fontWeight: on ? 600 : 400,
                          }}
                          hover={on ? undefined : { background: 'rgba(255,255,255,.07)', color: '#fff' }}
                        >
                          {on && (
                            <span style={{
                              position: 'absolute', left: 0, top: 9, bottom: 9, width: 3,
                              borderRadius: '0 3px 3px 0', background: C.accent,
                            }} />
                          )}
                          <Icon name={n.icon} size={17} />
                          <span style={{ flex: 1 }}>{n.label}</span>
                          {!!badge && (
                            <span style={{
                              fontFamily: MONO, fontSize: 10, fontWeight: 500, padding: '2px 6px',
                              borderRadius: 5, background: 'rgba(253,151,7,.16)', color: '#fdb44e',
                            }}>
                              {badge}
                            </span>
                          )}
                        </Hov>
                      );
                    })}
                  </div>
                );
              })}
            </nav>

            <div style={{
              flexShrink: 0, padding: 10, borderTop: '1px solid rgba(255,255,255,.08)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 10px',
              }}>
                <span style={{
                  width: 34, height: 34, flexShrink: 0, borderRadius: 8, background: C.accent,
                  color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {user.initial}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{user.name}</span>
                  <span style={{
                    fontSize: 10.5, color: 'rgba(255,255,255,.42)', lineHeight: 1.3,
                  }}>
                    {user.roleLabel}
                  </span>
                </span>
              </div>

              <Hov
                as="button"
                type="button"
                onClick={() => { setOpen(false); onSignOut(); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', minHeight: 40, border: '1px solid rgba(255,255,255,.16)',
                  background: 'transparent', borderRadius: 8, cursor: 'pointer',
                  color: 'rgba(255,255,255,.8)', fontSize: 12.5, fontWeight: 600,
                }}
                hover={{ background: 'rgba(255,255,255,.08)', color: '#fff' }}
              >
                <Icon name="logout" size={14} />
                Sign out
              </Hov>

              <p style={{
                margin: '10px 4px 2px', fontSize: 9.5, color: 'rgba(255,255,255,.3)',
                textAlign: 'center',
              }}>
                Powered by{' '}
                <a
                  href="https://onyxx-tech.vercel.app/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(253,151,7,.75)' }}
                >
                  Onyxx Tech Hub
                </a>
              </p>
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
