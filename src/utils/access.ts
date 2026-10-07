import type { Role } from '../types';

export type Screen =
  | 'today' | 'bookings' | 'groups' | 'manifests' | 'messages'
  | 'tours' | 'team' | 'finance' | 'crm' | 'portal';

/* Role matrix
   ───────────
   manager     full access, including Finance
   operations  everything except Finance
   guide       their own portal and the manifests for tours assigned to them

   The server enforces the part that matters: RLS on `expenses` is limited to
   current_app_role() = 'manager', so hiding Finance here is a courtesy, not
   the security boundary. */
const MATRIX: Record<Role, Screen[]> = {
  manager: ['today', 'bookings', 'groups', 'manifests', 'messages', 'tours', 'team', 'finance', 'crm'],
  operations: ['today', 'bookings', 'groups', 'manifests', 'messages', 'tours', 'team', 'crm'],
  guide: ['portal', 'manifests'],
};

export const canSee = (role: Role, screen: Screen): boolean =>
  MATRIX[role]?.includes(screen) ?? false;

export const screensFor = (role: Role): Screen[] => MATRIX[role] ?? [];

/** Where a role lands after signing in. */
export const homeFor = (role: Role): Screen => (role === 'guide' ? 'portal' : 'today');

/** Only managers may see money. Operations get the rest of the app. */
export const canSeeMoney = (role: Role): boolean => role === 'manager';
