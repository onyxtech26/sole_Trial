/* ══════════════════════════════════════════════════════════════════════════
   The trial: who the visitor is, how long they have, and what they start with.

   An admin creates a trial for a client on /admin and sends them a link. The
   link carries a pass signed by the server (api/trial.ts) with the client's
   company and end date, so it cannot be forged or stretched. The client runs
   the full Business plan until then, with their data kept in their own
   browser, one private copy per trial. Nothing is stored on a server.
   ══════════════════════════════════════════════════════════════════════════ */

import type { StoreData, User } from '../types';

const USER_KEY = 'sole_trial_user';
const ACCOUNT_KEY = 'sole_trial_account';
const DAY = 24 * 3600 * 1000;

/** A client's trial, as the admin created it and the server signed it. */
export interface TrialAccount {
  id: string;
  company: string;
  name: string;
  email: string;
  plan: string;
  issued: number;
  expires: number;
}

interface Saved {
  token: string;
  trial: TrialAccount;
}

export const TRIAL_USER: User = {
  id: 'trial',
  username: 'trial',
  name: 'Trial manager',
  initial: 'T',
  role: 'manager',
  roleLabel: 'Business trial',
};

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

/** The trial this browser was opened with, if any. */
export function trialAccount(): TrialAccount | null {
  return readSaved()?.trial ?? null;
}

export function trialToken(): string | null {
  return readSaved()?.token ?? null;
}

export function saveTrialAccount(token: string, trial: TrialAccount): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ token, trial }));
  } catch {
    /* private mode — the client opens their link again next time */
  }
}

/** Whole days left, counting today; 0 once the trial has ended or before one is opened. */
export function trialDaysLeft(): number {
  const trial = trialAccount();
  if (!trial) return 0;
  return Math.max(0, Math.ceil((trial.expires - Date.now()) / DAY));
}

export function trialSignedIn(): boolean {
  try {
    return localStorage.getItem(USER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTrialSignedIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(USER_KEY, '1');
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode — the client just opens their link again */
  }
}

/** Enough reference data that grouping and messaging work before any import. */
export const TRIAL_SEED: Partial<StoreData> = {
  guides: [
    {
      id: 'trial-guide-1', name: 'Giulia Rossi', phone: '+39 333 000 0001',
      langs: 'EN · IT', skills: 'Colosseum, Vatican', rating: 4.8,
      avail: 'Active', image: '', reviews: [],
    },
    {
      id: 'trial-guide-2', name: 'Marco Bianchi', phone: '+39 333 000 0002',
      langs: 'EN · ES · IT', skills: 'Photoshoots, city walks', rating: 4.6,
      avail: 'Active', image: '', reviews: [],
    },
  ],
  staff: [
    {
      id: 'trial-staff-1', name: 'Sara Conti', role: 'Operations',
      phone: '+39 333 000 0003', duties: 'Grouping, guest messages', image: '',
      langs: '', rating: 0, avail: 'Active',
    },
  ],
  templates: [
    {
      id: 'trial-tpl-1', stage: 3, name: 'Meeting point', when: 'Day before',
      en: 'Hello {lead}! Your tour starts tomorrow at {time}. Meet your guide at the meeting point 10 minutes early.',
      es: '¡Hola {lead}! Tu tour empieza mañana a las {time}. Encuentra a tu guía en el punto de encuentro 10 minutos antes.',
      it: 'Ciao {lead}! Il tuo tour inizia domani alle {time}. Incontra la guida al punto di ritrovo 10 minuti prima.',
      images: [],
    },
  ],
};
