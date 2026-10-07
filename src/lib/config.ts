/* SOLE trial configuration. This build has no database: every visitor's data
   lives in their own browser (see lib/store.ts and lib/trial.ts). */

/** The operator's name on screens and printouts. A trial is unbranded. */
export const COMPANY = 'Your company';

/** Length of the free trial, counted from the visitor's first sign-in. */
export const TRIAL_DAYS = 14;

/** Where "Get SOLE for your business" sends an interested operator. */
export const CONTACT_URL = 'https://onyxx-tech.vercel.app/index.html';
