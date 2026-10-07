/* SOLE trial configuration. This build has no database: every visitor's data
   lives in their own browser (see lib/store.ts and lib/trial.ts). */

/** The operator's name on screens and printouts: the client's company once
    their trial is open. A live binding, so screens read the current name. */
export let COMPANY = 'Your company';

export function setCompany(name: string): void {
  COMPANY = name || 'Your company';
}

/** Trial length the admin page offers first. */
export const TRIAL_DAYS = 14;

/** Where "Get SOLE for your business" sends an interested operator. */
export const CONTACT_URL = 'https://onyxx-tech.vercel.app/index.html';
