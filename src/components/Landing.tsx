import { useState, type ReactNode } from 'react';
import { CONTACT_URL } from '../lib/config';
import { PLANS, PLAN_PROMISES } from '../lib/pricing';
import { C, MONO } from '../ui/kit';
import { Icon, type IconName } from '../ui/Icon';

/* ══════════════════════════════════════════════════════════════════════════
   The public landing page at "/".

   Built from the app's own tokens (ui/kit C, Outfit + JetBrains Mono, the navy
   and orange pair) and its flat rules: hairline borders, 6–7px radii, no
   shadows. Layout breakpoints live in index.css under "landing".
   ══════════════════════════════════════════════════════════════════════════ */

const ORANGE_ON_NAVY = '#fdb44e';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'upload', title: 'Import in one drop', body: 'Drop the Viator or GetYourGuide export on the Dashboard. New, changed and cancelled bookings are sorted for you.' },
  { icon: 'layers', title: 'Grouping', body: 'Guests on the same tour and time fall into groups. Set the start time, move a guest, assign a guide.' },
  { icon: 'printer', title: 'Manifests', body: 'A printable runsheet for every day: who is on which tour, with which guide, at what time.' },
  { icon: 'message', title: 'WhatsApp messages', body: 'Templates in English, Spanish and Italian, filled in with the guest’s name, time and meeting point.' },
  { icon: 'users', title: 'Team and guide portal', body: 'Guides see only their own departures on their phone. Office staff see everything.' },
  { icon: 'route', title: 'Tours', body: 'Your products and tour options in one list, matched to every imported booking.' },
  { icon: 'idCard', title: 'Customers', body: 'Traveller records, passports and history, kept with the booking they belong to.' },
  { icon: 'finance', title: 'Finance', body: 'Revenue, guide cost and balance for any day, week or month, ready to export.' },
];

const STEPS: { title: string; body: string }[] = [
  { title: 'Import your bookings', body: 'Export from Viator or GetYourGuide as usual and drop the file into SOLE.' },
  { title: 'Group and assign guides', body: 'SOLE proposes the groups. You set times and pick a guide for each one.' },
  { title: 'Print and message', body: 'Print the day’s manifest and send every guest their meeting details on WhatsApp.' },
];

const BEFORE_AFTER: [string, string][] = [
  ['Copying the OTA export into a spreadsheet', 'One drop, bookings sorted'],
  ['Grouping guests by hand every evening', 'Groups proposed, adjusted in a click'],
  ['Typing each WhatsApp message', 'Templates filled in for every guest'],
  ['Calling guides to confirm who has what', 'Each guide sees their tours on the phone'],
  ['Adding up guide cost at month end', 'Revenue and balance for any period'],
];

const FAQ: [string, string][] = [
  ['Do you take a cut of my bookings?', 'No. SOLE is a flat monthly fee. Booking platforms usually charge 1.5–3% on top of their monthly plan; SOLE charges nothing per booking.'],
  ['Do I have to stop using Viator, GetYourGuide or my booking system?', 'No. SOLE is the operations layer behind them. Keep selling where you sell today and import the bookings into SOLE.'],
  ['How does the free trial work?', 'We set up a trial for your company and send you a link. You get the full Business plan for 14 days with your own bookings. Your trial data stays in your browser.'],
  ['Do guides need a paid seat?', 'No. Guides are free on every plan. You pay only for office seats.'],
  ['Can I change plans later?', 'Yes, any month, up or down. Yearly billing gives you two months free.'],
];

function Eyebrow({ children, onNavy }: { children: ReactNode; onNavy?: boolean }) {
  return (
    <p style={{
      margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '.16em',
      textTransform: 'uppercase', color: onNavy ? ORANGE_ON_NAVY : C.accentInk,
    }}>
      {children}
    </p>
  );
}

function Heading({ children, onNavy }: { children: ReactNode; onNavy?: boolean }) {
  return (
    <h2 className="lp-h2" style={{ color: onNavy ? '#fff' : C.ink }}>{children}</h2>
  );
}

