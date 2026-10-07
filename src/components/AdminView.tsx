import { useState } from 'react';
import { TRIAL_DAYS } from '../lib/config';
import type { TrialAccount } from '../lib/trial';
import {
  Btn, C, Empty, Field, Input, MONO, Section, SectionHead, Select, Tag, useToast,
} from '../ui/kit';
import { Icon } from '../ui/Icon';

/* ══════════════════════════════════════════════════════════════════════════
   /admin: create a trial for a client and send them the link.

   The server (api/trial.ts) checks the admin password and signs the trial; it
   keeps no record. The list below is this admin's own record of the links
   they sent, kept in this browser, so the links can be copied again later.
   ══════════════════════════════════════════════════════════════════════════ */

const LIST_KEY = 'sole_admin_trials';
const PASS_KEY = 'sole_admin_pass';
const DAY = 24 * 3600 * 1000;

interface Issued {
  token: string;
  trial: TrialAccount;
}

function readList(): Issued[] {
  try {
    return JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]') as Issued[];
  } catch {
    return [];
  }
}

function writeList(list: Issued[]): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* private mode: the list lasts as long as the window */
  }
}

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: 'Could not reach the server.' } };
  }
}

const linkFor = (token: string) => `${window.location.origin}/app?invite=${encodeURIComponent(token)}`;
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function invitation(i: Issued): string {
  const hello = i.trial.name ? `Hi ${i.trial.name.split(' ')[0]},` : 'Hello,';
  return `${hello}\n\nYour free trial of SOLE for ${i.trial.company} is ready. Open this link to start (it works until ${shortDate(i.trial.expires)}):\n\n${linkFor(i.token)}\n\nImport a Viator or GetYourGuide export from the Dashboard to see your own tours grouped and ready.`;
}

