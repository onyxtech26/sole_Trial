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

/** Where every "request a trial", "choose a plan" and "get SOLE" button goes.
    Add ?intent=trial|buy or ?plan=<id> so the message arrives pre-written. */
export const CONTACT_URL = '/contact';

/** Who sells and supports SOLE, shown on /contact. */
export const VENDOR = {
  name: 'Onyxx Tech Hub',
  website: 'https://www.onyxxtechhub.com.my/',
  email: 'onyxtech26@gmail.com',
  /** WhatsApp numbers in international format, digits only after the +. */
  whatsapp: [
    { name: 'Kuna Costa', number: '+601139884927' },
    { name: 'Rooben', number: '+60194688052' },
  ],
};
