/* SOLE's plans, as the landing page shows them. Edit prices here.

   Set against European tour software checked in October 2026: booking engines
   start at €29–49 a month plus 1.5–3% of every booking, mid tiers sit at
   €99–199, and none of them leads with grouping, manifests or WhatsApp. SOLE
   takes no cut of bookings and never counts guides as paid seats. */

export interface Plan {
  id: string;
  name: string;
  /** Euros a month, billed monthly. */
  monthly: number;
  /** Euros a month when billed yearly (two months free). */
  yearly: number;
  pitch: string;
  seats: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 39,
    yearly: 32,
    pitch: 'For a small team running a handful of tours a day.',
    seats: '3 office seats · unlimited guides',
    features: [
      'Viator and GetYourGuide imports',
      'Up to 300 bookings a month',
      'Grouping, guide assignment and manifests',
      'WhatsApp templates in three languages',
      'Guide portal on the phone',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 89,
    yearly: 74,
    pitch: 'The whole system, for operators with a full guide roster.',
    seats: '10 office seats · unlimited guides',
    features: [
      'Everything in Starter',
      'Unlimited bookings',
      'Finance: revenue, guide cost and balance',
      'Customer records and documents',
      'Excel and PDF exports',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 179,
    yearly: 149,
    pitch: 'For larger teams who want it set up with them.',
    seats: 'Unlimited seats · unlimited guides',
    features: [
      'Everything in Business',
      'Onboarding call with your team',
      'Your company name on every printout',
      'We import your past bookings for you',
      'Priority support on WhatsApp',
    ],
  },
];

/** Shown under every plan. */
export const PLAN_PROMISES = [
  'No commission on your bookings',
  '14-day free trial on Business',
  'Cancel any month',
];
