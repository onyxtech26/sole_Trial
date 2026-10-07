import { useState } from 'react';
import { signIn } from '../lib/auth';
import { CONTACT_URL, TRIAL_DAYS } from '../lib/config';
import { trialDaysLeft } from '../lib/trial';
import type { User } from '../types';
import { Btn, C } from '../ui/kit';
import { Icon } from '../ui/Icon';

/** The trial's front door: start it, carry on with it, or, once it has run out, get in touch. */
export function LoginScreen({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const [busy, setBusy] = useState(false);
  const left = trialDaysLeft();
  const ended = left === 0;
  const fresh = left === TRIAL_DAYS;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    const res = await signIn();
    setBusy(false);
    if (res.user) onSignedIn(res.user);
  };

  return (
    <div
      className="fade"
      style={{
        position: 'fixed', inset: 0, zIndex: 70, background: C.ink,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflowY: 'auto',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(58% 52% at 76% 8%, rgba(253,151,7,.16) 0%, rgba(11,18,32,0) 72%)',
      }} />

      <div
        className="pop"
        style={{
          position: 'relative', width: '100%', maxWidth: 352, background: C.panel,
          borderRadius: 10, padding: '30px 28px', boxShadow: '0 24px 60px rgba(0,0,0,.42)',
        }}
      >
        <img
          src="/logo.png"
          alt="SOLE"
          style={{ height: 24, width: 'auto', display: 'block', margin: '0 auto 7px', flexShrink: 0 }}
        />
        <p style={{
          margin: '0 0 24px', textAlign: 'center', fontSize: 9, fontWeight: 600,
          letterSpacing: '.16em', textTransform: 'uppercase', color: C.muted3,
        }}>
          Tour operations · Business plan
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{
            margin: 0, fontSize: 12, lineHeight: 1.55, color: C.body,
            textAlign: 'center', textWrap: 'pretty',
          }}>
            {ended
              ? `Your ${TRIAL_DAYS}-day trial has ended. Your data is still here: get SOLE for your business to keep working with it.`
              : fresh
                ? `Try every feature free for ${TRIAL_DAYS} days with your own bookings. Import a Viator or GetYourGuide export from the Dashboard. Everything you enter stays in this browser.`
                : `${left} day${left === 1 ? '' : 's'} left in your free trial.`}
          </p>

          {!ended && (
            <Btn
              variant="primary"
              onClick={start}
              disabled={busy}
              style={{ marginTop: 4, height: 38, fontSize: 13, width: '100%' }}
            >
              {busy && <Icon name="spinner" size={14} className="spin" />}
              {fresh ? 'Start the free trial' : 'Continue the trial'}
            </Btn>
          )}

          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 600,
              ...(ended
                ? { background: C.ink, color: '#fff', borderRadius: 6, padding: '10px 0', textDecoration: 'none' }
                : {}),
            }}
          >
            Get SOLE for your business
          </a>
        </div>

        <p style={{
          margin: '19px 0 0', paddingTop: 14, borderTop: `1px solid ${C.lineSoft}`,
          textAlign: 'center', fontSize: 10.5, color: C.muted3,
        }}>
          Powered by{' '}
          <a href="https://onyxx-tech.vercel.app/index.html" target="_blank" rel="noopener noreferrer">
            Onyxx Tech Hub
          </a>
        </p>
      </div>
    </div>
  );
}
