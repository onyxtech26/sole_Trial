/* The five-step message workflow, in one place so the badge on the Bookings
   table, the checklist in the booking drawer, and the progress bars on the
   dashboard can never drift out of step with each other.

   `stage` is what a Template in Messages is filed under — it is NOT the same
   number as the step's position below. Ticket was added after Name, Confirm,
   Time and Review already had templates saved against stages 1-4, so it takes
   the next free number (5) instead of being inserted into the middle of that
   run. Insert it numerically and every template anyone had already written
   for "time coordination" (old stage 3) or "review" (old stage 4) would
   silently point at the wrong step. */
export interface WfStep {
  key: string;
  /** Single-letter badge shown on the Bookings table and the drawer checklist. */
  letter: string;
  label: string;
  /** Matches Template.stage — stable, independent of display order below. */
  stage: number;
  color: string;
}

export const WF_STEPS: WfStep[] = [
  { key: 'names', letter: 'N', label: 'Name collected', stage: 1, color: '#0b1220' },
  { key: 'confirm', letter: 'C', label: 'Confirmed', stage: 2, color: '#1f4e8c' },
  { key: 'ticket', letter: 'T', label: 'Ticket issued', stage: 5, color: '#8a5106' },
  { key: 'meeting', letter: 'M', label: 'Meeting details sent', stage: 3, color: '#fd9707' },
  { key: 'review', letter: 'R', label: 'Review requested', stage: 4, color: '#0f6b48' },
];

export const WF_LABELS: string[] = WF_STEPS.map(s => s.label);
export const WF_COLORS: string[] = WF_STEPS.map(s => s.color);

/** Every step except the last (Review) — "still has outgoing messages to send". */
export const wfOutstanding = (wf: number[]): boolean =>
  WF_STEPS.slice(0, -1).some((_, i) => !wf[i]);
