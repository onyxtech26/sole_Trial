import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { getCurrentUser, signOut } from './lib/auth';
import { hydrate, onStoreError, refresh, teardown, useStore, primeFromCache } from './lib/store';
import type { User } from './types';
import { canSee, homeFor, type Screen } from './utils/access';
import type { Focus } from './screens/types';
import { today } from './utils/dates';

import { Splash } from './components/Splash';
import { Landing } from './components/Landing';
import { AdminView } from './components/AdminView';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DateRangeBar, initialRange, rangeOf, type RangeState } from './components/DateRangeBar';

import { TodayView } from './screens/TodayView';
import { BookingsView } from './screens/BookingsView';
import { GroupingView } from './screens/GroupingView';
import { ManifestsView } from './screens/ManifestsView';
import { MessagesView } from './screens/MessagesView';
import { ToursView } from './screens/ToursView';
import { TeamView } from './screens/TeamView';
import { FinanceView } from './screens/FinanceView';
import { CustomersView } from './screens/CustomersView';
import { GuidePortalView } from './screens/GuidePortalView';

import {
  Btn, C, ConfirmDialog, Modal, ModalFoot, ModalHead,
  ToastHost, useToast, type ConfirmSpec,
} from './ui/kit';

const TITLES: Record<Screen, [string, string]> = {
  today: ['Dashboard', 'Everything happening in the selected period'],
  bookings: ['Bookings', 'Imported from Viator and GetYourGuide'],
  groups: ['Grouping', 'Build groups, set tour times, assign guides'],
  manifests: ['Manifests', 'Printable daily runsheet'],
  messages: ['Messages', 'WhatsApp templates in three languages'],
  tours: ['Tours', 'Products and tour options'],
  team: ['Team', 'Guides and staff'],
  finance: ['Finance', 'Revenue, cost and balance'],
  crm: ['Customers', 'Traveller records, documents and history'],
  portal: ['My tours', 'Your assigned departures'],
};

/* Three doors, one bundle: the public landing page at "/", the admin page
   that creates client trials at "/admin", and the app itself at "/app". */
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return <Landing />;
  return (
    <ToastHost>
      {path === '/admin' ? <AdminView /> : <Shell />}
    </ToastHost>
  );
}

/** The pass from an invitation link (/app?invite=…), taken off the address bar
    once read so it is not left in history or shared by accident. */
