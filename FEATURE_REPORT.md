# Arch PEM — Feature Report
**Date:** 2026-06-22  
**App:** Arch PEM (Project Expense Manager) — Electron + React + SQLite desktop app for architects and construction firms

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron (with custom Windows title bar) |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, CSS variables for theming |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Charts | Recharts (BarChart, PieChart) |
| Export | `xlsx`, `xlsx-js-style`, custom PDF via Electron print |
| Licensing | RSA-2048 signed `.lic` files, AES-256-GCM encrypted storage, machine-bound |
| Auto-updater | `electron-updater` |

---

## 2. Existing Features

### 2.1 Project Management
- Create, edit, delete, and duplicate projects
- Project fields: Name, Client, Plot No, Location, Area (sq.ft), Description, GST Rate, Contingency Rate, Status (Active / On Hold / Completed / Archived), Tags
- Filter projects by status and search by name/client
- Plan-enforced project limits: Solo = 10, Studio = 30, Enterprise = 50

### 2.2 Budget Editor (Estimate Builder)
- Category-based line items (per-project)
- Add/edit/delete categories with custom color labels and sort order
- Line items: Description, Unit, Quantity, Rate, Notes
- Budget summary: Subtotal → Contingency → Before Tax → GST → Grand Total → Rate/sq.ft
- Pie/bar charts for category breakdown (`BudgetCharts`)
- Save budget layout as a reusable **Template**
- Apply templates to any project
- Export budget to PDF (via Electron print-to-PDF)
- Export budget to Excel

### 2.3 Templates Library
- View all saved templates
- Template metadata: name, description, category count, line item count
- Delete templates
- Apply templates from the Budget Editor

### 2.4 Expense Tracking (4 categories)
All four expense categories share a unified page (`ExpensesPage`) showing per-category card summaries:

| Category | Key Fields |
|---|---|
| **Labour** | Mason/Coolie/Helper/Other counts & rates, advance, cash/cheque/pending |
| **Vendor** | Vendor name, description, invoice no., quantity, unit, rate, GST, round-off, attachment |
| **Contractor** | Contractor name, description, invoice no., quantity, unit, rate, GST, round-off, attachment |
| **Site** | Description, amount, advance, cash/cheque/pending |

Common expense features across all categories:
- Date-range filter (month picker)
- Add / Edit / Delete individual entries
- Bulk delete (multi-select)
- Bulk "mark paid" (clears pending)
- Sort by date, amount, vendor, pending
- Attach photo/invoice files
- GST fields (rate + calculated amount)
- Round-off toggle
- Remarks field

### 2.5 Labour Ledger (`/project/:id/ledger/labour`)
- Detailed labour entry per day: Mason, Coolie, Helper, Other counts & rates
- Manpower report parsing (import from external Excel file)
- Print ledger to PDF
- Export ledger to Excel (with `xlsx-js-style` styled sheets)
- Date-range filter
- Advance tracking per entry

### 2.6 Vendor Ledger (`/project/:id/ledger/vendor`)
- Per-vendor detailed transaction view within a project
- Vendor settlement: set contracted amount, quantity, unit, rate; toggle "use settlement" to show against actual spend
- GST fields, invoice number, cheque number, attachment
- Sort by date, amount, vendor, pending
- Bulk select + mark paid / delete
- Print to PDF, Export to Excel

### 2.7 Summary Sheet (`/project/:id/summary`)
- Cross-category aggregated expense view for a project
- Filter by date range
- Aggregates rows by description with subtotals
- Two print modes: Complete report / GST-only report
- Export to Excel

### 2.8 Pending Payments Report (Studio + Enterprise)
- Cross-project view of all unpaid/partially-paid expenses
- Filter by project, date range, keyword
- Urgency colour-coding (green < 14 days, amber 14–30 days, red > 30 days)
- Export to Excel

### 2.9 GST Purchase Register (Solo+)
- Cross-project GST report filterable by month and project
- Shows: Project, Plot, Location, Vendor, Invoice No., Cheque No., Date, Amount, GST Rate, GST Amount, Taxable Amount
- Export to Excel, Print to PDF

### 2.10 Vendor Directory
- Global vendor/contractor/labour/site contact book (cross-project)
- Fields: Name, Category, Contact Person, Phone, Email, GSTIN, Notes
- Search by name, phone, GSTIN
- Filter by category
- Add / Edit / Delete vendors

