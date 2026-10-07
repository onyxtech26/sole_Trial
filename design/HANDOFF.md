# Handoff: SOLE — Tour Operator Management System

## Overview
SOLE is the internal operations system for **Sun Tours Travels** (Rome / North Cyprus tour operator). It replaces a manual workflow of Viator CSV exports + Excel grouping sheets + hand-typed WhatsApp messages with one tool covering: importing reservations, grouping them into departures, assigning guides, printing manifests, sending traveller messages, and tracking per-booking finance.

The design in this bundle is a complete, high-fidelity, interactive prototype of eight screens plus a login gate.

## About the Design Files
The files here are **design references created in HTML** — a prototype demonstrating intended look, layout, copy and behaviour. They are **not production code to copy**.

`SOLE.dc.html` is authored in a proprietary streaming-template runtime (`<x-dc>` template + a `class Component extends DCLogic` logic class, `support.js`). Do **not** try to port that runtime. Instead:

- The target repo is **`onyxtech26/Sole`** (branch `main`) — a React + TypeScript app. Recreate these designs there using its existing components, routing and styling patterns.
- Read the HTML for exact pixel values, colors, copy, column widths and interaction detail; it is the source of truth for visual fidelity.
- The `{{ token }}` holes are template value bindings; the `sc-for` / `sc-if` tags are loop/conditional. Read them as `.map()` and conditional render.
- All styling in the prototype is inline. In the real app use the project's CSS/Tailwind conventions — but keep the exact values below.

To view the prototype: open `SOLE.dc.html` in a browser (it needs `support.js` and `public/` alongside it, as laid out in this folder).

## Fidelity
**High-fidelity.** Colors, type, spacing, row heights and column widths are final and intentional. Recreate them exactly. The screens were reviewed against the client's real working documents (their "Print 5 oct" grouping sheet, their Viator export, their WhatsApp message sheet), so the *information architecture is also final* — do not rearrange columns or re-add removed features.

## Existing repo mapping
| Screen in prototype | Repo file to rebuild |
| --- | --- |
| Shell + sidebar | `src/App.tsx`, `src/index.css` |
| Today | `src/components/DashboardView.tsx` |
| Bookings + detail drawer | `src/components/BookingsView.tsx`, `src/types.ts` |
| Grouping | `src/components/ScheduleView.tsx` |
| Manifests | `src/components/ReportsView.tsx` |
| Messages | `src/components/WhatsappTemplateManager.tsx` |
| Tours | `src/components/ProductsView.tsx` |
| Team | `src/components/GuidesView.tsx` |
| Finance | `src/components/FinanceView.tsx` |
| **Delete** | `src/components/CustomersView.tsx` (CRM) and the VIP Fleet screen |

CRM and Fleet were **removed deliberately** — the client did not use or understand either. Guests live inside booking records; drivers live in Team.

---

## Design Tokens

### Color
| Token | Hex | Use |
| --- | --- | --- |
| Navy (ink / brand) | `#0b1220` | Sidebar, body text, primary buttons, group band headers |
| Orange (accent) | `#fd9707` | Accent only: badges, active markers, avatar chip, focus |
| Orange on navy | `#fdb44e` | Accent text over navy |
| Orange tint on navy | `rgba(253,151,7,.16–.20)` | Badge fills on navy |
| Link / muted accent | `#b26100` | Links, small inline action text |
| App background | `#f6f7f9` | Page canvas |
| Surface | `#ffffff` | Cards, tables, drawer |
| Surface subtle | `#fafbfc` | Inputs, secondary buttons, row hover |
| Border | `#e0e4ea` | Inputs, controls |
| Border light | `#e5e8ed` | Buttons, cards |
| Divider | `#f2f4f7` / `#f7f8fa` | Table row separators |
| Text primary | `#0b1220` | |
| Text secondary | `#5b6472` | |
| Text muted | `#6b737f`, `#79818f`, `#8a919e` | |
| Text faint | `#a4abb6`, `#a9b0ba`, `#98a0ac`, `#c9ced7` | Mono metadata, placeholder icons |
| Success | fg `#0f6b48` on bg `#e8f5ef` | Confirmed / paid states |
| Sidebar divider | `rgba(255,255,255,.08)` | |
| Scrollbar thumb | `#d3d7de` | |