export function CtaLink({ href, children, variant = 'primary', external }: {
  href: string; children: ReactNode; variant?: 'primary' | 'accent' | 'ghost' | 'ghostNavy'; external?: boolean;
}) {
  return (
    <a
      href={href}
      className={`lp-btn lp-btn-${variant}`}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}

/** The top bar, shared with the contact page. */
export function SiteNav() {
  return (
    <header className="lp-nav" style={{ background: C.ink, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
      <div className="lp-wrap lp-nav-row">
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="SOLE home">
          <span style={{
            width: 30, height: 30, borderRadius: 7, background: 'rgba(253,151,7,.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src="/logo-mark.png" alt="" style={{ height: 14, width: 'auto' }} />
          </span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 16, letterSpacing: '.02em' }}>SOLE</span>
        </a>
        <nav className="lp-links">
          <a href="/#features">Features</a>
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CtaLink href="/app" variant="ghostNavy">Sign in</CtaLink>
          <CtaLink href={`${CONTACT_URL}?intent=trial`} variant="accent">Request a trial</CtaLink>
        </div>
      </div>
    </header>

  );
}

export function Landing() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="lp" style={{ background: C.paper, color: C.ink, minHeight: '100%' }}>
      {/* ── nav ── */}
      <SiteNav />
      {/* ── hero ── */}
      <section style={{ background: C.ink, color: '#fff' }}>
        <div className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <Eyebrow onNavy>Operations for tour operators</Eyebrow>
            <h1 className="lp-h1">
              Every booking, group and guide in <span style={{ color: ORANGE_ON_NAVY }}>one panel</span>.
            </h1>
            <p className="lp-lead" style={{ color: 'rgba(255,255,255,.66)' }}>
              SOLE turns your Viator and GetYourGuide exports into groups, guide assignments,
              printable manifests and WhatsApp messages. Built with a Rome tour operator, used every day.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 26 }}>
              <CtaLink href={`${CONTACT_URL}?intent=trial`} variant="accent">Request a free trial</CtaLink>
              <CtaLink href="#pricing" variant="ghostNavy">See pricing</CtaLink>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,.45)' }}>
              14 days on the full Business plan · No commission on bookings · Guides are free
            </p>
          </div>
          <div className="lp-shot">
            <img src="/landing-dashboard.png" alt="The SOLE dashboard: today’s departures, tours without a guide, revenue" />
          </div>
        </div>
      </section>

      {/* ── works with ── */}
      <section style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div className="lp-wrap lp-strip">
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted3 }}>
            Imports bookings from
          </span>
          {['Viator', 'GetYourGuide', 'Excel · CSV'].map(n => (
            <span key={n} style={{
              fontSize: 12.5, fontWeight: 600, color: C.body, border: `1px solid ${C.line}`,
              borderRadius: 6, padding: '5px 12px', background: C.wash,
            }}>{n}</span>
          ))}
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted3 }}>
            Messages guests on
          </span>
          <span style={{
            fontSize: 12.5, fontWeight: 600, color: C.good, borderRadius: 6,
            padding: '5px 12px', background: C.goodBg,
          }}>WhatsApp · EN · ES · IT</span>
        </div>
      </section>

      {/* ── features ── */}
      <section id="features" className="lp-section">
        <div className="lp-wrap">
          <Eyebrow>Features</Eyebrow>
          <Heading>The whole tour day, not just the booking.</Heading>
          <p className="lp-sub" style={{ color: C.body }}>
            Booking platforms stop once the ticket is sold. SOLE starts there: who goes with whom,
            with which guide, at what time, and who has been told.
          </p>
          <div className="lp-grid-4">
            {FEATURES.map(f => (
              <div key={f.title} className="lp-card">
                <span style={{
                  width: 32, height: 32, borderRadius: 7, background: C.ink, color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={f.icon} size={15} />
                </span>
                <h3 style={{ margin: '14px 0 6px', fontSize: 14, fontWeight: 600 }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.body, textWrap: 'pretty' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="lp-section" style={{ background: C.panel, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="lp-wrap">
          <Eyebrow>How it works</Eyebrow>
          <Heading>From export to manifest in three steps.</Heading>
          <div className="lp-grid-3" style={{ marginTop: 28 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} style={{ borderTop: `2px solid ${i === 0 ? C.accent : C.line}`, paddingTop: 16 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.accentInk }}>
                  0{i + 1}
                </span>
                <h3 style={{ margin: '8px 0 6px', fontSize: 15, fontWeight: 600 }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.body }}>{s.body}</p>
              </div>
            ))}
          </div>

          <div className="lp-table" style={{ marginTop: 36 }}>
            <div className="lp-table-head">
              <span>Without SOLE</span>
              <span>With SOLE</span>
            </div>
            {BEFORE_AFTER.map(([a, b]) => (
              <div key={a} className="lp-table-row">
                <span style={{ color: C.muted2, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="x" size={13} style={{ color: C.bad, marginTop: 2, flexShrink: 0 }} />{a}
                </span>
                <span style={{ color: C.ink, fontWeight: 500, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name="check" size={13} style={{ color: C.good, marginTop: 2, flexShrink: 0 }} />{b}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section id="pricing" className="lp-section">
        <div className="lp-wrap">
          <div className="lp-pricing-head">
            <div>
              <Eyebrow>Pricing</Eyebrow>
              <Heading>One flat price. No cut of your bookings.</Heading>
              <p className="lp-sub" style={{ color: C.body }}>
                Most tour software charges a monthly plan and 1.5–3% of every booking on top.
                SOLE is a flat monthly fee, and guides never count as seats.
              </p>
            </div>
            <div role="group" aria-label="Billing period" style={{
              display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 6,
              background: C.panel, padding: 2, alignSelf: 'flex-end', flexShrink: 0,
            }}>
              {[false, true].map(y => (
                <button
                  key={String(y)}
                  type="button"
                  onClick={() => setYearly(y)}
                  aria-pressed={yearly === y}
                  style={{
                    border: 0, borderRadius: 5, padding: '6px 13px', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    background: yearly === y ? C.ink : 'transparent',
                    color: yearly === y ? '#fff' : C.body,
                  }}
                >
                  {y ? 'Yearly · 2 months free' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          <div className="lp-grid-3" style={{ marginTop: 28, alignItems: 'stretch' }}>
            {PLANS.map(p => {
              const price = yearly ? p.yearly : p.monthly;
              const navy = !!p.popular;
              return (
                <div
                  key={p.id}
                  className="lp-card"
                  style={{
                    display: 'flex', flexDirection: 'column', padding: 24,
                    ...(navy ? { background: C.ink, borderColor: C.ink, color: '#fff' } : {}),
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.name}</h3>
                    {navy && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
                        color: ORANGE_ON_NAVY, background: 'rgba(253,151,7,.18)', borderRadius: 4, padding: '3px 7px',
                      }}>Most popular</span>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: navy ? 'rgba(255,255,255,.6)' : C.body, minHeight: 36 }}>
                    {p.pitch}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '18px 0 2px' }}>
                    <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
                      €{price}
                    </span>
                    <span style={{ fontSize: 12, color: navy ? 'rgba(255,255,255,.55)' : C.muted }}>/ month</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: navy ? 'rgba(255,255,255,.45)' : C.muted3, minHeight: 16 }}>
                    {yearly ? `€${p.yearly * 12} billed yearly` : 'Billed monthly, excl. VAT'}
                  </p>
                  <p style={{
                    margin: '16px 0 0', padding: '8px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600,
                    background: navy ? 'rgba(255,255,255,.06)' : C.wash,
                    color: navy ? '#fff' : C.ink,
                  }}>
                    {p.seats}
                  </p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 22px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                    {p.features.map(f => (
                      <li key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.45, color: navy ? 'rgba(255,255,255,.85)' : C.body }}>
                        <Icon name="check" size={13} style={{ color: navy ? ORANGE_ON_NAVY : C.good, marginTop: 2, flexShrink: 0 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <CtaLink href={`${CONTACT_URL}?plan=${p.id}`} variant={navy ? 'accent' : 'primary'}>
                    {navy ? 'Start with a free trial' : `Choose ${p.name}`}
                  </CtaLink>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginTop: 22 }}>
            {PLAN_PROMISES.map(t => (
              <span key={t} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: C.body }}>
                <Icon name="check" size={12} style={{ color: C.good }} />{t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── faq ── */}
      <section id="faq" className="lp-section" style={{ background: C.panel, borderTop: `1px solid ${C.line}` }}>
        <div className="lp-wrap lp-faq">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <Heading>Questions operators ask.</Heading>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FAQ.map(([q, a]) => (
              <details key={q} className="lp-faq-item">
                <summary>
                  {q}
                  <Icon name="chevronDown" size={14} style={{ color: C.muted3, flexShrink: 0 }} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── closing call ── */}
      <section style={{ background: C.ink, color: '#fff' }}>
        <div className="lp-wrap lp-cta">
          <div>
            <Heading onNavy>Try SOLE with your own bookings.</Heading>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,.6)', maxWidth: 520 }}>
              Tell us your company and we send you a trial link for the full Business plan, free for 14 days.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <CtaLink href={`${CONTACT_URL}?intent=trial`} variant="accent">Request a free trial</CtaLink>
            <CtaLink href="/app" variant="ghostNavy">I have a trial link</CtaLink>
          </div>
        </div>
        <div className="lp-wrap lp-foot" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <img src="/logo.png" alt="SOLE" style={{ height: 16, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.8 }} />
          <span>
            Powered by{' '}
            <a href="https://onyxx-tech.vercel.app/index.html" target="_blank" rel="noopener noreferrer" style={{ color: ORANGE_ON_NAVY }}>
              Onyxx Tech Hub
            </a>
          </span>
        </div>
      </section>
    </div>
  );
}
