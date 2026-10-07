/* ══════════════════════════════════════════════════════════════════════════
   Trial accounts, with no database.

   An admin creates a trial for a client; the client gets a link. The link
   carries a signed pass: who the trial is for and when it ends, sealed with
   TRIAL_SECRET so nobody can forge one or stretch its end date. Verifying a
   pass needs only the secret, so nothing is stored anywhere and the whole
   thing runs free on a Vercel function.

   POST /api/trial  { action: 'create', password, company, name, email, days }
                    -> { token, trial }           (admin only: ADMIN_PASSWORD)
   POST /api/trial  { action: 'verify', token }
                    -> { trial } | 401 { error }

   Environment (Vercel → Settings → Environment Variables):
     ADMIN_PASSWORD   what the admin types on /admin
     TRIAL_SECRET     any long random string; changing it cancels every link
     REVOKED_TRIALS   optional, comma-separated trial ids to cancel one by one
   ══════════════════════════════════════════════════════════════════════════ */

declare const process: { env: Record<string, string | undefined> };

export interface Trial {
  id: string;
  company: string;
  name: string;
  email: string;
  plan: string;
  /** Epoch ms. */
  issued: number;
  expires: number;
}

const DAY = 24 * 3600 * 1000;
const MAX_DAYS = 90;
const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Constant-time compare, so a wrong guess takes as long as a near miss. */
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function sign(trial: Trial, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(trial)));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

/** The trial a pass describes, or why it is no good. */
export async function open(
  token: string, secret: string, revoked: string[] = [], now = Date.now(),
): Promise<{ trial?: Trial; error?: string }> {
  const [body, mac, extra] = String(token).trim().split('.');
  if (!body || !mac || extra !== undefined) return { error: 'This trial link is not valid.' };
  let trial: Trial;
  try {
    if (!same(unb64url(mac), await hmac(secret, body))) return { error: 'This trial link is not valid.' };
    trial = JSON.parse(new TextDecoder().decode(unb64url(body)));
  } catch {
    return { error: 'This trial link is not valid.' };
  }
  if (revoked.includes(trial.id)) return { error: 'This trial has been closed.' };
  if (now >= trial.expires) return { error: 'This trial has ended.' };
  return { trial };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TRIAL_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!secret || !adminPassword) return json({ error: 'Trial accounts are not set up yet.' }, 503);
  const revoked = (process.env.REVOKED_TRIALS ?? '').split(',').map(s => s.trim()).filter(Boolean);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  if (input.action === 'verify') {
    const res = await open(clean(input.token, 4000), secret, revoked);
    return res.trial ? json({ trial: res.trial }) : json({ error: res.error }, 401);
  }

  if (input.action === 'create') {
    const given = await hmac(secret, clean(input.password, 200));
    if (!same(given, await hmac(secret, adminPassword))) {
      return json({ error: 'Wrong admin password.' }, 403);
    }
    // Checking the password only, so the admin page can unlock before creating anything.
    if (input.check) return json({ ok: true });

    const company = clean(input.company, 80);
    if (!company) return json({ error: 'Add the client’s company name.' }, 400);
    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(Number(input.days) || 14)));
    const issued = Date.now();
    const trial: Trial = {
      id: b64url(crypto.getRandomValues(new Uint8Array(6))),
      company,
      name: clean(input.name, 80),
      email: clean(input.email, 120),
      plan: 'Business',
      issued,
      expires: issued + days * DAY,
    };
    return json({ token: await sign(trial, secret), trial });
  }

  return json({ error: 'Unknown action.' }, 400);
}