function takeInvite(): string | null {
  const url = new URL(window.location.href);
  const invite = url.searchParams.get('invite');
  if (invite) {
    url.searchParams.delete('invite');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return invite;
}

function Shell() {
  const toast = useToast();
  const store = useStore();

  const [invite] = useState(takeInvite);
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [held, setHeld] = useState(true);       // minimum splash hold
  const [screen, setScreen] = useState<Screen>('today');
  const [range, setRange] = useState<RangeState>(initialRange);
  const [openRef, setOpenRef] = useState<string | null>(null);
  /** What the last jump asked the destination to point at. */
  const [focus, setFocus] = useState<Focus | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  useEffect(() => onStoreError(msg => toast(msg, 'bad')), [toast]);

  /* Restore a session, hydrate, and hold the splash for a beat so the brand
     does not flash past on a fast connection. */
  useEffect(() => {
    const timer = setTimeout(() => setHeld(false), 1200);
    (async () => {
      try {
        primeFromCache();
        // An invitation link always opens its own trial, even over another one.
        const u = invite ? null : await getCurrentUser();
        if (u) {
          await hydrate();
          setUser(u);
          setScreen(homeFor(u.role));
        }
      } catch (e) {
        console.error('Session restore failed:', e);
      } finally {
        setBooting(false);
      }
    })();
    return () => clearTimeout(timer);
  }, []);

  const handleSignedIn = useCallback(async (u: User) => {
    try {
      await hydrate();
    } catch (e) {
      console.error('Initial sync failed:', e);
      toast('Signed in, but the first data load failed.', 'warn');
    }
    setUser(u);
    setScreen(homeFor(u.role));
  }, [toast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    teardown();
    setUser(null);
    setScreen('today');
    setSignOutOpen(false);
  }, []);

  const go = useCallback((next: Screen, ref?: string, focus?: Focus) => {
    if (!user) return;
    // The role matrix is the only gate now; RLS enforces the same thing server
    // side, so there is nothing a second client-side prompt would add.
    if (!canSee(user.role, next)) return;
    setScreen(next);
    setOpenRef(ref ?? null);
    // A fresh object every time, so asking for the same rows twice still lands.
    setFocus(focus ?? null);
  }, [user]);

  const doRefresh = useCallback(async () => {
    setSyncing(true);
    try {
      await refresh();
      toast('Trial data lives in this browser');
    } catch {
      toast('Could not reach the database', 'bad');
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  const badges = useMemo(() => {
    const t = today();
    const needsAction = store.bookings.filter(
      b => b.date >= t && b.status !== 'Cancelled' && (!b.guide || !b.tourTime),
    ).length;
    return { bookings: needsAction } as Partial<Record<Screen, number>>;
  }, [store.bookings]);

  if (booting || held) return <Splash />;
  if (!user) return <LoginScreen onSignedIn={handleSignedIn} invite={invite} />;

  const [title, sub] = TITLES[screen];
  const rangeAware = screen === 'today' || screen === 'groups' || screen === 'finance';

  const shared = {
    store, user, range, rangeValue: rangeOf(range),
    onGo: go, setConfirm,
  };

  return (
    <div
      data-r="shell"
      style={{
        // Divided by --ui-scale: <html> is zoomed, so a raw 100vh would render
        // 10% taller than the window and push the shell off the bottom.
        display: 'flex', height: 'calc(100vh / var(--ui-scale))',
        width: '100%', overflow: 'hidden',
        background: C.paper, fontSize: 13, lineHeight: 1.45,
      }}
    >
      <Sidebar
        user={user}
        screen={screen}
        onNavigate={go}
        onSignOut={() => setSignOutOpen(true)}
        badges={badges}
      />

      {/* minHeight: 0 is load-bearing, not defensive. On desktop the shell is a
          row, so this column is stretched to the shell's height and `main` gets
          a bounded box to scroll inside. On a phone the shell turns into a
          column and height becomes the main axis — and a flex item's default
          `min-height: auto` refuses to shrink below its content, so this box
          grows past 100dvh, `main` never overflows, and the shell's
          overflow:hidden simply clips the page. Nothing scrolls. */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
      }}>
        <Header
          title={title}
          sub={sub}
          user={user}
          store={store}
          onGo={go}
          onRefresh={doRefresh}
          syncing={syncing}
        />

        <main data-r="pad" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18 }}>
          <div data-r="stack" style={{
            maxWidth: 1520, margin: '0 auto',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {rangeAware && (
              <DateRangeBar
                value={range}
                onChange={setRange}
                summary={rangeSummary(screen)}
              />
            )}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={screen}
                initial={{ opacity: 0, y: 12, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.995 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {screen === 'today' && <TodayView {...shared} onOpenBooking={r => go('bookings', r)} />}
                {screen === 'bookings' && (
                  <BookingsView
                    {...shared}
                    openRef={openRef}
                    setOpenRef={setOpenRef}
                    focus={focus}
                  />
                )}
                {screen === 'groups' && <GroupingView {...shared} />}
                {screen === 'manifests' && <ManifestsView {...shared} />}
                {screen === 'messages' && <MessagesView {...shared} />}
                {screen === 'tours' && <ToursView {...shared} />}
                {screen === 'team' && <TeamView {...shared} />}
                {screen === 'finance' && <FinanceView {...shared} />}
                {screen === 'crm' && <CustomersView {...shared} />}
                {screen === 'portal' && <GuidePortalView {...shared} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* ── sign out ── */}
      <Modal open={signOutOpen} onClose={() => setSignOutOpen(false)} width={380}>
        <ModalHead
          title="Sign out"
          sub="Your trial data stays in this browser for when you come back."
          onClose={() => setSignOutOpen(false)}
        />
        <ModalFoot>
          <Btn variant="ghost" onClick={() => setSignOutOpen(false)}>Stay signed in</Btn>
          <Btn variant="danger" onClick={handleSignOut}>Sign out</Btn>
        </ModalFoot>
      </Modal>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function rangeSummary(screen: Screen): string {
  if (screen === 'groups') return 'Grouping applies to this period';
  if (screen === 'finance') return 'Revenue and cost for this period';
  return '';
}
