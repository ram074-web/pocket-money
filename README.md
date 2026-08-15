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

Open http://localhost:3000. On first launch you'll be asked to create the
Owner account — see "Authentication & access control" below.

To reset to a clean demo state at any time, re-run `npm run db:seed` — it
wipes and reloads the business tables (user accounts are left alone).

> **Running a production build locally:** the project uses Next's
> `output: "standalone"`, so use `node .next/standalone/server.js` after
> `npm run desktop:prepare` rather than `npm start` — `next start` warns and
> isn't the supported path for standalone output. For everyday development
> `npm run dev` is unaffected.

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

### Data entry (`/customers/new`, `/quotations/new`, `/purchase-orders/new`,
`/invoices/new`, `/vendors/new`, `/vendor-invoices/new`, and the payment forms)
Every record can be entered by hand, so the system works on a fresh install
with no seed data and no spreadsheet. The forms enforce the same rules the
rest of the system reports on, at the server action — never only in the
browser (`src/lib/record-actions.ts`):

- Nothing is guessed. A blank or unparseable amount or date is an error the
  user has to resolve, never a silent zero or today's date.
- Document numbers are *suggested* by incrementing your last one
  (`src/lib/next-number.ts`) and are fully editable — nothing is written
  under a number nobody typed.
- An invoice cannot take a linked PO past its value (2% tolerance), and a
  receipt cannot exceed what is outstanding on the invoice.
- A vendor invoice is recorded **pending approval**; the payment form
  refuses it until an Owner or Finance Manager approves, whatever the UI
  offers.
- Duplicate customer, vendor, quotation, PO and invoice numbers are refused.
- Every create is written to `AuditLog` with the acting user.
- Each form and each action independently checks the signed-in user's role
  against the same permission matrix (§17) — Sales can raise a quotation but
  not an invoice; an Accounts Executive can raise an invoice but not a
  customer.

### Excel Import (`/import`)
Uploads a workbook (.xlsx, template downloadable in-app) with a **Customers**
sheet and an **Invoices** sheet. Customers are processed first, so a single
file can populate a brand-new system and the invoice rows then match the
customers just created. The importer:
- creates customers that don't exist yet and leaves existing ones (matched by
  name) unchanged, so re-running a file is safe,
- imports clean new invoice rows automatically,
- **skips** rows whose invoice number already exists (no overwrite),
- **flags as a conflict** rows where an existing invoice number has a
  different amount (requires manual verification, not auto-resolved),
- flags missing required fields, unrecognized divisions, and invalid date
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

## Desktop app (Electron)

The same app can be packaged as a native desktop application — installed like
normal software, with its own window and icon, no terminal or browser tab
required. It bundles the Next.js server and runs it on a random free
localhost port internally.

```bash
npm run desktop:dev          # build + launch the desktop app locally
npm run desktop:dist         # build installers for the current platform
npm run desktop:dist:win     # Windows  (nsis installer + zip)
npm run desktop:dist:mac     # macOS    (dmg + zip)
npm run desktop:dist:linux   # Linux    (AppImage)
```

Artifacts are written to `dist-electron/`.

