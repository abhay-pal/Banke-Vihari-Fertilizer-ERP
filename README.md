# Banke Vihari Fertilizer ERP

A React + TypeScript + Vite retail ERP workspace for an Indian fertilizer shop. It is designed around cash, UPI and Udhar sales, stock movement, supplier balances and a traditional customer Khata.

> **Important go-live status:** This repository is wired to Supabase, but no Supabase project credentials were provided in this build session. The preview therefore shows a setup/read-only workspace with blank live metrics; it does not contain seeded business values and cannot post production records until you configure and test your own Supabase project. Do not use for live billing until the deployment and acceptance checklist below passes.

## Stack

- React 18, TypeScript, Vite
- Tailwind CSS and local shadcn-style accessible UI primitives (Radix Dialog)
- Supabase PostgreSQL, Supabase Auth, PostgreSQL RPC transactions and Row Level Security
- Recharts dashboard and report charts
- ExcelJS workbook import/export
- Installable PWA shell with a small service worker; business data remains online in Supabase
- Cloudflare Pages-compatible static build

## What is implemented in this codebase

- Email/password sign-in, owner business bootstrap, role profiles, tenant-scoped policies and an Edge Function invite flow (the Edge Function must be deployed).
- Atomic POS checkout for multiple products; stock locks and checks; cash, UPI, bank/other and split payments; customer credit and due dates; automatic invoice IDs; customer ledger entries; UPI references; idempotency key; weighted-average cost snapshot; batch allocation; invoice print / browser Save as PDF; WhatsApp share link.
- Product, customer and supplier master forms, search, role checks and product Excel export.
- Atomic purchase posting with supplier bill reference, batch/manufacturing/expiry dates, GST, discounts, freight allocation, weighted-average cost and split supplier payments.
- Customer payment collection with oldest-open-invoice FIFO allocation or selected invoice allocation; supplier settlement; duplicate payment guard.
- Inventory movement trace, low/out-of-stock and expiry views; owner-approved audited stock adjustment; full sale and purchase reversal RPCs (reversals are full-invoice, not partial line returns).
- Expenses, cashbook by payment source and method, expected vs counted cash, separate UPI totals.
- Dashboard metrics/charts from live rows via SQL RPC, sales/purchase history, profit and outstanding reports, CSV export, print-to-PDF.
- Excel `.xlsx` migration wizard with sheet detection, column mapping, preview, validation, duplicate hints and staging/commit summary. Historical sale/purchase imports are deliberately unallocated/non-posting for current stock and customer/supplier credit. A verified Closing Sheet can set the stock snapshot. Reimport of the same workbook sheet rows is blocked by a source fingerprint.
- English/Hindi labels, light/dark mode, responsive sidebar/mobile bottom bar, POS shortcuts (`F2`, `Alt+N`, `Alt+Enter`), PWA manifest/worker.

The migration and front-end provide the foundation for the additional operating controls described in the product brief. Before go-live, verify every workflow below against a Supabase project; this code has not been tested against a customer database or against the named workbook because neither was supplied.

## Quick start

### 1. Supabase

1. Create a Supabase project and keep the database password in a password manager.
2. Apply the migration to an empty project:

   ```bash
   # With Supabase CLI installed and linked:
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   Or run `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor. It is a **fresh-project initial migration**, not an upgrade migration for an existing schema.
3. In Supabase Auth, enable email/password sign-in. Set Site URL and Redirect URLs to your development and production origins. Choose the email confirmation policy you want.
4. Copy `.env.example` to `.env.local` and set the project URL and **publishable/anon key**. The first account can sign up and bootstrap the owner business.
5. Deploy the owner-only invitation Edge Function:

   ```bash
   supabase functions deploy invite-user
   ```

   The Supabase runtime provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function. Keep the service role key in Supabase secrets only. Never create a `VITE_SUPABASE_SERVICE_ROLE_KEY`.

