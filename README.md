# SOLE — free trial

The trial edition of SOLE, the operations system for tour operators: bookings,
grouping, manifests, messaging, tours, team, customers and finance. Same screens
and design as the full system, with no database behind it.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # -> dist/
npm run lint     # tsc --noEmit
```

## How the trial works

- **No accounts.** "Start the free trial" signs the visitor in as a manager on
  the Business plan, so every screen is open, Finance included.
- **14 days**, counted from the first start in that browser (`TRIAL_DAYS` in
  `src/lib/config.ts`). After that the front door shows "trial ended" and a
  "Get SOLE for your business" button (`CONTACT_URL`). The data stays in the
  browser, so a visitor who signs up can be shown it again.
- **All data stays in the visitor's browser** (localStorage, about 5 MB).
  Uploaded images are kept inline, up to 500 kB each. Nothing is sent to any
  server, so the trial costs nothing to host and holds no one else's data.
- **Imports** the Viator reservations export and the GetYourGuide supplier
  bookings export from the Dashboard (`src/utils/viator.ts`,
  `src/utils/getyourguide.ts`).
- A first visit starts with two sample guides, one staff member and one
  message template (`src/lib/trial.ts`).

The countdown is a sales tool, not a lock: clearing the browser's site data
restarts it, and with it wipes the visitor's data.

## Layout

```
src/
  App.tsx             shell: splash, trial door, sidebar, header, routing
  lib/
    config.ts         company name, trial length, contact link
    trial.ts          trial user, countdown, starter data
    store.ts          the browser-only store: one commit(), useStore()
    auth.ts           trial sign-in stand-in
    upload.ts         uploads as inline data URLs
  utils/              dates, selectors, viator + getyourguide import, exports
  screens/            one file per screen, plus BookingDrawer
design/               the approved visual handoff the screens are built from
```

Keep `design/` as the reference when changing layout, as in the full SOLE repo.

`xlsx` comes from SheetJS's own CDN tarball, not npm; the npm build has
unpatched advisories. It and `jspdf` load only when an import or export runs.

Deployed on Vercel as a Vite SPA (`vercel.json`).
