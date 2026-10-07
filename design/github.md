repo: onyxtech26/Sole
branch: main

## Last sync
date: 2026-07-25T03:24:00Z

### Updated in this project
- Rebuilt SOLE around the client's real working format: Sun Tours Travels grouping sheet, Viator export columns and WhatsApp template set.
- Grouping screen replaces the vertical dispatch board with the horizontal grouped runsheet (GRP / No / tour / res. time / tour time / passenger / phone / guide) and Daily / Weekly / Monthly views.
- Bookings carry reservation time plus a separate tour time, and a four-stage message workflow (name, confirmation, coordination, review).
- Finance gated behind the 4-digit PIN with Viator / Spent / Balance per booking and the five fixed expense categories; CRM and Fleet screens removed.

## Screen map
| Project screen | Repo source | Client input |
| --- | --- | --- |
| SOLE.dc.html · shell + sidebar | src/App.tsx, src/index.css | 3 user accounts (Sina, Masoud, Tina) |
| SOLE.dc.html · Today | src/components/DashboardView.tsx | Word doc items 1–5 |
| SOLE.dc.html · Bookings + drawer | src/components/BookingsView.tsx, src/types.ts | Word doc items 6, 8 |
| SOLE.dc.html · Grouping | src/components/ScheduleView.tsx | Word doc items 6, 7; July 2026.xlsx "Print 5 oct" |
| SOLE.dc.html · Manifests | src/components/ReportsView.tsx | Word doc image 16 (columns removed, guide phone added) |
| SOLE.dc.html · Messages | src/components/WhatsappTemplateManager.tsx | July 2026.xlsx "Sending Message" |
| SOLE.dc.html · Tours | src/components/ProductsView.tsx | TG sub-products, drag reorder |
| SOLE.dc.html · Team | src/components/GuidesView.tsx | Guides/Staff split, phone numbers |
| SOLE.dc.html · Finance | src/components/FinanceView.tsx | PIN 7967, weekly view, 5 categories |
| Removed | src/components/CustomersView.tsx, VIP Fleet | Client did not understand either tab |

## Import mapping · Viator export
Green columns only: A Numero di prenotazione, C Prezzo netto, E Stato, F Data di viaggio, G Nome viaggiatore principale, H Contatti, J Adulti, M Bambini, O Codice prodotto, P Nome prodotto, Q Codice livello del tour (TGn~HH:MM → reservation time), R Titolo livello del tour, AC Lingua del tour. Confermata → Confirmed, Modificata → Modified, Cancellata → skipped. Dedupe and update on booking number.