**No gradients, no glassmorphism, no shadows beyond flat borders.** Max two background colors per view. This was an explicit correction from an earlier over-styled version — keep surfaces flat.

### Typography
- UI: **Outfit** (Google Fonts), weights 300/400/500/600/700.
- Numeric / codes / times / refs / phones: **JetBrains Mono**, weights 400/500/600.
- Base: `font-size: 13px; line-height: 1.45` on the shell. This is a **dense** interface — it must be.
- Scale actually used: 9px, 9.5px, 10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px.
- Small uppercase labels: `font-size: 9px; letter-spacing: .06em; text-transform: uppercase; font-weight: 600`.
- Numbers in columns: `font-variant-numeric: tabular-nums`.
- Times/refs with mono get `letter-spacing: -.03em` where called out.
- Body copy: `text-wrap: pretty`.

### Spacing / geometry
- Radii: `4px` (small badges), `5px` (chips, small buttons), `6px` (buttons, inputs, nav items), `7px` (cards, banners).
- Control height: `30px` for inputs and toolbar buttons; button padding `5–6px / 9–11px`.
- Sidebar width `212px`; topbar height `54px`; brand row `54px`.
- Table row padding `7–11px` vertical, `14–15px` horizontal.
- Icons: 12–15px stroke icons, `stroke-width: 2`, round caps/joins (Lucide-style).

---

## Screens

### 0. Login
Full-screen gate with `public/login-bg.png`. Three accounts, all fully privileged: **Sina** (Owner), **Masoud** (Operations), **Tina** (Reservations). Selecting one signs in. Sidebar footer button cycles the active user; sign-out returns to login.

### 1. Today
Purpose: what happens today and what is blocked.
- **Metric card row** — responsive; revenue-bearing cards are **PIN-locked** (see PIN below) and show an "Unlock" button with a lock icon instead of the number.
- **Today's departures** runsheet: time column (56px, mono 12.5px + a small uppercase relative label like NOW / SOON), tour name + TG code, detail line, right-aligned guide chip (colored pill) with guide phone in mono beneath. Links to Grouping.
- **Needs attention** list: date + time stack, then booking that is missing a name, confirmation, time coordination, or review.
- **Import card**: reads the Viator export XLSX/CSV as-is; dashed drop target, "Choose export file". Badge `XLSX · CSV`.
- Tabs: **Today / Week / Month**.

### 2. Bookings
Dense table, **38px rows**.
Column order and widths (px, `flex-shrink:0` unless noted):
`checkbox 28 · ref 104 (mono 11) · date 52 · res. time 52 (mono, muted) · tour time 58 (mono, bold, colored by state) · tour + TG label (flex, min 180) · lead traveller 124 · pax · language · workflow stamps · amount 70 (right, mono)`

- **Saved views** as a chip row with mono counts: All, Upcoming, Needs action, etc.
- **Workflow stamps**: four toggleable states per booking, in order — **Name collected → Confirmed → Time coordination → Review requested** (`wf: [0|1, 0|1, 0|1, 0|1]`).
- Multi-select shows a navy action bar: `N selected` + bulk actions.
- Toolbar: Filters, and a navy **New booking** button.
- Clicking a row opens a **detail drawer**: booking fields, traveller list (name + Adult/Child), phone, language, notes, per-booking finance, and inline editing (edits are patched per-ref, not destructive to the source record).

**Two important data rules:**
1. **Reservation time** is parsed from the Viator tour-level code (`TG2~14:00` → `14:00`). It is what the customer booked.
2. **Tour time** is a *separate*, initially empty field, filled by ops after grouping. Both are shown; they often differ.

