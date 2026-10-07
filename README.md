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

## Pages

- `/` the public landing page: features, how it works, pricing, FAQ.
  Plans and prices live in `src/lib/pricing.ts`.
- `/admin` where the admin creates a trial for a client and sends the link.
- `/app` the system itself, opened from the client's trial link.

## How client trials work

- **The admin creates each trial** on `/admin` (company, contact, length) and
  sends the client the link by WhatsApp or email.
- **No database.** `api/trial.ts`, a Vercel function, signs each trial's
  company and end date with `TRIAL_SECRET`. The link carries that pass, so it
  cannot be forged or stretched, and the server keeps no record.
  The admin page lists the trials created in that admin's browser.
- **The client gets the full Business plan** until the end date, with their
  company name on screens and printouts. Each trial's data stays in the
  client's browser, separate per trial (localStorage, about 5 MB; images
  inline up to 500 kB).
- **Vercel settings:** `ADMIN_PASSWORD` (for `/admin`), `TRIAL_SECRET`
  (changing it cancels every link) and optional `REVOKED_TRIALS`
  (comma-separated trial ids to close early; redeploy after changing).
- **Imports** the Viator reservations export and the GetYourGuide supplier
  bookings export from the Dashboard (`src/utils/viator.ts`,
  `src/utils/getyourguide.ts`).
- A new trial starts with two sample guides, one staff member and one
  message template (`src/lib/trial.ts`).

## Layout

```
api/trial.ts          creates and checks signed client trials
src/
  App.tsx             landing, admin and app routes; splash, trial door, shell
  lib/
    config.ts         company name, trial length, contact link
    pricing.ts        the plans on the landing page
    trial.ts          trial user, countdown, starter data
    store.ts          the browser-only store: one commit(), useStore()
    auth.ts           sign-in from the trial link
    upload.ts         uploads as inline data URLs
  components/         Landing, AdminView, LoginScreen, shell parts
  utils/              dates, selectors, viator + getyourguide import, exports
  screens/            one file per screen, plus BookingDrawer
design/               the approved visual handoff the screens are built from
```

Keep `design/` as the reference when changing layout, as in the full SOLE repo.

`xlsx` comes from SheetJS's own CDN tarball, not npm; the npm build has
unpatched advisories. It and `jspdf` load only when an import or export runs.

Deployed on Vercel as a Vite SPA (`vercel.json`).
