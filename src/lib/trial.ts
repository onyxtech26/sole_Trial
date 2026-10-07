/* ══════════════════════════════════════════════════════════════════════════
   The trial: who the visitor is, how long they have, and what they start with.

   There are no accounts. Starting the trial stamps today's date in the
   browser; the trial runs TRIAL_DAYS from then on the full Business plan, every
   screen included. Each visitor gets a private copy that costs nothing to host.
   ══════════════════════════════════════════════════════════════════════════ */

import type { StoreData, User } from '../types';
import { TRIAL_DAYS } from './config';

const USER_KEY = 'sole_trial_user';
const STARTED_KEY = 'sole_trial_started';
const DAY = 24 * 3600 * 1000;

export const TRIAL_USER: User = {
  id: 'trial',
  username: 'trial',
  name: 'Trial manager',
  initial: 'T',
  role: 'manager',
  roleLabel: 'Business trial',
};

/** Stamp the first day of the trial. Later starts keep the original date. */
export function startTrial(): void {
  try {
    if (!localStorage.getItem(STARTED_KEY)) localStorage.setItem(STARTED_KEY, String(Date.now()));
  } catch {
    /* private mode — the trial simply restarts with the window */
  }
}

/** Whole days left, counting today; 0 once the trial has ended. */
export function trialDaysLeft(): number {
  let started = Date.now();
  try {
    started = Number(localStorage.getItem(STARTED_KEY)) || started;
  } catch {
    /* private mode */
  }
  const used = Math.floor((Date.now() - started) / DAY);
  return Math.max(0, TRIAL_DAYS - used);
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
    /* private mode — the visitor just signs in again next time */
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