### 3. Grouping
The core screen. Replaces a vertical dispatch board with the client's **horizontal grouped runsheet** (matching their printed "Print 5 oct" sheet).
- Toolbar: **Daily / Weekly / Monthly** period toggle, a native date input, a range label, **New group**, and a navy **Export manifest**.
- **Ungrouped queue** (top): rows at `min-width: 980px`, drag handle `⠿` (24px), ref 96 (mono 10.5), tour 150, date 52, res. time 46 (mono), traveller name (flex, min 120), age 48, phone 112 (mono 10.5), and an orange-text "Assign" button.
- **Group bands**: navy header bar (`#0b1220`, white text) with a `GRP n` badge in orange-tint, tour name, pax count, tour time, and guide assignment. Under it, member rows in the same column rhythm.
- Pax bands are capacity-aware: each product TG option carries a capacity (`cap`) and the band warns when exceeded.

### 4. Manifests
Print/PDF-ready guide manifest per group. **Deliberately drops** four columns present in the client's old sheet: Booked Time, Split, Notes, Check-In. **Adds** the guide's phone number in the header. Keep it to what the guide needs in hand.

### 5. Messages
Templated traveller messaging matching the client's "Sending Message" sheet. Templates are editable in-app, in **three languages (EN / IT / DE-etc. per booking `lang`)**, and map onto the four workflow stamps (name request, confirmation, time coordination, review request).

### 6. Tours
Products with TG sub-products and capacity. Real data:

| Code | Name | TG options (capacity) |
| --- | --- | --- |
| 5524558P1 | Colosseum Group | TG1 Group Tour, TG2 Semi-Private — see file |
| 5524558P4 | Private Colosseo | TG1 Private Luxury (7), TG2 Couple Tour (2) |
| 5524558P3 | Vatican Museum | TG1 Vatican Group (24), TG2 Vatican Semi-Private (7) |
| 5524558P19 | Walking Highlights | TG1 Highlights Walk (7) |
| 5524558P2 | Golf Cart Rome | TG1 Golf Cart Group (7) |
| 5524558P18 | Rome Photo Shoot | TG1 Standard Shoot (5) |
| 5524558P10 | Famagusta Tour | TG1 Private Cyprus Tour (7) |

Rows support drag reorder.

### 7. Team
Split into **Guides** and **Staff**.
- Guide: `id, name, phone, langs, skills, rating, avail` (`Active` / `On break`). Eight guides (G-201…G-208): Susanna, Carlo, Maria Teresa, Mehdi, Daria, Sandro, Pegah, Alina.
- Staff: `id, name, role, phone, duties` — Sina (Owner), Masoud (Operations), Tina (Reservations).

### 8. Finance
PIN-gated. **Weekly Sunday–Saturday view.** Per booking: **Viator (gross) / Spent / Balance**. Five fixed expense categories (see prototype). All roles may access after PIN.

---

## Interactions & Behavior

### PIN gate
- PIN is **`7967`** (4 digits). It gates **both** the Finance screen and the revenue metric cards on Today.
- State: `unlocked`, `pinOpen`, `pin`, `pinError`. Wrong PIN sets `pinError` and clears the field. Once unlocked, stays unlocked for the session.
- In production this must be a server-checked value, not a client constant.

### Editing model
Bookings are read from a source list and overlaid with a per-ref patch map:
```
book(ref)  = { ...source(ref), ...edits[ref] }
patch(ref, obj) → edits[ref] = { ...edits[ref], ...obj }
```
Recreate as an optimistic-update layer over the API, not by mutating the list.

### Sorting / filtering
Default sort: `date + (tourTime || resTime)` ascending. Saved views filter by date-relative and workflow-completeness predicates (e.g. "needs action" = any of the first three workflow stamps unset **and** date ≥ today).

### Responsive
- Sidebar (212px) collapses to a **horizontal rail** at tablet and phone widths.
- Today's metric cards reflow at tablet width.
- Wide tables scroll horizontally with a `min-width` (980px on the grouping queue) rather than reflowing — ops uses this on a laptop.

### Hover / active
- Nav item and table row hover: `background: #fafbfc` (light) or a subtle white tint on navy.
- Secondary button hover: border darkens to `#cfd4dc`.
- Navy primary button hover: slight lift in lightness — see `style-hover` attributes in the file for the exact pairs.

