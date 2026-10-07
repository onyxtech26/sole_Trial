import { useEffect, useRef, useState } from 'react';
import { signIn } from '../lib/auth';
import { CONTACT_URL } from '../lib/config';
import { trialAccount, trialDaysLeft, trialToken } from '../lib/trial';
import type { User } from '../types';
import { Btn, C, Input } from '../ui/kit';
import { Icon } from '../ui/Icon';

/** The trial's front door: open the link from the invitation, carry on with
    the trial, or, once it has run out, get in touch. */
export function LoginScreen({
  onSignedIn, invite,
}: { onSignedIn: (u: User) => void; invite?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const account = trialAccount();
  const left = trialDaysLeft();
  const ended = !!account && left === 0 && !invite;
  const returning = !!account && left > 0;

  const open = async (text: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await signIn(text);
    setBusy(false);
    if (res.user) onSignedIn(res.user);
    else setError(res.error ?? 'This trial link is not valid.');
  };

  // A client arriving from their invitation link is signed straight in.
  const tried = useRef(false);
  useEffect(() => {
    if (invite && !tried.current) {
      tried.current = true;
      void open(invite);
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const message = invite && busy
    ? 'Opening your trial…'
    : ended
      ? `The trial for ${account!.company} has ended. Your data is still here: get SOLE for your business to keep working with it.`
      : returning
        ? `${account!.company} · ${left} day${left === 1 ? '' : 's'} left in your free trial.`
        : 'Open the trial link from your invitation, or paste it below. Everything you enter stays in this browser.';

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
        <a href="/" aria-label="SOLE home">
          <img
            src="/logo.png"
            alt="SOLE"
            style={{ height: 24, width: 'auto', display: 'block', margin: '0 auto 7px', flexShrink: 0 }}
          />
        </a>
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
            {message}
          </p>

          {returning && !invite && (
            <Btn
              variant="primary"
              onClick={() => open(trialToken() ?? '')}
              disabled={busy}
              style={{ marginTop: 4, height: 38, fontSize: 13, width: '100%' }}
            >
              {busy && <Icon name="spinner" size={14} className="spin" />}
              Continue the trial
            </Btn>
          )}

          {!returning && !(invite && busy) && (
            <form
              onSubmit={e => { e.preventDefault(); void open(link); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}
            >
              <Input
                value={link}
                onChange={(e: any) => setLink(e.target.value)}
                placeholder="Paste your trial link"
                aria-label="Trial link"
                style={{ height: 36, fontSize: 12 }}
              />
              <Btn
                variant="primary"
                type="submit"
                disabled={busy || !link.trim()}
                style={{ height: 38, fontSize: 13, width: '100%' }}
              >
                {busy && <Icon name="spinner" size={14} className="spin" />}
                Open my trial
              </Btn>
            </form>
          )}

          {error && (
            <p role="alert" style={{
              margin: 0, fontSize: 11.5, color: C.bad, background: C.badBg,
              borderRadius: 6, padding: '7px 10px', textAlign: 'center',
            }}>
              {error}
            </p>
          )}

          <a
            href={`${CONTACT_URL}?intent=${ended ? 'buy' : 'trial'}`}
            style={{
              display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 600,
              ...(ended
                ? { background: C.ink, color: '#fff', borderRadius: 6, padding: '10px 0', textDecoration: 'none' }
                : {}),
            }}
          >
            {ended ? 'Get SOLE for your business' : 'No invitation yet? Request a free trial'}
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