export function AdminView() {
  const toast = useToast();
  const [password, setPassword] = useState(() => {
    try { return sessionStorage.getItem(PASS_KEY) ?? ''; } catch { return ''; }
  });
  const [unlocked, setUnlocked] = useState(!!password);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [list, setList] = useState<Issued[]>(readList);
  const [form, setForm] = useState({ company: '', name: '', email: '', days: String(TRIAL_DAYS) });
  const [latest, setLatest] = useState<Issued | null>(null);

  const unlock = async () => {
    setBusy(true);
    setError('');
    const res = await call({ action: 'create', check: true, password });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'Wrong admin password.');
    try { sessionStorage.setItem(PASS_KEY, password); } catch { /* fine */ }
    setUnlocked(true);
  };

  const lock = () => {
    try { sessionStorage.removeItem(PASS_KEY); } catch { /* fine */ }
    setPassword('');
    setUnlocked(false);
  };

  const create = async () => {
    if (!form.company.trim()) return setError('Add the client’s company name.');
    setBusy(true);
    setError('');
    const res = await call({ action: 'create', password, ...form, days: Number(form.days) });
    setBusy(false);
    if (!res.ok) {
      if (res.data.error === 'Wrong admin password.') lock();
      return setError(res.data.error ?? 'Could not create the trial.');
    }
    const issued: Issued = { token: res.data.token, trial: res.data.trial };
    const next = [issued, ...list];
    setList(next);
    writeList(next);
    setLatest(issued);
    setForm({ company: '', name: '', email: '', days: form.days });
    toast(`Trial created for ${issued.trial.company}`);
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`);
    } catch {
      toast('Copy failed. Select the text and copy it by hand.', 'warn');
    }
  };

  const forget = (id: string) => {
    const next = list.filter(i => i.trial.id !== id);
    setList(next);
    writeList(next);
    if (latest?.trial.id === id) setLatest(null);
  };

  return (
    <div style={{ minHeight: '100%', background: C.paper, fontSize: 13, lineHeight: 1.45 }}>
      <header style={{ background: C.ink, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0 18px', height: 54,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo-mark.png" alt="" style={{ height: 16, width: 'auto' }} />
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>SOLE</span>
          </a>
          <Tag bg="rgba(253,151,7,.18)" fg="#fdb44e">Admin</Tag>
          <span style={{ color: 'rgba(255,255,255,.55)', fontSize: 12 }}>Trial accounts</span>
          <div style={{ flex: 1 }} />
          {unlocked && (
            <button
              type="button"
              onClick={lock}
              style={{
                background: 'transparent', border: 0, color: 'rgba(255,255,255,.6)', cursor: 'pointer',
                fontSize: 12, display: 'flex', gap: 6, alignItems: 'center',
              }}
            >
              <Icon name="lock" size={13} /> Lock
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!unlocked ? (
          <Section style={{ maxWidth: 380, margin: '60px auto 0', width: '100%' }}>
            <SectionHead title="Admin sign-in" />
            <form
              onSubmit={e => { e.preventDefault(); void unlock(); }}
              style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <Field label="Admin password">
                <Input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e: any) => setPassword(e.target.value)}
                />
              </Field>
              {error && <p role="alert" style={{ margin: 0, fontSize: 11.5, color: C.bad }}>{error}</p>}
              <Btn variant="primary" type="submit" disabled={busy || !password}>
                {busy && <Icon name="spinner" size={13} className="spin" />}
                Unlock
              </Btn>
            </form>
          </Section>
        ) : (
          <>
            <Section>
              <SectionHead title="Create a trial" note="The client gets the full Business plan until the end date." />
              <form
                onSubmit={e => { e.preventDefault(); void create(); }}
                style={{
                  padding: 16, display: 'grid', gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end',
                }}
              >
                <Field label="Company">
                  <Input
                    value={form.company}
                    placeholder="Roma Walking Tours"
                    onChange={(e: any) => setForm({ ...form, company: e.target.value })}
                  />
                </Field>
                <Field label="Contact name">
                  <Input
                    value={form.name}
                    placeholder="Giulia"
                    onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    placeholder="giulia@example.com"
                    onChange={(e: any) => setForm({ ...form, email: e.target.value })}
                  />
                </Field>
                <Field label="Length">
                  <Select
                    value={form.days}
                    onChange={(e: any) => setForm({ ...form, days: e.target.value })}
                    options={[7, 14, 21, 30, 60].map(d => ({ v: String(d), t: `${d} days` }))}
                  />
                </Field>
                <Btn variant="primary" type="submit" disabled={busy} icon={busy ? undefined : 'plus'}>
                  {busy && <Icon name="spinner" size={13} className="spin" />}
                  Create trial
                </Btn>
              </form>
              {error && (
                <p role="alert" style={{ margin: '0 16px 14px', fontSize: 11.5, color: C.bad }}>{error}</p>
              )}
              {latest && (
                <div style={{
                  margin: '0 16px 16px', padding: 14, borderRadius: 7, background: C.goodBg,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.good }}>
                    Trial ready for {latest.trial.company}. Send them this link:
                  </span>
                  <code style={{
                    fontFamily: MONO, fontSize: 11, color: C.ink, background: C.panel, borderRadius: 6,
                    padding: '8px 10px', wordBreak: 'break-all', border: `1px solid ${C.line}`,
                  }}>
                    {linkFor(latest.token)}
                  </code>
                  <ShareButtons issued={latest} onCopy={copy} />
                </div>
              )}
            </Section>

            <Section>
              <SectionHead title="Trials you created" note={`${list.length} in this browser`} />
              {list.length === 0 ? (
                <Empty>Trials you create appear here, so you can copy their link again.</Empty>
              ) : (
                <div data-r="scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 720 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: C.muted2 }}>
                        {['Company', 'Contact', 'Created', 'Ends', 'Status', ''].map(h => (
                          <th key={h} style={{
                            padding: '9px 15px', fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
                            textTransform: 'uppercase', borderBottom: `1px solid ${C.lineSoft}`,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(i => {
                        const left = Math.ceil((i.trial.expires - Date.now()) / DAY);
                        return (
                          <tr key={i.trial.id} style={{ borderBottom: `1px solid ${C.lineFaint}` }}>
                            <td style={{ padding: '10px 15px', fontWeight: 600 }}>
                              {i.trial.company}
                              <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 400, color: C.faint }}>{i.trial.id}</div>
                            </td>
                            <td style={{ padding: '10px 15px', color: C.body }}>
                              {i.trial.name || '—'}
                              {i.trial.email && <div style={{ fontSize: 11, color: C.muted }}>{i.trial.email}</div>}
                            </td>
                            <td style={{ padding: '10px 15px', fontFamily: MONO, fontSize: 11.5, color: C.body }}>{shortDate(i.trial.issued)}</td>
                            <td style={{ padding: '10px 15px', fontFamily: MONO, fontSize: 11.5, color: C.body }}>{shortDate(i.trial.expires)}</td>
                            <td style={{ padding: '10px 15px' }}>
                              {left > 0
                                ? <Tag bg={C.goodBg} fg={C.good}>{left} day{left === 1 ? '' : 's'} left</Tag>
                                : <Tag bg={C.paper} fg={C.muted}>Ended</Tag>}
                            </td>
                            <td style={{ padding: '10px 15px' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <ShareButtons issued={i} onCopy={copy} compact />
                                <Btn small variant="quiet" onClick={() => forget(i.trial.id)} title="Remove from this list">
                                  <Icon name="trash" size={12} />
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ margin: 0, padding: '10px 15px', fontSize: 11, color: C.muted, borderTop: `1px solid ${C.lineSoft}` }}>
                Links end on their own. To close one early, add its id (under the company name)
                to REVOKED_TRIALS in the Vercel project settings and redeploy.
              </p>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function ShareButtons({
  issued, onCopy, compact,
}: { issued: Issued; onCopy: (text: string, what: string) => void; compact?: boolean }) {
  const text = invitation(issued);
  const mail = `mailto:${encodeURIComponent(issued.trial.email)}?subject=${encodeURIComponent('Your SOLE free trial')}&body=${encodeURIComponent(text)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Btn small variant="ghost" icon="copy" onClick={() => onCopy(linkFor(issued.token), 'Link')}>
        {compact ? 'Link' : 'Copy link'}
      </Btn>
      {!compact && (
        <Btn small variant="ghost" icon="paperclip" onClick={() => onCopy(text, 'Invitation')}>
          Copy invitation
        </Btn>
      )}
      <Btn small variant="ghost" icon="message" onClick={() => window.open(whatsapp, '_blank', 'noopener')}>
        WhatsApp
      </Btn>
      {issued.trial.email && (
        <Btn small variant="ghost" onClick={() => { window.location.href = mail; }}>Email</Btn>
      )}
    </div>
  );
}
