/* ══════════════════════════════════════════════════════════════════════════
   Domain model.

   These shapes are the ones the *design* speaks: short language codes, a
   traveller as a [name, type] pair, a four-step message workflow. The Supabase
   tables speak a slightly different dialect (full language names, travellers as
   "Name (Adult)" strings). lib/entities.ts is the only place that translates,
   so every screen below it works in one vocabulary.
   ══════════════════════════════════════════════════════════════════════════ */

export type Role = 'manager' | 'operations' | 'guide';

export interface User {
  id: string;
  username: string;   // login handle, e.g. "tina"
  name: string;       // display name, e.g. "Tina"
  initial: string;
  role: Role;
  roleLabel: string;  // "Owner" / "Operations" / "Reservations" / "Guide"
}

export type TravelerType = 'Adult' | 'Child';
/** [full name, adult or child] — index-aligned with the DB `travelers` array. */
export type Traveler = [string, TravelerType];

export type BookingStatus = 'Confirmed' | 'Modified' | 'Pending' | 'Cancelled';
/**
 * UI wording. 'Partly paid' maps to the DB's 'Partially Paid', and
 * 'Full refund' to its 'Refunded' — the column keeps its original values so
 * existing rows stay valid. 'Partial refund' is the one genuinely new state.
 */
export type PaymentStatus =
  | 'Paid' | 'Partly paid' | 'Unpaid' | 'Full refund' | 'Partial refund';

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Paid', 'Partly paid', 'Unpaid', 'Full refund', 'Partial refund',
];

export interface Booking {
  ref: string;
  code: string;            // product code
  tg: string;              // tour grade code, e.g. TG1
  date: string;            // YYYY-MM-DD
  resTime: string;         // time the traveller booked
  tourTime: string;        // time operations actually runs it
  lang: string;            // short code: EN / IT / ES …
  guide: string;           // assigned guide name ('' = unassigned)
  phone: string;
  travelers: Traveler[];
  gross: number;           // revenue
  spent: number;           // direct cost
  refundPct: number;       // 0-100, only meaningful when payment is a partial refund
  /** Hand-placed position in the Bookings table. 0 = never placed. */
  sortOrder: number;
  wf: number[];            // [names, confirmed, ticket, meeting, review] as 0/1
  status: BookingStatus;
  payment: PaymentStatus;
  notes: string;
  namesLocked: boolean;
  source: 'manual' | 'viator_import';

  /* Columns the previous build owns. Carried through untouched so writing a
     booking here never blanks a field the other app depends on. */
  tourName: string;
  tgTitle: string;
  meetingPoint: string;
  currency: string;
  leadTraveler: string;
  assignedDriver: string;
  okStatus: boolean;
  checkedIn: number[];
  namesComplete: boolean;
  serviceLineItems: ServiceLineItem[] | null;
}

export interface ServiceLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface ProductOption {
  tg: string;      // grade code
  title: string;
  cap: number;
  /**
   * Colours shown behind this option's reservations in Grouping, so a band can
   * be read by colour rather than by parsing tour codes. Both are optional and
   * default to '' — an option without a colour keeps the plain alternating
   * tint, so nothing changes until someone deliberately picks one.
   *
   * A second colour is for the cases operations asked about: an option that
   * needs to be told apart along two axes at once (say a language as well as a
   * tour), where one swatch cannot carry both.
   */
  color: string;   // '#rrggbb' or ''
  color2: string;  // '#rrggbb' or ''
}

export interface Product {
  code: string;
  name: string;    // short internal name
  label: string;   // full public title
  defaultCap: number;
  options: ProductOption[];
  image: string;   // public URL in the media bucket ('' = none)
}

/** One review of a guide, on a five-star scale. */
export interface GuideReview {
  id: string;
  date: string;       // YYYY-MM-DD
  rating: number;     // 1-5
  note: string;
  by: string;         // who recorded it
}

export interface Guide {
  id: string;
  name: string;
  phone: string;
  langs: string;      // display string, "EN · IT"
  skills: string;     // display string, comma separated
  /** Average of `reviews`, or the hand-set figure while there are none. */
  rating: number;
  avail: 'Active' | 'On break' | 'Unavailable';
  image: string;
  reviews: GuideReview[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;       // job title, e.g. "Operations"
  phone: string;
  duties: string;
  image: string;

  /* Guides and office staff share one table. These columns belong to the guide
     shape but exist on every row, so they ride along untouched — writing a
     staff member must not blank a colleague's languages or rating. */
  langs: string;
  rating: number;
  avail: Guide['avail'];
}

export interface TourGroup {
  id: string;
  date: string;
  code: string;
  tg: string;
  time: string;
  ticketTime: string;
  ticketStatus: string;
  guide: string;
  cap: number;
  notes: string;
  members: string[];   // "BOOKINGREF#travellerIndex"
  tourName: string;
}

export type ExpenseCategory = 'Guide' | 'Ticket' | 'Radio' | 'Staff Salary' | 'Other';

export interface Expense {
  id: string;
  cat: ExpenseCategory;
  customCat: string;
  amount: number;
  date: string;
  desc: string;
  status: 'Approved' | 'Pending';
  receiptUrl: string;
}

export interface Template {
  id: string;
  stage: number;
  name: string;
  when: string;
  en: string;
  es: string;
  it: string;
  /** Public sole-media URLs sent alongside the text — meeting-point photos and the like. */
  images: string[];
}

export interface CustomerDoc {
  name: string;
  type: string;
  url?: string;
}

export interface JourneyEntry {
  date: string;
  title: string;
  description: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  trips: number;
  preferences: string[];
  documents: CustomerDoc[];
  notes: string;
  journey: JourneyEntry[];
}

/**
 * One Viator export upload. Written once per import and never edited, so the
 * team shares a single audit trail of what was uploaded, by whom, and what it
 * actually changed.
 */
export interface ImportBatch {
  id: string;
  fileName: string;
  fileSize: number;      // bytes
  importedAt: string;    // ISO timestamp
  importedBy: string;    // auth user id ('' when unknown)
  importedByName: string;
  rowsTotal: number;     // rows in the file
  rowsAdded: number;
  rowsUpdated: number;
  rowsUnchanged: number;
  rowsCancelled: number; // rows that arrived as Cancellata and were applied
  rowsInvalid: number;   // no reference or no travel date
  source: string;
}

/** Everything the hybrid store keeps in sync with Supabase. */
export interface StoreData {
  bookings: Booking[];
  products: Product[];
  guides: Guide[];
  staff: StaffMember[];
  groups: TourGroup[];
  expenses: Expense[];
  templates: Template[];
  customers: Customer[];
  imports: ImportBatch[];
}

export type StoreKey = keyof StoreData;