---

## State Management
Top-level state in the prototype (recreate as route state + a store/query layer):

```
screen        'today' | 'bookings' | 'groups' | 'manifests' | 'messages' | 'tours' | 'team' | 'finance'
view          active saved view on Bookings
selected      string[] of booking refs (multi-select)
openRef       booking ref shown in the detail drawer, or null
edits         { [ref]: Partial<Booking> }  — optimistic edits
userIdx       active user index into USERS
signedIn      boolean (login gate)
unlocked      boolean (PIN)
pinOpen, pin, pinError
period        'day' | 'week' | 'month'   (Grouping)
groupDate     ISO date string            (Grouping anchor)
```

### Data fetching (production)
- Bookings, products, guides, staff, groups: server-backed.
- Import endpoint that accepts the raw Viator export file.
- Group assignment and workflow-stamp toggles are per-booking mutations.
- Finance figures should be computed server-side and returned only after PIN authorisation.

## Data Model
```ts
type Booking = {
  ref: string;          // 'BR-1421517077' — Viator booking number, the dedupe key
  code: string;         // product code, e.g. '5524558P1'
  tg: string;           // tour level, 'TG1' | 'TG2' ...
  date: string;         // ISO date
  resTime: string;      // 'HH:MM' parsed from the TG code
  tourTime: string;     // 'HH:MM', empty until ops fills it after grouping
  lang: string;         // 'EN' | 'IT' | 'DE' ...
  guide: string;        // guide name, '' if unassigned
  grp: number;          // group number, 0 = ungrouped
  phone: string;
  travelers: [name: string, age: 'Adult' | 'Child'][];
  gross: number;        // Viator net price paid to operator
  spent: number;
  wf: [0|1, 0|1, 0|1, 0|1]; // name / confirmed / time-coordination / review
  status: 'Confirmed' | 'Modified';
  notes: string;
};

type Product = { code: string; name: string; label: string;
                 options: { tg: string; title: string; cap: number }[] };
type Guide   = { id: string; name: string; phone: string; langs: string;
                 skills: string; rating: number; avail: 'Active' | 'On break' };
type Staff   = { id: string; name: string; role: string; phone: string; duties: string };
```

## Viator import mapping
Import **only these columns** from the Viator reservations export (the client's "green columns"):

| Col | Italian header | Maps to |
| --- | --- | --- |
| A | Numero di prenotazione | `ref` (dedupe / update key) |
| C | Prezzo netto | `gross` |
| E | Stato | `status` |
| F | Data di viaggio | `date` |
| G | Nome viaggiatore principale | lead traveller |
| H | Contatti | `phone` |
| J | Adulti | adult count |
| M | Bambini | child count |
| O | Codice prodotto | `code` |
| P | Nome prodotto | product name |
| Q | Codice livello del tour | `tg` + `resTime` (`TGn~HH:MM`) |
| R | Titolo livello del tour | TG option title |
| AC | Lingua del tour | `lang` |

Status translation: `Confermata → Confirmed`, `Modificata → Modified`, `Cancellata → skip the row`.
Dedupe and **update** on booking number — re-importing must not duplicate.

### Two open questions for the client (unresolved)
1. The export has no reservation **date** column separate from travel date — should Viator's export be extended?
2. The export carries **adults / children only** — do they need senior / youth / infant fare types?
Build the fare-type field extensibly in case (2) comes back as yes.

## Assets
In `public/`:
- `logo-mark.png` — sidebar mark, rendered at `height: 18px`
- `logo.png` — full lockup
- `login-bg.png` — login screen background
- `favicon.png`

`icons/` holds supporting icon files. Inline icons in the prototype are stroke SVGs (Lucide set, `stroke-width: 2`) — use your existing icon library rather than copying the paths.

## Files in this bundle
- `SOLE.dc.html` — the full design (all nine views, all logic). Primary reference.
- `support.js` — runtime required only to open the prototype in a browser. **Do not port.**
- `public/`, `icons/` — assets.
- `github.md` — repo/branch and screen→source mapping, kept in sync with the design.
