import { useState } from 'react';
import { VENDOR } from '../lib/config';
import { PLANS } from '../lib/pricing';
import { C } from '../ui/kit';
import { Icon, type IconName } from '../ui/Icon';
import { SiteNav } from './Landing';

/* ══════════════════════════════════════════════════════════════════════════
   /contact: where every trial request and purchase lands for now.

   Reads ?intent=trial|buy or ?plan=<id> and pre-writes the WhatsApp message
   and email to match, so the operator only fills in their details. Contacts
   live in lib/config.ts (VENDOR).
   ══════════════════════════════════════════════════════════════════════════ */

const ORANGE_ON_NAVY = '#fdb44e';

interface Ask {
  title: string;
  lead: string;
  subject: string;
  message: string;
}

function askFor(params: URLSearchParams): Ask {
  const details = '\n\nCompany:\nCity:\nWe sell on (Viator / GetYourGuide / other):\nBookings per month:';
  const plan = PLANS.find(p => p.id === params.get('plan'));
  if (plan) {
    return {
      title: `Get SOLE ${plan.name}`,
      lead: `€${plan.monthly} a month, or €${plan.yearly} a month billed yearly. Send us a message and we set SOLE up for your company and send the invoice. You can start with a free trial first.`,
      subject: `SOLE ${plan.name} plan`,
      message: `Hi Onyxx Tech, I'd like to sign up for SOLE ${plan.name} (€${plan.monthly}/month).${details}`,
    };
  }
  if (params.get('intent') === 'buy') {
    return {
      title: 'Keep using SOLE',
      lead: 'Your trial has ended and your data is still in your browser. Tell us which plan you want and we set SOLE up for your company.',
      subject: 'Continue with SOLE after my trial',
      message: `Hi Onyxx Tech, my SOLE trial has ended and I'd like to keep using it.${details}\nPlan (Starter / Business / Pro):`,
    };
  }
  if (params.get('intent') === 'trial') {
    return {
      title: 'Request your free trial',
      lead: '14 days on the full Business plan, with your own bookings. Send us a message and we create your trial and send you the link.',
      subject: 'SOLE free trial request',
      message: `Hi Onyxx Tech, I'd like a free trial of SOLE.${details}`,
    };
  }
  return {
    title: 'Talk to us about SOLE',
    lead: 'Questions, a demo, a trial or a plan: message us and you talk directly to the people who build SOLE.',
    subject: 'About SOLE',
    message: 'Hi Onyxx Tech, I have a question about SOLE.',
  };
}