### 2.11 Dashboard
- Top-level KPIs: Total Projects, Monthly Expenses, Total Pending
- Period filter: This Month / Last Month / This Quarter / Last Quarter / This Year / All Time
- Monthly spend trend (bar chart)
- Category breakdown (pie chart)
- Project overview table with spend bars
- Click-through to project expenses

### 2.12 Global Search (Ctrl+K)
- Searches across: Projects (name, client), Vendors (name, category), Expenses (vendor, description)

### 2.13 Settings
- Currency selector (multi-currency support via `SUPPORTED_CURRENCIES`)
- Company name
- Dark mode toggle
- PIN Lock (4–6 digit): set, change, remove (Studio+ plan)
- License management: view status, deactivate
- JSON data export / import (full database backup)
- Manual DB file backup & restore
- Custom database path (shared folder / network drive — Enterprise)
- Auto-backup management: list, restore, open folder (rolling 30 days)
- Auto-updater: check for updates, install downloaded update

### 2.14 Licensing & Plan Tiers

| Feature | Solo | Studio | Enterprise |
|---|---|---|---|
| Max Projects | 10 | 30 | 50 |
| Max Seats | 1 | 5 | 10 |
| Tally CSV Export | ✓ | ✓ | ✓ |
| GST Report | ✓ | ✓ | ✓ |
| Pending Payments | — | ✓ | ✓ |
| PIN Lock | ✓ | ✓ | ✓ |
| Custom Branding | — | — | ✓ |
| DB Sharing (shared folder) | — | ✓ | ✓ |
| Machine Transfer | — | — | ✓ |

- RSA-2048 signed license files, machine-bound AES-256-GCM storage
- 7-day grace period after expiry
- 30-day warning banner before expiry
- Onboarding wizard on first launch
- Trial mode support

### 2.15 Export Capabilities
| Export | Formats |
|---|---|
| Budget Estimate | PDF, Excel |
| Labour Ledger | PDF, Excel (styled) |
| Vendor Ledger | PDF, Excel (styled) |
| Summary Sheet | PDF, Excel |
| GST Register | PDF, Excel |
| Pending Payments | Excel |
| Tally CSV | CSV (vendor ledger Tally-compatible) |
| Full Database | JSON (import/export) |
| DB File | SQLite file backup/restore |

---

## 3. Features That Can Be Implemented

### 3.1 High Priority — Core Workflow Gaps

**A. Budget vs. Actual Comparison**
- Currently the Budget Editor (estimate) and Expense Tracker (actuals) are entirely separate
- No page shows estimated vs. actual cost per category
- A "Budget vs Actuals" view per project would be the single most impactful feature: show estimated amount from Budget Editor alongside real expenses by category, with variance (over/under budget) and % utilised

**B. Project-Level Dashboard / Progress Page**
- Each project currently has no single overview page showing its health
- Add a per-project summary: total estimated budget, total spent, remaining budget, % complete, payment status, upcoming dues
- Show a timeline or milestone tracker for project phases (foundation, structure, finishing, etc.)

**C. Payment Schedule / Milestone Tracking**
- No way to schedule future payments or define milestones (e.g., "Pay contractor ₹2L on slab completion")
- Add a `milestones` / `payment_schedule` table: milestone name, target date, amount, linked vendor, status (pending/paid)
- Show upcoming dues on Dashboard

**D. Contractor Work Orders / Boq Tracking**
- Vendor settlement exists but is minimal (one row per vendor per project)
- Expand to a proper "Work Order" concept: vendor, scope, BOQ items, agreed rate, progress % → auto-calculate billed amount vs. agreed

**E. Invoice / Bill Upload & OCR**
- Attachment is already supported (one file per expense entry)
- Allow multiple attachments per entry
- Show attachments inline as thumbnails in the ledger view (currently just an icon to open externally)
- Optional: integrate Tesseract OCR to auto-fill amount/date/invoice number from scanned bills

---

### 3.2 Medium Priority — Reporting & Analytics

**F. Cost-Per-Sq-Ft Breakdown by Category**
- Dashboard already shows rate/sq.ft at project level from the Budget Editor
- Add a cross-project benchmarking table: compare rate/sq.ft across projects by category (labour, vendor, contractor, site)

