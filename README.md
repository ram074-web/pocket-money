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
prisma/schema.prisma      Full data model
prisma/seed.ts             Realistic multi-division sample data
src/lib/calc.ts            Outstanding/ageing/cash-position/risk aggregation
src/lib/query-engine.ts    Rule-based NL question resolver ("Ask")
src/lib/communications.ts  Draft email templates (follow-up, correction, etc.)
src/app/                   Dashboard, Customers, Vendors, Invoices, Actions,
                            Projects, Ask, Import pages + API routes
```