### 2. Front end

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173`. Production build:

```bash
npm run typecheck
npm test
npm run build
```

The PWA service worker is registered only in production builds. In development, refresh and app previews work without offline caching.

## Environment variables

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

Only public client credentials belong in these variables. Security comes from authenticated sessions and database RLS, not from hiding the anon key.

## Database and transaction model

The initial migration is `supabase/migrations/0001_initial.sql`. It creates the business/user role, catalog, party ledgers, sales, sale items, purchases, payments/allocations, batch stock, movements, stock adjustments, expenses/cash closing, audit and import tables.

High-risk writes go through `SECURITY DEFINER` PostgreSQL RPCs with a fixed `search_path`, role checks and tenant ID derived from the authenticated profile:

- `create_sale` locks product rows in a stable order, checks stock and credit limits, creates the sale, line cost snapshots, FIFO/expiry batch movements, payments, invoice sequence and customer ledger entries as one transaction.
- `create_purchase` updates batches, stock, weighted-average cost, supplier ledger and payment allocations atomically.
- `receive_customer_payment` / `receive_supplier_payment` update payment, invoice allocations and balances atomically. Idempotency keys protect retried receipts.
- `reverse_sale` / `reverse_purchase` create full reversal ledger and stock entries. Sale refunds default to cash in the UI and can be changed in the API/RPC call.
- `adjust_stock` is owner-only and records the reason, adjustment document and movement.
- Dashboard and cashbook numbers are calculated from tenant records in SQL. Business timezone defaults to `Asia/Kolkata`.

RLS read policies are tenant-scoped. Cashiers cannot read purchasing/supplier, expense, audit or owner settings tables. Product/customer financial writes are RPC-only. Price, role, payment and reversal changes are captured in database audit events where configured.

## Excel migration behavior

The wizard accepts `.xlsx`, selects one sheet at a time, suggests a sheet type from its name and auto-maps common English column headers. Review the mapping and validation before committing each sheet. The workbook itself is parsed in the browser; only mapped rows are sent to the tenant database.

Recommended sequence for `New Sheet January Fertilizer-Banke Vihari.xlsx`:

1. Take a database backup and export the workbook to a read-only copy.
2. Import/verify the `Closing Sheet` as a closing-stock snapshot, including units and as-of date.
3. Import `Purchase` and `Sale` history for reporting/reference. These imported history rows do **not** mutate today's inventory, do **not** create supplier/customer balances, and do **not** assume an unlabelled sale was credit or paid. They remain marked `historical_unverified` and do not get POS payment receipts.
4. Resolve product name/SKU matches before import. Unmatched historic purchase/sale lines are rejected row-by-row and included in the job error count.
5. Reconcile workbook totals and stock with the owner/accountant. The source fingerprint prevents the same sheet rows from being imported twice.

The actual workbook was not available in this development workspace, so column names, date conventions, formulas, duplicate patterns and opening/closing reconciliation still need an owner review.

## Cloudflare Pages deployment

1. Push this project to a private or public GitHub repository.
2. In Cloudflare Pages, connect the repository.
3. Build command: `npm run build`; output directory: `dist`; Node version: 20 or newer.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages build environment variables. Redeploy after changing them because Vite embeds public environment values at build time.
5. Add the Pages production URL and any custom domain to Supabase Auth redirect allowlists.
6. Deploy `invite-user` to Supabase (not Cloudflare Pages) and test the invitation as the owner.
7. Verify HTTPS, PWA install, mobile sizing, RLS from cashier and manager accounts, billing, print output and backups.

Cloudflare Pages is only the static UI host in this architecture. It does not host the PostgreSQL database. Free-tier quotas, build limits, bandwidth, function limits and account policies can change. Supabase free projects also have quotas and may pause when inactive; backup/PITR and support options differ by plan. Confirm the live pricing/limits for your accounts and move to a paid plan if the business needs guaranteed uptime, longer backups, PITR or support.

## Backup and restore

Before migration, before bulk imports, and on a recurring schedule:

```bash
supabase db dump --db-url "$DATABASE_URL" -f banke-vihari-backup.sql
# Restore to a separate/test database first:
psql "$RESTORE_DATABASE_URL" -f banke-vihari-backup.sql
```

Also export critical business reports to an encrypted location and test a restore, including Auth/business profile setup, before relying on backup files. Do not store secrets or unencrypted customer exports in GitHub. Check Supabase's current plan-specific automated backup and point-in-time-recovery retention in the platform dashboard.

## Verification checklist before using real sales

- [ ] Create an owner, manager and cashier and verify each role on a second browser/session.
- [ ] Verify cross-business reads and writes fail under RLS; this project assumes one active business profile per auth user.
- [ ] Post a cash sale, a UPI sale, a full-credit sale and a split `cash + UPI + credit` sale; verify invoice total, GST, customer ledger, payment ledger and stock.
- [ ] Try two simultaneous sales for the final available stock; only one may post.
- [ ] Try to sell more than stock and exceed a credit limit; both must fail without partial writes.
- [ ] Receive a partial customer payment and settle a supplier invoice; retry the same idempotency key and confirm no duplicate.
- [ ] Post a purchase with GST, discount, freight and batch expiry; verify stock movement, average cost and supplier payable.
- [ ] Reverse full sale/purchase and check physical cash/UPI, stock and party ledgers. Partial returns are not implemented by these full-reversal RPCs.
- [ ] Count cash and compare expected/counted differences; confirm UPI does not alter physical cash.
- [ ] Compare Excel import row totals and Closing Sheet stock to a signed-off source workbook; test duplicate import protection.
- [ ] Check invoice paper size on the actual thermal printer and A4 printer; test Save as PDF on the target browser.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, review Supabase Auth logs and inspect RLS policies before production.

## Known constraints in this delivery

- No Supabase project or customer workbook was supplied. Live auth/database persistence and SQL transaction tests could not be exercised in this workspace. The included preview consequently uses blank/empty states, not fictitious metrics.
- Partial item-level sale/purchase returns and purchase attachments are not implemented; the current return control reverses a complete eligible invoice and records compensating rows.
- PDF output uses the browser's native Print → Save as PDF. No server-side PDF generation or cloud WhatsApp integration is included; WhatsApp opens a share link.
- Excel column auto-detection supports common English headers and requires review. Workbook-specific Hindi headers, complex multi-row headers and formula reconciliation require mapping/review; this workbook was not attached.
- This is a deployable engineering foundation, not a substitute for a production security review, CA validation of GST invoices, hardware printer testing, data migration sign-off or a tested disaster-recovery plan.