**G. Cashflow / Payment Timeline Chart**
- Plot planned payments vs. actual outflows week-by-week or month-by-month per project
- Highlight months with high pending payments

**H. Manpower Attendance Report**
- Labour entries already track headcount (mason, coolie, helper, other)
- Build a dedicated manpower report page: daily headcount chart, monthly aggregate, peak days
- Export as a formatted attendance register PDF

**I. Project Profit/Loss Report**
- Compare contracted amount (from client/estimate) vs. total expenditure
- Show estimated margin per project

**J. Custom Date Range for Dashboard**
- Currently only preset periods (this month, last month, etc.)
- Add a custom date-range picker so users can analyse any arbitrary period

---

### 3.3 Medium Priority — UX & Workflow

**K. Recurring / Template Expenses**
- Repetitive expenses (weekly labour payments, monthly site rent) require re-entry every time
- Add "recurring expense" with frequency (weekly/monthly) that auto-suggests the next entry

**L. Expense Approval Workflow (Enterprise)**
- For multi-seat Enterprise use, allow a workflow where entered expenses need sign-off from an admin before being finalised
- Add `status` field on expenses: `draft → submitted → approved`

**M. Tags / Labels on Expenses**
- Projects already support tags; add optional tags to individual expenses for custom categorisation (e.g., "Phase 1", "urgent", "disputed")
- Filter and group by tag in ledgers and reports

**N. Bulk Import Expenses from Excel**
- Currently only a full JSON import is available; there is no way to paste a spreadsheet of expenses
- Add an "Import from Excel" wizard (map columns → expense fields) for Labour and Vendor entries

**O. Notes / Site Diary**
- No field for free-form daily site notes (weather, incidents, instructions)
- Add a simple `site_diary` table: project_id, date, note — accessible from the project sidebar

---

### 3.4 Lower Priority — Platform & Integrations

**P. Custom Branding on PDF (Enterprise stub exists)**
- `customBranding: true` is defined in plan features for Enterprise but the PDF generator (`pdf-generator.ts`) does not yet use it
- Implement: company logo, custom letterhead, colour scheme applied to all exported PDFs

**Q. Cloud Sync / Remote Backup**
- Currently backup is to a local/network file; no cloud option exists
- Add optional Google Drive or Dropbox backup (saves `.db` file to configured folder)
- For Enterprise, an optional hosted sync server would enable real-time multi-user access (vs. current shared-folder WAL approach)

**R. Client Portal (view-only)**
- Allow generating a shareable, read-only HTML/PDF report that can be emailed to the client
- No login required on client side — just a static snapshot

**S. Notifications & Reminders**
- System tray notifications for: upcoming payment dues, license expiry, pending payments older than X days
- Currently the app only shows in-app banners

**T. Multi-Currency per Project**
- Currency is currently a single app-wide setting
- Allow each project to have its own currency (useful for international or cross-border projects)

**U. Mobile Companion App**
- Field supervisors need to log labour counts from the site
- A minimal React Native or PWA companion that syncs with the desktop DB via local WiFi or cloud would fill a real gap

---

## 4. Partially Implemented / Incomplete Areas

| Item | Status |
|---|---|
| Custom branding on PDFs | Plan flag exists (`customBranding`) but PDF generator doesn't use it |
| Machine transfer | Plan flag exists but no UI flow for transferring license to another machine |
| Budget page not in sidebar nav | `BudgetEditorPage` exists but the route `/project/:id/budget` is not listed in `App.tsx` routes — appears orphaned or accessible only from inside project flow |
| Templates page | Exists as a standalone page but has no route in `App.tsx` sidebar — may be accessible only from the Budget Editor |
| `dbSharing` (WAL mode shared folder) | Works technically but has no guided UI for setting it up on multiple machines |

---

## 5. Summary

The app has a **solid core** covering project setup, expense tracking across 4 categories, ledger views, GST reporting, and PDF/Excel exports. The biggest gap is the **missing connection between the Budget Estimate and the Expense Actuals** — there is no "Budget vs. Actual" view. After that, the most impactful additions would be a **per-project progress dashboard**, **milestone/payment scheduling**, and **multi-attachment support with better bill management**.
