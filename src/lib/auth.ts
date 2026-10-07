import type { User } from '../types';
import { TRIAL_USER, setTrialSignedIn, startTrial, trialDaysLeft, trialSignedIn } from './trial';

/* The trial has no accounts: starting it signs the visitor in as a manager,
   so every screen, Finance included, is open to try. Once the trial has run
   out, nobody is signed in and the front door says so. */

/** The trial user, with the days left where a real user shows their role. */
function trialUser(): User | null {
  const left = trialDaysLeft();
  if (left === 0) return null;
  return { ...TRIAL_USER, roleLabel: `Business trial · ${left} day${left === 1 ? '' : 's'} left` };
}

export async function getCurrentUser(): Promise<User | null> {
  return trialSignedIn() ? trialUser() : null;
}

export async function signIn(): Promise<{ user?: User; error?: string }> {
  startTrial();
  const user = trialUser();
  if (!user) return { error: 'This trial has ended.' };
  setTrialSignedIn(true);
  return { user };
}

export async function signOut(): Promise<void> {
  setTrialSignedIn(false);
}