const waLink = (number: string, text: string) =>
  `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'message', title: 'Message us', body: 'On WhatsApp or by email, with your company and how you sell today.' },
  { icon: 'sparkles', title: 'Get your trial link', body: 'We create a trial for your company and send the link. 14 days, every feature.' },
  { icon: 'check', title: 'Go live', body: 'Pick a plan and we set SOLE up for your team, with your company name on every printout.' },
];

export function Contact() {
  const [ask] = useState(() => askFor(new URLSearchParams(window.location.search)));
  const [copied, setCopied] = useState(false);
  const mail = `mailto:${VENDOR.email}?subject=${encodeURIComponent(ask.subject)}&body=${encodeURIComponent(ask.message)}`;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(VENDOR.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* the address is on screen to copy by hand */
    }
  };

  return (
    <div className="lp" style={{ background: C.paper, color: C.ink, minHeight: '100%' }}>
      <SiteNav />

      <section style={{ background: C.ink, color: '#fff' }}>
        <div className="lp-wrap" style={{ paddingTop: 56, paddingBottom: 60 }}>
          <p style={{
            margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '.16em',
            textTransform: 'uppercase', color: ORANGE_ON_NAVY,
          }}>
            Contact
          </p>
          <h1 className="lp-h1" style={{ maxWidth: 680 }}>{ask.title}</h1>
          <p className="lp-lead" style={{ color: 'rgba(255,255,255,.66)', maxWidth: 600 }}>{ask.lead}</p>
        </div>
      </section>

      <section className="lp-section" style={{ paddingTop: 36 }}>
        <div className="lp-wrap lp-grid-3" style={{ alignItems: 'stretch' }}>
          {/* WhatsApp */}
          <div className="lp-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CardHead icon="message" tone={C.good} toneBg={C.goodBg} title="WhatsApp" note="The fastest way to reach us" />
            {VENDOR.whatsapp.map(w => (
              <a
                key={w.number}
                href={waLink(w.number, ask.message)}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-contact-row"
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 600, color: C.ink }}>{w.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: C.body }}>{w.number}</span>
                </span>
                <Icon name="chevronRight" size={14} style={{ color: C.muted3 }} />
              </a>
            ))}
            <p style={{ margin: 'auto 0 0', fontSize: 11, color: C.muted }}>
              Opens WhatsApp with your message already written.
            </p>
          </div>

          {/* Email */}
          <div className="lp-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CardHead icon="paperclip" tone={C.info} toneBg={C.infoBg} title="Email" note="For details, documents and invoices" />
            <a href={mail} className="lp-contact-row">
              <span style={{ fontWeight: 600, color: C.ink, wordBreak: 'break-all' }}>{VENDOR.email}</span>
              <Icon name="chevronRight" size={14} style={{ color: C.muted3 }} />
            </a>
            <button type="button" onClick={copyEmail} className="lp-btn lp-btn-ghost" style={{ cursor: 'pointer', fontFamily: 'inherit' }}>
              <Icon name={copied ? 'check' : 'copy'} size={13} />
              {copied ? 'Copied' : 'Copy address'}
            </button>
            <p style={{ margin: 'auto 0 0', fontSize: 11, color: C.muted }}>
              Opens your email app with the subject and message filled in.
            </p>
          </div>

          {/* What to send */}
          <div className="lp-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CardHead icon="fileText" tone={C.accentInk} toneBg={C.warnBg} title="What to tell us" note="So we can set your trial up right" />
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Your company name and city', 'Where you sell: Viator, GetYourGuide, others', 'Roughly how many bookings a month', 'How many people work in the office'].map(t => (
                <li key={t} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.body }}>
                  <Icon name="check" size={13} style={{ color: C.good, marginTop: 2 }} />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lp-wrap" style={{ marginTop: 44 }}>
          <div className="lp-grid-3">
            {STEPS.map((s, i) => (
              <div key={s.title} style={{ borderTop: `2px solid ${i === 0 ? C.accent : C.line}`, paddingTop: 16 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.accentInk }}>
                  <Icon name={s.icon} size={14} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>0{i + 1}</span>
                </span>
                <h3 style={{ margin: '8px 0 6px', fontSize: 15, fontWeight: 600 }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.body }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="lp-section" style={{ background: C.panel, borderTop: `1px solid ${C.line}` }}>
        <div className="lp-wrap lp-faq">
          <div>
            <p style={{
              margin: 0, fontSize: 10, fontWeight: 600, letterSpacing: '.16em',
              textTransform: 'uppercase', color: C.accentInk,
            }}>
              About us
            </p>
            <h2 className="lp-h2">{VENDOR.name}</h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: C.muted }}>The AI layer for modern businesses</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, lineHeight: 1.65, color: C.body }}>
            <p style={{ margin: 0 }}>
              SOLE is built and supported by {VENDOR.name}, a founder-led software studio in Malaysia.
              We build custom software, AI agents and automations, and we work directly with the
              businesses that use them, with no layers of account managers in between.
            </p>
            <p style={{ margin: 0 }}>
              SOLE started as the daily operations system for a tour operator in Rome, built around
              their real Viator exports, grouping sheets and WhatsApp messages. Every screen has been
              shaped by people running tours every day.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              {['Founder-led', 'AI-native', 'Built to ship'].map(t => (
                <span key={t} style={{
                  fontSize: 11.5, fontWeight: 600, color: C.ink, border: `1px solid ${C.line}`,
                  borderRadius: 6, padding: '5px 11px', background: C.wash,
                }}>{t}</span>
              ))}
            </div>
            <a href={VENDOR.website} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 13 }}>
              Visit {VENDOR.website.replace(/^https:\/\/(www\.)?|\/$/g, '')}
            </a>
          </div>
        </div>
      </section>

      <section style={{ background: C.ink }}>
        <div className="lp-wrap lp-foot">
          <a href="/" style={{ display: 'flex' }}>
            <img src="/logo.png" alt="SOLE" style={{ height: 16, width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.8 }} />
          </a>
          <span>© {new Date().getFullYear()} {VENDOR.name}</span>
        </div>
      </section>
    </div>
  );
}

function CardHead({ icon, tone, toneBg, title, note }: {
  icon: IconName; tone: string; toneBg: string; title: string; note: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
      <span style={{
        width: 32, height: 32, borderRadius: 7, background: toneBg, color: tone,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={icon} size={15} />
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>{note}</span>
      </span>
    </div>
  );
}
