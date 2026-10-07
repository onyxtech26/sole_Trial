import type { User } from '../types';
import { setCompany } from './config';
import {
  TRIAL_USER, saveTrialAccount, setTrialSignedIn, trialAccount, trialDaysLeft,
  trialSignedIn, trialToken, type TrialAccount,
} from './trial';

/* A client signs in by opening the trial link the admin sent them. The server
   checks the pass in it (api/trial.ts) and the client is signed in as the
   manager of their own company, so every screen, Finance included, is open to
   try. Once the trial has run out, nobody is signed in and the front door says so. */

/** The client, with the days left where a real user shows their role. */
function trialUser(): User | null {
  const trial = trialAccount();
  const left = trialDaysLeft();
  if (!trial || left === 0) return null;
  setCompany(trial.company);
  const name = trial.name || TRIAL_USER.name;
  return {
    ...TRIAL_USER,
    name,
    initial: name.charAt(0).toUpperCase() || 'T',
    roleLabel: `${trial.plan} trial · ${left} day${left === 1 ? '' : 's'} left`,
  };
}

/** Ask the server whether a pass is still good. Null when it could not be reached. */
async function verify(token: string): Promise<{ trial?: TrialAccount; error?: string } | null> {
  try {
    const res = await fetch('/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'verify', token }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.trial) return { trial: body.trial };
    if (res.status === 401) return { error: body.error || 'This trial link is not valid.' };
    return null;
  } catch {
    return null;
  }
}

/** Pull the pass out of a pasted trial link, or take a pasted pass as is. */
export function tokenFrom(text: string): string {
  const t = text.trim();
  try {
    return new URL(t).searchParams.get('invite') ?? t;
  } catch {
    return t;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (!trialSignedIn()) return null;
  const token = trialToken();
  if (!token) return null;
  // Re-check with the server so a closed trial closes here too. Offline, the
  // signed end date this browser already holds still applies.
  const res = await verify(token);
  if (res?.trial) saveTrialAccount(token, res.trial);
  else if (res?.error) {
    setTrialSignedIn(false);
    return null;
  }
  return trialUser();
}

export async function signIn(link: string): Promise<{ user?: User; error?: string }> {
  const token = tokenFrom(link);
  if (!token) return { error: 'Paste the trial link from your invitation.' };
  const res = await verify(token);
  if (!res) return { error: 'Could not reach SOLE. Check your connection and try again.' };
  if (!res.trial) return { error: res.error };
  saveTrialAccount(token, res.trial);
  const user = trialUser();
  if (!user) return { error: 'This trial has ended.' };
  setTrialSignedIn(true);
  return { user };
}

export async function signOut(): Promise<void> {
  setTrialSignedIn(false);
}
