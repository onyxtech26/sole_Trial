import type { StoreData, User } from '../types';
import type { Screen } from '../utils/access';
import type { RangeState } from '../components/DateRangeBar';
import type { ConfirmSpec } from '../ui/kit';

/**
 * A jump between screens that carries what to look at, not just where to go.
 *
 * Sending someone to Bookings to deal with four reservations out of twelve
 * hundred is only half an instruction. The saved view narrows the table to the
 * right question and the refs say which rows answered it, so the destination
 * can point at them rather than leaving the reader to search.
 */
export interface Focus {
  /** The saved view the destination should open on. */
  view?: string;
  /** The reservations to single out once it gets there. */
  refs: string[];
  /** How to describe them, so the destination can say what it is showing. */
  label?: string;
}

/** Everything App hands every screen. */
export interface ViewProps {
  store: StoreData;
  user: User;
  range: RangeState;
  /** The resolved [start, end] for the header's period filter. */
  rangeValue: [string, string];
  onGo: (screen: Screen, ref?: string, focus?: Focus) => void;
  setConfirm: (spec: ConfirmSpec | null) => void;
}