**Where your data lives.** On first launch the app copies a blank,
already-migrated SQLite database into the OS's per-user app-data directory
and uses it from then on:

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\pocket-money\pocket-money.db` |
| macOS | `~/Library/Application Support/pocket-money/pocket-money.db` |
| Linux | `~/.config/pocket-money/pocket-money.db` |

It is never written inside the installed application (which may be
read-only), and an existing database is never overwritten on upgrade — back
up that single file to back up everything.

**A desktop install starts empty**, by design: a financial system should not
ship with fabricated customers and invoices in your books. Populate it via
the Excel Import page, or use the browser version with `npm run db:seed` if
you just want to explore with sample data.

### Getting installers automatically (CI)

`.github/workflows/desktop-release.yml` builds on real Windows, macOS and
Linux runners and attaches the installers to a GitHub Release:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

You can also run it manually from the repository's **Actions** tab, which
leaves the installers as downloadable workflow artifacts without publishing a
release. This is the recommended path — it's the only way to produce the
Windows `.exe` installer and a signed macOS build.

### Cross-platform build notes

Each installer format needs its platform's native tooling, so building all
three from one machine isn't automatic:

- **Linux → AppImage**: builds anywhere. Verified working.
- **Windows → zip**: builds on Linux/macOS. Verified working.
- **Windows → nsis installer**: the `.exe` installer step shells out to
  `wine` when building from Linux — install wine, or build on Windows.
- **macOS → zip / `.app`**: builds on Linux, but is **unsigned**. macOS
  Gatekeeper will refuse to open an unsigned app downloaded from the
  internet without a right-click → Open override.
- **macOS → dmg**, and signing/notarization, require a real macOS machine
  plus an Apple Developer certificate.

For distributing to real users, run the builds in per-platform CI (e.g. a
GitHub Actions matrix of `windows-latest` / `macos-latest` / `ubuntu-latest`)
rather than cross-building from one host.

Builds are large (~350–620 MB per platform) because each bundles the Electron
runtime plus Prisma query-engine binaries for every target platform. Trimming
`binaryTargets` in `prisma/schema.prisma` to just the platform being built
reduces this meaningfully.

## Mobile / hosted access

The web UI is responsive and installs to a phone home screen as a PWA — it
opens fullscreen with its own icon, no app store involved. On Android: Chrome
→ menu → "Install app" / "Add to Home Screen". On iOS: Safari → Share → "Add
to Home Screen".

**A phone cannot run this app by itself.** Unlike the desktop build — which
bundles the Node server and keeps everything on your machine — mobile needs
the app running on a server it can reach over the network. That is a real
trade-off, not just extra work: hosting moves your financial data off your
own machine onto whatever host you choose.

The service worker (`public/sw.js`) deliberately caches **only** immutable
build assets — never pages, never API responses. A cached "amount overdue" is
worse than no number at all, so every figure is fetched live.

### Hosting it

A `Dockerfile` is included and builds the standalone output into a small
runtime image:

```bash
docker build -t finance-ops .
docker run -d -p 3000:3000 -v finance-ops-data:/data finance-ops
```

**The `-v .../data` volume is mandatory.** The database is a SQLite file at
`/data/pocket-money.db`; on a host with ephemeral disk it would be silently
recreated empty on every deploy. That rules out the default serverless
configuration of platforms like Vercel — use a host that offers a persistent
volume (Fly.io, Railway, Render, a VPS), or switch the datasource in
`prisma/schema.prisma` to PostgreSQL and point `DATABASE_URL` at a managed
database. The container runs `prisma db push` on start, so a fresh volume is
initialised automatically and an existing one is migrated additively.

### Before you put real financial data on a server

- Use HTTPS (required anyway for PWA install and service workers).
- The desktop build remains the option where data never leaves your machine.
- Take backups: the whole database is the single SQLite file on the volume.

## Authentication & access control

Every page and API route requires a signed-in user. There is no way to read
any financial figure without an account.

**First run.** With no accounts in the database, the app shows a one-time
setup screen to create the initial **Owner** account. There is no default or
hardcoded password, and that screen refuses to run once any account exists.

**How it works**
- Passwords are hashed with scrypt (Node's stdlib) and compared in constant
  time. Plaintext passwords are never stored, logged, or echoed back to the
  browser.
- Sessions are server-side records, not self-contained tokens, so access can
  be revoked instantly — deactivating a user kills their live sessions. The
  cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production; only a
  SHA-256 of it is stored, so a leaked database yields no usable cookies.
- Failed logins return one generic message, so the form can't be used to
  discover which email addresses exist.

**Roles** are the five from spec section 17 (Owner, Finance Manager, Sales,
Operations, Accounts Executive), enforced **server-side** on every page and
API route via `requireAccess(domain)` / `requireApiUser(domain)`. Hiding a
nav link is a convenience, never the control: requesting a page directly
redirects to `/no-access`, and an API call returns `403`.

The WhatsApp simulator's role picker takes the role from your **session**,
not the request body — a Sales user asking as `"Owner"` is still answered as
Sales. Owners may preview other roles, which grants nothing they don't
already have.

**Still worth knowing:** there's no password reset, no rate limiting on login
attempts, and no user-management UI yet — additional accounts are created
directly in the database. Add rate limiting before exposing this to the open
internet.

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

- Editing and deleting existing records. Everything can be *created* and
  moved forward (approve, record payment), but a mistyped invoice cannot yet
  be corrected in place — the correction-history model exists in the schema
  and the UI for it is the next step.
- Sending communications automatically — draft emails are generated and
  displayed for review only, per the spec's approval requirement.
- Excel import covers customers and the invoice register; the same
  duplicate/conflict-detection pattern in `src/app/api/import/route.ts` can be
  extended to quotations, POs, and vendor invoices.
- User management, password reset, and login rate limiting — see
  *Authentication & access control* below.

## Project structure

```
prisma/schema.prisma       Full data model
prisma/seed.ts              Realistic multi-division sample data
src/lib/auth.ts             Sessions, sign-in/out, requireUser/requireAccess
src/lib/password.ts         scrypt hashing + constant-time verification
src/lib/api-auth.ts         Auth/role guard for API route handlers
src/middleware.ts           Bounces unauthenticated requests to /login
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
electron/main.js            Desktop app entry: starts the bundled Next.js
                             server, points Prisma at the per-user database
scripts/prepare-desktop.mjs Assembles .next/standalone for packaging
scripts/generate-icons.mjs  Regenerates app icons from one SVG source
src/app/manifest.ts         PWA manifest (phone home-screen install)
public/sw.js                Service worker — caches assets only, never data
Dockerfile                  Hosted/mobile deployment image
.github/workflows/          CI that builds desktop installers per platform
```
