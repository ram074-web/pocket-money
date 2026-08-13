# Finance & Operations Control Center

An integrated Sales, Invoicing, Receivables & Payables management system for a
company running two divisions — **Digital Marketing Services** and
**Offline/Print Marketing Services** — serving large corporate customers and
working with multiple vendors.

This app is the working implementation of the "AI Finance & Operations
Management Agent" brief: a single source of truth for the full cycle
**Sales → Quotation → PO → Project → Invoice → Collection → Receivables →
Vendor Cost → Payables → Cash Flow → Profitability → Follow-up →
Communication**, replacing scattered Excel tracking.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS 4)
- **Prisma 6** + **SQLite** for data storage
- **ExcelJS** for spreadsheet import/export
- No external LLM dependency — the "Ask" feature and dashboard exceptions are
  computed by a deterministic rules/aggregation engine directly against the
  database, so every figure is traceable to a stored record (see "Data
  accuracy" below).

## Getting started

```bash
npm install
cp .env.example .env
npx prisma db push     # creates prisma/dev.db from the schema
npm run db:seed        # loads realistic sample data across both divisions
npm run dev
```

Open http://localhost:3000.

To reset to a clean demo state at any time, re-run `npm run db:seed` — it
wipes and reloads all tables.

## What's implemented

### Data model (`prisma/schema.prisma`)
Every entity from the spec: `Customer`, `Vendor`, `Employee`, `Project`,
`Quotation`, `PurchaseOrder`, `Invoice`, `Payment`, `InvoiceCorrection`,
`VendorPurchaseOrder`, `VendorInvoice`, `VendorPayment`,
`ProjectVendorCost` / `ProjectOtherCost` (for profitability),
`Communication`, `FollowUp`, `AuditLog`, and `ImportBatch` / `ImportRow` for
Excel import traceability. Invoice and vendor-invoice status enums mirror the
full lifecycle from Draft through Correction Required, Partially Paid,
Overdue, to Cancelled/Credit Note.

### Owner Dashboard (`/`)
Receivables (total/received/outstanding, overdue, due-in-7/30, ageing
0-30/31-60/61-90/90+, customer-wise outstanding), Payables (mirror view,
vendor-wise), Sales & Billing funnel (quotations → POs → invoices,
under-correction, cancelled/revised), Expected Net Cash Position (30-day
collections vs. vendor payments), and a Red/Amber/Green **Exceptions & Risk
Alerts** feed covering: overdue invoices, invoices under correction, PO
received but not invoiced, customers over their credit limit, overdue vendor
payments, vendor invoices pending approval, and PO-vs-invoice amount
mismatches.

### Customer 360° view (`/customers`, `/customers/[id]`)
Profile → quotations → POs → projects → invoices (with outstanding, status,
correction count) → payments → follow-up history → communication history, in
one page per customer.

### Vendor view (`/vendors`, `/vendors/[id]`)
Vendor payable position, linked customer projects (so you can see which
customer a vendor cost belongs to), POs, vendor invoices with approval status,
follow-ups and communications.

### Invoice Register (`/invoices`, `/invoices/[id]`)
Central register filterable by status. Each invoice detail page shows full
payment history, **complete correction history** (what was requested, by
whom, responsible person, corrected/resubmitted dates, reason for delay —
never overwritten or lost), communications, and draft follow-up /
correction-response emails ready for human approval before sending.

### My Action List (`/actions`)
Priority-sorted (Red/Amber/Green) queue across customer, vendor and internal
follow-ups — Priority | Who | Task | Amount | Due Date | Responsible | Next
Action — with a "Mark done" action per row.

### Project Profitability (`/projects`)
Revenue − Vendor Cost − Other Direct Costs = Gross Profit, with margin and a
below-threshold (15%) flag per project.

### Ask (`/ask`)
Natural-language owner questions (section 13 of the spec) answered in the
standard **Executive Summary / Financial Impact / Pending Items / Risks /
Responsible Person / Next Actions** format. Rule-based against the live
database — if a question doesn't match a known pattern, it explicitly returns
"Data not available" rather than guessing. See `src/lib/query-engine.ts` for
the full set of recognized question patterns (customer/vendor outstanding,
overdue invoices, highest outstanding customer, corrections pending, cash
position, employee follow-up load, invoices above a value threshold that are
overdue, POs without invoices, project margins, etc).

### Excel Import (`/import`)
Uploads an invoice register (.xlsx, template downloadable in-app) and:
- imports clean new rows automatically,
- **skips** rows whose invoice number already exists (no overwrite),
- **flags as a conflict** rows where an existing invoice number has a
  different amount (requires manual verification, not auto-resolved),
- flags missing required fields, unrecognized customers, and invalid date
  ranges,
- logs every row's outcome to `ImportBatch`/`ImportRow` for a permanent audit
  trail.

### Email + WhatsApp Inbox — test mode (`/inbox`, `/whatsapp`, `/permissions`)
A working implementation of the "WhatsApp + Email Integrated Business
Operations & Finance System" brief, running entirely in **test mode**: no real
Gmail account or WhatsApp Business API is connected, by explicit instruction.

- **`/inbox`** — click "Load Sample Scenarios" to run 9 realistic fixture
  messages (`src/lib/inbox/fixtures.ts`) through the full pipeline: classify →
  identify sender → extract fields → match against quotations/POs/invoices →
  route to the right role → draft the resulting action. Covers a customer
  quotation request, a customer PO (verified match → auto-drafts an invoice),
  a PO amendment (value mismatch → flagged for verification), an invoice
  correction request, a payment confirmation (recorded as unreconciled —
  never auto-confirmed), a customer payment commitment/follow-up, a vendor
  quotation, a vendor invoice with a missing PO (flagged), and a vendor
  payment status request. Each message's detail page shows all 10 outputs the
  spec asks for: classification, party identification, matching, extracted
  fields, required action, responsible role, financial impact, approval
  requirement, database changes, and the draft WhatsApp notification. A
  Routing Log table (Email → Classification → Person Responsible → Action →
  Status) is included. Re-running "Load Sample Scenarios" is idempotent;
  `npm run db:seed` fully resets it.
- **`/whatsapp`** — a chat-style simulator for the conversational commands in
  spec sections 6/7/11/12/13 (`Dashboard`, invoice/quotation/PO status,
  `Show <customer>`, morning/evening reports, and free-form questions via the
  same engine as `/ask`). Switch the "logged in as" role to see role-based
  access control (spec section 17) deny out-of-scope domains.
- **`/permissions`** — the auto-allowed vs. approval-required action list
  (spec section 16), the role permission matrix (section 17), and exactly
  what Gmail OAuth scopes and WhatsApp Business API setup would be needed to
  go live, with what the system would and would not be allowed to do at each
  stage. Nothing here is enabled — it's the checklist for when you're ready.

**Architecture note:** the core engine (`src/lib/inbox/classify.ts`,
`extract.ts`, `match.ts`, `route.ts`, `permissions.ts`, `process.ts`) only
ever consumes a channel-agnostic `IncomingMessage` and only ever produces
`InboundMessage` / `RoutingLogEntry` / `WhatsAppDraft` / `Communication`
records — it has no idea whether a message came from a fixture, a real Gmail
inbox, or a live WhatsApp number. Going from `DEMO_GMAIL` → `REAL_GMAIL` or
from the WhatsApp simulator → a live WhatsApp Business API is a matter of
writing a new adapter that produces the same `IncomingMessage` shape and
turns approved `WhatsAppDraft`/`Communication` rows into real API calls —
the classification/extraction/matching/routing logic does not change.

## Data accuracy rules (spec section 15)

- Nothing is fabricated: invoice/PO numbers, amounts, dates, and statuses
  only ever come from what's stored.
- The `/ask` engine returns "Data not available" for unmatched questions
  instead of guessing.
- `AuditLog` records status changes (e.g. follow-up completion) for
  traceability.
- Excel import never silently overwrites existing invoices — conflicting
  amounts are flagged, not merged.

## What's intentionally out of scope for this pass

- Authentication/multi-user access control (single-tenant demo).
- Full CRUD UI for creating/editing quotations, POs, invoices, and vendor
  invoices by hand — the current focus is the reporting/control-tower layer
  (dashboard, 360° views, register, action list, Ask, Excel consolidation) on
  top of a complete data model. Extending the API routes and seed patterns in
  `src/lib` to add create/edit forms is straightforward follow-up work.
- Sending communications automatically — draft emails are generated and
  displayed for review only, per the spec's approval requirement.
- Excel import currently supports the invoice register; the same
  duplicate/conflict-detection pattern in `src/app/api/import/route.ts` can be
  extended to quotations, POs, and vendor invoices.

## Project structure

```
prisma/schema.prisma       Full data model
prisma/seed.ts              Realistic multi-division sample data
src/lib/calc.ts             Outstanding/ageing/cash-position/risk aggregation
src/lib/query-engine.ts     Rule-based NL question resolver ("Ask")
src/lib/communications.ts   Draft email templates (follow-up, correction, etc.)
src/lib/inbox/              Channel-agnostic email+WhatsApp engine (test mode)
  types.ts                    IncomingMessage/ClassificationResult shapes
  classify.ts                  Rule-based message classification
  identify.ts                  Sender → customer/vendor matching
  extract.ts                    Labeled-field extraction from message bodies
  match.ts                      PO-vs-quotation, vendor-invoice-vs-PO matching
  route.ts                      Routing rules (who gets notified)
  permissions.ts                 Auto-allowed vs approval-required + role matrix
  process.ts                     Orchestrator: classify→extract→match→route→draft
  whatsapp-templates.ts          WhatsApp notification message builders
  whatsapp-commands.ts           WhatsApp conversational command handling
  fixtures.ts                    9 demo messages used in test mode
src/app/                    Dashboard, Customers, Vendors, Invoices, Actions,
                             Projects, Ask, Import, Inbox, WhatsApp,
                             Permissions pages + API routes
```
