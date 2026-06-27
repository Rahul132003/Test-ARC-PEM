# Projex — Product Documentation

**Developed by HashX Labs**
Version 1.0 · Offline Desktop Application (Windows / macOS)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation & First Launch](#3-installation--first-launch)
4. [Onboarding Wizard](#4-onboarding-wizard)
5. [License Activation](#5-license-activation)
6. [Core Features](#6-core-features)
7. [Expense Tracking](#7-expense-tracking)
8. [Vendor Directory](#8-vendor-directory)
9. [Reports & Exports](#9-reports--exports)
10. [Global Search](#10-global-search)
11. [Dashboard & Date-Range Filter](#11-dashboard--date-range-filter)
12. [Multi-User (Shared Database)](#12-multi-user-shared-database)
13. [Backup & Restore](#13-backup--restore)
14. [Auto-Update](#14-auto-update)
15. [Security — PIN Lock](#15-security--pin-lock)
16. [Settings Reference](#16-settings-reference)
17. [License Management — Admin Guide](#17-license-management--admin-guide)
18. [Security Architecture](#18-security-architecture)
19. [Troubleshooting](#19-troubleshooting)
20. [FAQ](#20-faq)
21. [Changelog](#21-changelog)

---

## 1. Product Overview

Projex is a **fully offline desktop application** for construction firms and architects. It lets you manage detailed project budgets (BOQ), track all site expenses (labour, vendors, contractors, materials), and generate professional reports — without any internet connection or subscription service.

### What it solves

| Pain Point | Solution |
|---|---|
| Scattered expense records in Excel sheets | Centralised per-project ledger with categories |
| Manual GST calculations | Per-bill GST tracking with automatic computation |
| No way to print professional summaries | One-click print-ready summary sheets and ledgers |
| Multiple team members editing the same file | Shared SQLite database over a local network drive |
| Data loss from hardware failure | One-click SQLite backup + JSON export |
| Unlicensed sharing of software | RSA-signed license keys locked to each machine |
| Tally import for accounting handoff | Tally-compatible CSV export from any ledger |
| Cluttered project list with finished jobs | Project status (Active / On Hold / Completed / Archived) and filter |
| Accidentally deleted an expense | Toast-based undo — 4-second window to reverse any delete |
| Manually deleting or clearing dozens of paid bills | Bulk-select + bulk-delete or bulk-mark-paid in ledgers |
| No way to see "just this quarter's" spend | Dashboard period filter: This Month / Quarter / Year / All Time |
| Manual re-installs for every software update | Silent auto-update via electron-updater |
| Can't find a vendor or expense quickly | Global search (⌘K / Ctrl+K) across projects, vendors, and expenses |
| Re-typing the same vendor details every time | Vendor Directory with autocomplete in all expense forms |
| New vendor added mid-project has no record | Auto-registration: new names typed in expense forms are saved to the Directory |
| Ledger export only available as CSV | Excel and native PDF export for all ledgers |

---

## 2. System Requirements

| | Minimum |
|---|---|
| OS | Windows 7 Professional / 10 / 11 (64-bit or 32-bit) or macOS 12 Monterey |
| RAM | 4 GB |
| Disk | 200 MB free |
| Network | Not required for day-to-day use. Required only once when downloading an auto-update. |

> **Note for Windows 7 Users:** This application is fully compatible with Windows 7 Professional. For 32-bit systems, please use the `ia32` installer. For 64-bit systems, the `x64` installer is recommended. Windows 7 users may need to ensure they have the latest Service Pack and VC++ Redistributable installed.

---

## 3. Installation & First Launch

1. Run the installer (`Projex-Setup.exe` on Windows, `.dmg` on macOS).
2. On first launch the app checks for a valid license.
3. If none is found, the **License Activation** screen is shown.
4. Once activated, the **Onboarding Wizard** runs automatically (first time only).
5. After completing or skipping the wizard, you land on the Dashboard.

The database file is created automatically at:

- **Windows:** `%APPDATA%\arch-budget-calculator\budget-calculator.db`
- **macOS:** `~/Library/Application Support/arch-budget-calculator/budget-calculator.db`

---

## 4. Onboarding Wizard

The Onboarding Wizard runs **once** the first time the app launches after activation. It guides new users through essential setup in four steps:

| Step | What you set |
|---|---|
| **Welcome** | Introduction — read and continue |
| **Company Name** | Your firm or company name (used on printed reports and CSV exports) |
| **Currency** | Working currency — INR, USD, EUR, GBP, AED, SAR, SGD, or AUD |
| **First Project** | Create the first project (name + client) right from setup |

The wizard can be **skipped** at any step — all settings are available in the Settings page later. The company name and currency are stored in `app-settings.json` alongside the database path preference.

> **Note:** The wizard shows exactly once. If you need to revisit these settings, use **Settings → Currency** and add projects from the Projects page.

---

## 5. License Activation

### For the client

1. You will receive a `.lic` file by email from HashX Labs.
2. On the License screen, click **Import .lic File** and select the file.
3. Alternatively, open the `.lic` file in any text editor, copy all contents, switch to **Paste Key** mode, and paste.
4. Click **Activate**. On success the Onboarding Wizard (or Dashboard) opens immediately.

> **Important:** A license is locked to one machine. If you move to a new computer, contact HashX Labs with your new Machine ID (shown on the License screen) to get a replacement license.

### Finding your Machine ID

Your Machine ID is always visible on the License screen (bottom of the page). It is also shown in **Settings → License**. Share this with HashX Labs when:
- Requesting a new license
- Moving the software to a new machine
- Requesting a renewal

### License expiry

| Status | Banner shown | Action needed |
|---|---|---|
| > 30 days remaining | None | — |
| ≤ 30 days remaining | Amber warning banner | Contact HashX Labs to renew |
| ≤ 7 days remaining | Orange urgent banner | Renew immediately |
| Expired (within 7-day grace) | Red banner | App still opens, renew now |
| Expired + grace period over | License screen | Must provide a new license key |

---

## 6. Core Features

### Projects

- Create unlimited projects with name, client, plot number, location, area (sq.ft), and description.
- Each project has independent budget sheets (BOQ), expense ledgers, and reports.
- Duplicate a project to reuse its BOQ structure for a similar job.
- **Edit a project** inline — click the pencil icon on the project card.

#### Project Status

Every project carries a **Status** field with four values:

| Status | Meaning |
|---|---|
| **Active** | Work in progress — default for new projects |
| **On Hold** | Temporarily paused |
| **Completed** | Work done, accounts finalised |
| **Archived** | Closed / cancelled — shown dimmed in the grid |

**Changing status:** Hover over a project card and click the status badge to reveal a dropdown — change in one click without opening the edit modal.

**Filtering by status:** Status filter pills (Active / On Hold / Completed / Archived / All) appear above the project grid. A count badge on each pill shows how many projects are in that state. Combine with the search bar to narrow further.

> **Tip:** Set completed projects to **Archived** to keep the grid clean while preserving all their data and reports.

#### Undo on Delete

Deleting a project **no longer shows a browser confirm dialog**. Instead:

1. The project card disappears immediately from the grid.
2. A toast notification slides up from the bottom of the screen: `"Project Name" deleted — **Undo**`
3. Clicking **Undo** within **4 seconds** restores the project instantly.
4. If no undo is taken, the deletion is committed to the database.

This same undo pattern applies to expense deletions throughout the app.

### Budget / BOQ (Bill of Quantities)

- Organise line items under colour-coded categories (Materials, Labour, Equipment, etc.).
- Each item has: description, unit, quantity, rate → amount is computed automatically.
- Summary box shows: subtotal, contingency, pre-tax total, GST, **grand total**, and **rate per sq.ft**.
- Save any project's BOQ as a reusable **template** to apply to future projects.
- Export to **PDF** or **Excel**.

---

## 7. Expense Tracking

All actual site spending is recorded in the **Expenses** module, separate from the budget estimate.

### Expense categories

| Category | Used for |
|---|---|
| **Labour** | Daily wages — mason, coolie, helper, other (with headcount × rate) |
| **Vendor** | Material purchases with optional GST |
| **Contractor** | Sub-contractor bills with optional GST |
| **Site** | Miscellaneous site costs (electricity, transport, etc.) |

### Vendor / Contractor Ledger

- Each bill records: date, vendor name, description, quantity × rate or lump-sum amount.
- **GST toggle**: enable to enter the base amount and GST rate; the app computes GST amount and total.
- Payment tracking: advance, cash paid, cheque paid, cheque number, payment date, pending balance.
- Attach a photo or PDF scan of the physical bill using the paperclip icon.
- Filter by date range to view bills for any period.

#### Vendor Name Autocomplete

When adding or editing an expense, the **Vendor / Party Name** field shows a dropdown of all vendors already registered in the Vendor Directory (filtered to the matching category — e.g. only vendor-type contacts appear on a Vendor ledger). Start typing to narrow the list.

#### Auto-Registering New Vendors

If you type a name that does not exist in the Vendor Directory, an **inline registration panel** expands automatically within the expense form:

| Field | Description |
|---|---|
| **Category** | vendor / contractor / labour / site |
| **Contact Person** | Primary contact name |
| **Phone** | Mobile or office number |
| **Email** | Optional email address |
| **GSTIN** | GST Identification Number (auto-uppercased) |
| **Notes** | Any internal notes |

On submitting the expense, the new vendor is saved to the Vendor Directory at the same time. No separate step is needed — one form, one submit.

#### Export Toolbar

Every Vendor and Contractor ledger has four export buttons in the header:

| Button | Output |
|---|---|
| **Tally CSV** | Tally-compatible UTF-8 CSV for import into Tally ERP / Prime |
| **Excel** | `.xlsx` with project header, full bill table, and totals row |
| **PDF** | Native save-dialog PDF via Electron's print engine (landscape A4) |
| **Print** | Browser print dialog — use to print directly or save as PDF via the OS |

The **Tally CSV**, **Excel**, and **PDF** buttons are disabled when there are no entries in the current view.

#### Column Sorting

Click any column header to sort the ledger rows. Sortable columns are:

| Column | Notes |
|---|---|
| **Date** | Ascending (oldest first) by default |
| **Description / Vendor** | Alphabetical |
| **Amount** | Highest to lowest or reverse |
| **Pending Amount** | Useful to bring outstanding bills to the top |

Click the same header again to reverse the sort direction. A small `↑` or `↓` arrow indicates the active sort.

#### Bulk Actions

When you need to process multiple entries at once:

1. **Select rows** using the checkbox in the first column. The header checkbox selects / deselects all rows.
2. A blue **bulk-action bar** slides in at the top showing the count of selected items.
3. Available bulk actions:

| Action | Effect |
|---|---|
| **Mark Paid** | Sets `pending_payment = 0` for all selected rows |
| **Delete** | Removes all selected rows with a single undo toast |

4. Click the ✕ button on the bulk bar to deselect all without taking action.

> **Note:** The checkbox column is hidden on print output — it does not appear on paper.

#### Undo on Delete (single row)

Click the trash icon on any expense row. The row disappears immediately and a toast appears at the bottom. Click **Undo** within 4 seconds to restore it. After 4 seconds the deletion is committed.

### Labour Ledger

- Record daily headcount with rates for mason, coolie, helper, and other categories.
- **Manpower PDF import**: import a PDF manpower report (from attendance software) and the app auto-fills counts and computes wages — no manual entry.
- Remarks field for notes (overtime, deductions, etc.).
- **Column sorting** and **bulk actions** (same as Vendor Ledger) are available.

#### Labour Ledger Export Toolbar

The Labour Ledger now has the same four export buttons as the Vendor Ledger:

| Button | Output |
|---|---|
| **Tally CSV** | Tally-compatible CSV for the selected date range |
| **Excel** | `.xlsx` with full attendance + cost breakdown (Mason / Coolie / Helper / Other columns) and totals |
| **PDF** | Native save-dialog PDF (landscape A4) |
| **Print** | Browser print dialog |

### Expense Overview (per-project)

The Expenses home for each project shows running totals for all four categories:
- Amount, Advance, Cash Paid, Cheque Paid, Pending
- Grand total row across all categories.

---

## 8. Vendor Directory

The **Vendor Directory** (sidebar: Directory → Vendor Directory) is a centralised address book of all vendors, contractors, labour agents, and site suppliers your firm works with.

### What is stored

| Field | Description |
|---|---|
| **Name** | Company or individual name |
| **Category** | vendor / contractor / labour / site |
| **Contact Person** | Primary contact |
| **Phone** | Mobile or office number |
| **Email** | Optional |
| **GSTIN** | GST Identification Number |
| **Notes** | Internal notes or address |

### Adding vendors

Click **Add Vendor** in the top-right of the Vendor Directory page. Fill in the form and click **Save**. The vendor is immediately available in the autocomplete dropdown across all expense forms.

### Editing / deleting vendors

Hover over a vendor card and use the **pencil** (edit) or **trash** (delete) icon. Deleting a vendor from the directory does not affect existing expense records that used that vendor's name.

### Filtering and searching

- Use the **search bar** at the top to filter by name.
- Use the **category filter pills** (All / Vendor / Contractor / Labour / Site) to narrow by type.

### Relationship to expense forms

When you add or edit an expense in any ledger, the **Vendor Name** field is backed by the directory:
- Typing shows a dropdown of matching registered names.
- Selecting a name fills the field — no manual typing.
- Typing a **new name** that doesn't exist triggers the **inline registration form** (see Section 7 — Auto-Registering New Vendors).

### JSON Backup coverage

The Vendor Directory is included in the **JSON Export / Import** (Settings → JSON Backup). When you export all data, vendors are included in the JSON file and restored on import.

---

## 9. Reports & Exports

### Summary Sheet

The Summary Sheet aggregates all expenses and gives a full picture of project spending.

- **Print mode toggle**: switch between **Complete** (all expenses) and **GST Only** (bills with GST) before printing.
- GST Component row separates the tax portion.
- Export to **Excel** (three sheets: Summary, All Expenses, GST Bills Only).

### Tally / CSV Export

Any vendor, contractor, or labour ledger can be exported as a **Tally-compatible CSV** for direct import into Tally ERP or Tally Prime.

**How to export:**
1. Open any ledger (Vendor, Contractor, or Labour).
2. Set the date range using the **Period** filter in the header.
3. Click **Tally CSV** in the header toolbar.
4. Choose a save location in the file dialog.

**CSV format (Vendor / Contractor):**

| Column | Description |
|---|---|
| Date | `DD-MM-YYYY` |
| Voucher Type | `Bank Payment` (if cheque > 0) or `Cash Payment` |
| Voucher No. | Sequential number per expense row |
| Ledger/Party Name | Vendor name or "Cash" |
| Dr Amount | Total amount including GST |
| Cr Amount | (blank — for import mapping in Tally) |
| Narration | Description / item text |
| GST Rate | Rate percentage (0 if no GST) |
| GST Amount | Computed GST component |
| Cheque No | Cheque number if applicable |
| Category | `vendor`, `contractor`, or `site` |

The file is saved with a UTF-8 BOM so it opens correctly in Microsoft Excel without encoding issues.

> **Tip:** In Tally Prime go to **Import → Vouchers**, select the CSV, and map the columns using the predefined template. The `Date`, `Party Name`, and `Dr Amount` fields map directly.

### Excel Export (Ledgers)

Each ledger's **Excel** button produces a formatted `.xlsx` file containing:
- **Header rows**: Project name, location, and date range
- **Column headers** matching the on-screen ledger layout
- **Data rows** for the current date-range filter
- **Totals row** at the bottom

Labour Ledger Excel columns: Sr No · Date · Mason (Nos / Rate / Cost) · Coolie (Nos / Rate / Cost) · Helper (Nos / Rate / Cost) · Other (Nos / Rate / Cost) · Amount · Cash · Cheque · Pending · Payment Date.

Vendor / Contractor Ledger Excel columns vary slightly by category — the **Site** category omits Qty and Cheque No columns as those fields are not applicable.

### PDF Export (Native)

Each ledger's **PDF** button opens a native OS **Save As** dialog. The app uses Electron's `webContents.printToPDF()` engine to render the current on-screen ledger at full fidelity (including borders, column headers, and totals) and writes the resulting PDF to the chosen path.

- Page size: **A4 Landscape**
- Print backgrounds are included (column shading, row highlights)
- Default filename is pre-filled as `<Type>_Ledger_<ProjectName>_<DateFrom>_<DateTo>.pdf`

> **Tip:** Use the date-range filter before exporting so the PDF only covers the period you want to share.

### GST Purchase Sheet

Lists all GST-applicable bills across all projects for any date range. Useful for filing quarterly GST returns and sharing with your CA.

**Columns in the GST sheet:**

| Column | Description |
|---|---|
| SR. NO | Row number |
| NAME OF CLIENT | Vendor / party name |
| PROJECT ADDRESS | Plot number and location of the project (e.g. "Plot 12, Andheri West") |
| MONTH & YEAR | Expense date |
| PURCHASER / INVOICE / BILL NO. | Invoice number if entered |
| TAXABLE AMOUNT | Amount before GST |
| GST AMOUNT | GST component |
| GST % | Applicable GST rate |
| CHEQUE NUMBER | Cheque number if paid by cheque |
| NET AMOUNT | Total amount including GST |

**Filters:** Select a month (defaults to current month) and optionally a specific project. Click **Apply** to refresh the sheet.

**Excel export:** The GST sheet can be exported to `.xlsx` using the **Export Excel** button — all columns including Project Address are included.

**Print:** The **Print** button opens the OS print dialog. The sheet is formatted as a bordered table with header rows showing the period, month, and project details.

### Pending Payments (cross-project)

The **Pending Payments** report (sidebar: Reports → Pending Payments) shows all bills with an outstanding balance across every project in one table, sortable by date. Export to Excel.

### PDF Budget Export

The BOQ budget can be exported as a formatted multi-page PDF with category breakdown and summary box.

### Vendor Ledger Print

Each vendor's individual ledger can be printed with full payment history.

### Labour Ledger Print

Print the labour attendance and payment register for any date range.

---

## 10. Global Search

Press **⌘K** (macOS) or **Ctrl+K** (Windows) from anywhere in the app to open the Global Search modal.

### What is searched

| Section | Fields searched |
|---|---|
| **Projects** | Project name, client name |
| **Vendors** | Vendor name, category |
| **Expenses** | Vendor name, description, project name |

Type at least **2 characters** to trigger the search. Results appear in real time as you type (debounced).

### Navigating results

- Click a **Project** result to open that project's budget/expense overview.
- Click a **Vendor** result to open the Vendor Directory filtered to that vendor.
- Click an **Expense** result to navigate to the relevant project's expense page.

### Closing the modal

Press **Escape** or click anywhere outside the modal to close it. The keyboard shortcut (**⌘K / Ctrl+K**) also toggles the modal closed.

---

## 11. Dashboard & Date-Range Filter

The Dashboard shows an overview of all projects with three stat cards and three charts.

### Period Filter

A **Period** dropdown in the top-right of the Dashboard header controls the date range for the charts and the Project Overview table:

| Option | Range |
|---|---|
| **This Month** | 1st of current month to today |
| **Last Month** | Full previous calendar month |
| **This Quarter** | Q1/Q2/Q3/Q4 of current year |
| **Last Quarter** | Previous quarter |
| **This Year** | 1 Jan to 31 Dec of current year |
| **All Time** | No date filter (default) |

When a period other than **All Time** is selected, the **Monthly Spend Trend** bar chart and **Category Breakdown** pie chart update to show only data within that range. The **Project Overview** table also filters expense and pending amounts.

> **Note:** The **Total Projects** stat card always shows the all-time project count regardless of the period selected. The **Total Pending** card also reflects all-time outstanding balances (not filtered by period) since pending amounts may be from older bills.

---

## 12. Multi-User (Shared Database)

Two or more team members can work on the same data simultaneously by pointing the app at a shared SQLite file on a network drive or cloud-synced folder (Google Drive, OneDrive, Dropbox, LAN share).

### Setup (one-time, done on one machine)

1. Go to **Settings → Shared Database**.
2. Click **Change Location** and select a folder that all users can access (e.g. a shared Google Drive folder).
3. The app copies the current database to that folder and saves the path.
4. On each other machine: install the app, go to **Settings → Shared Database**, click **Change Location**, and select the **same folder**.

### Limitations

- SQLite WAL mode allows concurrent reads; writes are serialised by SQLite's locking. Avoid two users saving at exactly the same moment.
- Cloud-sync folders (Google Drive, OneDrive) introduce a small sync delay. Wait for the sync indicator to finish before the second user opens the app.
- If you see "database is locked" errors, close the app on one machine and reopen.

### Reverting to local database

Go to **Settings → Shared Database → Reset to Default**. The app returns to using the local database (shared database is not deleted).

---

## 13. Backup & Restore

### SQLite File Backup (recommended)

- **Settings → Database Backup → Backup .db File**: saves a complete snapshot of the SQLite file.
- **Restore .db File**: select a previous backup — the app restarts automatically with the restored data.
- Store backups on an external drive or cloud storage.
- Schedule regular backups (weekly minimum for active projects).

### JSON Export / Import

- **Export Data (JSON)**: exports all projects, budgets, expenses, **vendors**, and templates as a human-readable JSON file. Useful for cross-version transfers or inspecting data.
- **Import Data (JSON)**: **replaces all existing data** with the imported file. This includes the Vendor Directory. Confirm carefully before importing.

> **Attachments note:** Bill photo attachments are stored separately in the `attachments/` sub-folder inside the app's userData folder. Include this folder in your external backups. The `.db` backup does not include the photo files.

---

## 14. Auto-Update

Starting from v1.1, Projex updates itself silently without requiring a manual download or reinstall.

### How it works

1. **On launch** (packaged builds only), the app waits 5 seconds then checks for a new release on GitHub.
2. If an update is found, it downloads in the background — the app continues working normally.
3. When the download finishes, a **blue banner** appears at the top of the app:
   > *"Update vX.Y.Z downloaded and ready to install."* — **Restart & Update** button
4. Click **Restart & Update** to quit the app and install the update. Your data is never affected.
5. If you dismiss the banner, the update will install automatically the next time you quit the app.

### Update channel

Updates are published to the GitHub Releases page of the Projex repository. The update feed is configured in `electron-builder`'s `publish` section:

```json
"publish": {
  "provider": "github",
  "owner": "hashxlabs",
  "repo": "projex-releases"
}
```

### In development / unpackaged builds

Auto-update is **disabled** when running the app from source (`npm run electron:dev`). This prevents spurious update checks during development.

### Manually checking for updates

There is no manual "Check for Updates" button in the current UI — checks happen automatically on launch. If you need to force a check, restart the app.

---

## 15. Security — PIN Lock

For firms requiring extra privacy, Projex includes a native **PIN Lock** system that prevents unauthorised access to your data.

### How to enable

1. Go to **Settings → Security — PIN Lock**.
2. Click **Set PIN**.
3. Enter a **4 to 6 digit** numeric PIN.
4. Confirm the PIN and click **Set PIN**.

Once enabled, the app will show the PIN Lock screen immediately upon every launch (after the license check). You cannot access the dashboard or any project data without entering the correct PIN.

### Changing or Removing the PIN

- **To Change:** Go to Settings, click **Change PIN**, enter your current PIN, then set the new one.
- **To Remove:** Click **Remove PIN** and enter your current PIN to authenticate the removal.

### Security Features

- **Brute-force protection:** After **5 incorrect attempts**, the app locks for **30 seconds**. The lockout period increases with further failed attempts.
- **Privacy:** PIN digits are masked as dots on screen. Use the "eye" icon in Settings to temporarily peek at the digits you are typing during setup.
- **Keyboard support:** You can use your physical keyboard's number row or numpad to enter the PIN, or click the on-screen numpad.

> **Warning:** If you forget your PIN, you will be locked out of your data. Contact HashX Labs for a secure override procedure (requires proof of ownership and the database file).

---

## 16. Settings Reference

| Setting | Description |
|---|---|
| **Dark Mode** | Toggle between light and dark theme. Preference is saved in localStorage. |
| **Currency** | Change the working currency (INR, USD, EUR, GBP, AED, SAR, SGD, AUD). All amounts throughout the app reformat immediately. |
| **Company Name** | Set during the Onboarding Wizard; used on printed reports and CSV exports. Can be updated anytime from Settings. |
| **License** | Shows client name, email, seats, expiry date, days remaining, Machine ID. Deactivate button removes the license from this machine. |
| **Database Backup** | Backup/restore the SQLite file. |
| **JSON Backup** | Export/import all data as JSON (includes Vendor Directory). |
| **Shared Database** | Set a custom path for the database file (multi-user setup). |
| **About** | App version, developer info. |

---

## 17. License Management — Admin Guide

This section is for HashX Labs staff who generate and distribute licenses.

### Prerequisites

- `scripts/license-private.pem` — the RSA-2048 private key. **Keep this secret. Never commit to git.**
- Node.js installed on your machine.

### Generating a new license

1. Get the client's **Machine ID** (they copy it from the License screen).
2. Run:

```bash
node scripts/keygen.js \
  --client    "ABC Architects" \
  --email     "info@abc.com" \
  --seats     2 \
  --expiry    2027-04-25 \
  --machineId "a1b2c3d4e5f6g7h8..."
```

3. The output `.lic` file is saved to `licenses/`. Email it to the client.

### License parameters

| Flag | Required | Description |
|---|---|---|
| `--client` | Yes | Client company name (shown inside the app) |
| `--email` | No | Contact email (shown in Settings) |
| `--seats` | No | Number of licensed seats (informational, default 1) |
| `--expiry` | Yes | Expiry date in YYYY-MM-DD format |
| `--machineId` | Yes | Machine UUID from the client's License screen |

### Renewals

Generate a new `.lic` with an updated `--expiry` date (same `--machineId`). Email the new file. The client imports it the same way as the original activation.

### Machine transfers

If a client changes computer:
1. Client shares their new Machine ID.
2. Generate a new `.lic` with the new `--machineId` and the remaining original expiry period.
3. The old machine's `license.dat` becomes invalid as soon as they activate on the new one (different machine ID won't decrypt the stored file).

### Tracking issued licenses

Keep a spreadsheet or database of:

| Client | Email | Machine ID | Issued | Expiry | Seats | Notes |
|---|---|---|---|---|---|---|

This is your source of truth for renewals and transfers. The app has no phone-home capability — record-keeping is entirely on your side.

---

## 18. Security Architecture

### License key format

```
base64(JSON payload) . base64(RSA-SHA256 signature)
```

The payload contains: `client`, `email`, `seats`, `expiry`, `machineId`, `issued`.

The signature is created with an RSA-2048 private key (PKCS#1, SHA-256). The public key is embedded in the app binary. Without the private key it is computationally infeasible to forge a valid license.

### Machine binding (two layers)

**Layer 1 — Key-level binding (checked at activation)**
The `machineId` in the signed payload is compared to the machine's UUID at the time of activation. A `.lic` file generated for machine A cannot be activated on machine B.

**Layer 2 — Storage-level binding (checked on every launch)**
`license.dat` is encrypted with AES-256-GCM using a key derived from the machine's UUID + hostname via `scrypt`. Copying `license.dat` to a different machine fails to decrypt.

### What a potential attacker would need

To bypass the license system an attacker would need ALL of the following:
- The RSA private key (never leaves HashX Labs)
- OR the exact `machineId` + `hostname` of the target machine (to decrypt a stolen `license.dat`)

Simply copying the `.lic` file or `license.dat` between machines is not sufficient.

### What this system does NOT protect against

- A client who re-images their machine with the same hostname and copies `.machine-id` (they effectively keep the same identity).
- Server-side license revocation (the app is fully offline — there is no revocation mechanism).

These are acceptable trade-offs for an offline, single-firm application.

---

## 19. Troubleshooting

### "No license activated on this machine"
Import your `.lic` file. If you don't have one, contact HashX Labs with your Machine ID.

### "License file is corrupted or belongs to a different machine"
The stored `license.dat` was copied from another machine or is damaged. Re-import your original `.lic` file to re-activate.

### "This license is locked to a different Machine ID"
Your `.lic` file was generated for a different computer. If you have changed machines, contact HashX Labs with your new Machine ID to get a replacement license.

### "License expired — grace period has ended"
Contact HashX Labs to renew. Provide your Machine ID.

### App won't open after restore
If you restored a `.db` file from a different machine that had a different shared database path, go to **Settings → Shared Database → Reset to Default** on next launch (if the app opens), or delete `app-settings.json` from the userData folder manually.

### "Database is locked"
Two instances of the app are trying to write simultaneously. Close all but one and retry.

### Attachments missing after restore
Attachments are stored separately. Copy the `attachments/` folder from the backed-up userData directory alongside the `.db` file.

### Auto-update banner not appearing
- Auto-update only works in the **packaged (installed) build**, not when running from source.
- Ensure the machine has internet access so the app can reach GitHub Releases.
- If an update was previously downloaded but the restart was deferred, restart the app — the update installs automatically on next quit.

### Onboarding Wizard showed again after re-install
The wizard is triggered by the `onboardingComplete` flag in `app-settings.json`. If you re-installed the app and `app-settings.json` was deleted (Windows: `%APPDATA%\arch-budget-calculator`; macOS: `~/Library/Application Support/arch-budget-calculator`), the wizard will re-run. Complete it or click **Skip setup** — your existing database data is unaffected.

### Project status not showing / showing "Active" for old projects
Existing projects created before v1.1 have their status migrated to `Active` automatically on first launch of the new version. No action needed.

### "Undo" toast dismissed accidentally
Once the 4-second undo window closes, the deletion cannot be reversed from within the app. Restore from a recent `.db` backup if the data is critical.

### Vendor autocomplete not showing a vendor I added
The autocomplete list is fetched when the expense form opens. If you added a vendor in the Vendor Directory in the same session without closing and reopening the ledger, close the expense form, reload the ledger (change the date range and apply), then reopen the form.

### PDF export button not responding
The PDF export uses Electron's native print engine. Ensure the app is running as a **packaged build** (not in dev mode). In dev mode (`npm run electron:dev`), use the **Print** button instead and choose "Save as PDF" from the OS print dialog.

---

## 20. FAQ

**Q: Can I use this on two computers at the same time?**
Yes — set up a Shared Database (section 12). Both machines work from the same `.db` file.

**Q: Can I transfer my data to a new computer?**
Yes — use **Backup .db File** on the old machine, copy to the new machine, and use **Restore .db File**. Then contact HashX Labs with the new Machine ID to get a replacement license.

**Q: What happens when my license expires?**
You get a 7-day grace period where the app opens with a red banner. After that, the License screen is shown and you cannot access the app until a renewed license is activated. Your data is never deleted.

**Q: Is my data sent anywhere?**
No. The app is fully offline. The only network traffic is the auto-update check to GitHub Releases (a read-only HTTPS request). No project data, expense data, or personal information is ever transmitted.

**Q: Can I run two projects simultaneously on different monitors?**
The app is a single-window application. You can have only one instance open at a time per machine.

**Q: How do I change the currency after the onboarding wizard?**
Go to **Settings → Currency** and select a new currency. All formatted amounts update immediately across the entire app.

**Q: Can I filter the dashboard to see just this month's expenses?**
Yes. Use the **Period** dropdown in the top-right of the Dashboard to select This Month, Last Month, This Quarter, Last Quarter, This Year, or All Time.

**Q: How do I bulk-delete a vendor's old paid entries?**
Open the vendor's ledger, check the checkbox in the header to select all rows, then click **Delete** in the bulk-action bar. An undo toast gives you 4 seconds to reverse the deletion.

**Q: Can I import expenses into Tally?**
Yes. Open any Vendor, Contractor, or Labour ledger, set the date range, and click **Tally CSV**. Import the resulting CSV into Tally ERP / Tally Prime using **Import → Vouchers**.

**Q: How do I archive a completed project?**
Hover over the project card, click the status badge (shows "Active"), and select **Archived** from the dropdown. The card will appear dimmed. Use the **Archived** filter pill to view archived projects.

**Q: How do I add a new expense category type (e.g. "Subcontractor")?**
The four categories (Labour, Vendor, Contractor, Site) are fixed. Use the **Contractor** category for subcontractors — it supports the same GST and payment tracking fields.

**Q: Will the auto-update overwrite my database?**
No. The auto-update only replaces application files (the executable, renderer bundle, and Electron runtime). The database file is stored in a separate `userData` folder and is never touched by the updater.

**Q: I typed a new vendor name in the expense form and a registration panel appeared. Is the vendor saved even if I cancel the form?**
No. The vendor is only saved when you **submit the expense form**. If you cancel or close the form, the new vendor is not registered in the directory.

**Q: Does the Vendor Directory sync automatically with other users on a shared database?**
Yes. The Vendor Directory is stored in the shared SQLite database, so all users on the same shared database see the same directory. A page reload (close and reopen the expense form) picks up vendors added by another user.

**Q: How do I search for an old expense?**
Press **⌘K** (macOS) or **Ctrl+K** (Windows) and type the vendor name, description, or project name. Click the matching expense result to jump directly to that project's expense page.

**Q: The GST sheet doesn't show the project address for some bills. Why?**
Project address is pulled from the **Plot No.** and **Location** fields of the project. Edit the project (pencil icon on the project card) and fill in those fields — the GST sheet will reflect them immediately.

---

## 21. Changelog

### v1.0 — Initial Release

**Core**
- Project management with name, client, plot number, location, area (sq.ft), and description.
- Project status (Active / On Hold / Completed / Archived) with one-click status change and grid filter pills.
- Duplicate a project to reuse its BOQ structure.
- Budget / BOQ with colour-coded categories, line items (description · unit · qty · rate), summary box (subtotal, contingency, GST, grand total, rate/sq.ft), and reusable templates.
- Export BOQ to PDF and Excel.

**Expense Tracking**
- Labour, Vendor, Contractor, and Site expense categories.
- Per-bill GST toggle with automatic GST amount and total computation.
- Payment tracking: advance, cash paid, cheque paid, cheque number, payment date, pending balance.
- Attach a photo or PDF scan to any bill.
- Manpower PDF import for Labour entries — auto-fills headcount and computes wages.
- Column sorting (Date / Amount / Pending) in all ledgers.
- Bulk-select rows to bulk-delete or bulk-mark-paid in one click.
- Undo on delete — 4-second toast to reverse any single or bulk deletion.
- Vendor name autocomplete in expense forms backed by the Vendor Directory.
- Auto-register new vendors inline: typing an unknown vendor name expands a registration panel within the expense form; the vendor is saved to the directory on submit.

**Security**
- Native PIN Lock system (4-6 digits) with brute-force protection (lockout after 5 attempts).
- AES-256-GCM encryption for stored license data.
- RSA-2048 signing for license keys.

**Export Toolbar (all ledgers)**
- **Tally CSV** — Tally ERP / Prime compatible CSV with UTF-8 BOM.
- **Excel** — `.xlsx` with project header, full data table, and totals row.
- **PDF** — Native OS save-dialog PDF via Electron's print engine (A4 landscape).
- **Print** — Browser print dialog.

**Vendor Directory**
- Centralised address book for vendors, contractors, labour agents, and site suppliers.
- Fields: name, category, contact person, phone, email, GSTIN, notes.
- Search by name and filter by category.
- Included in JSON backup / restore.

**Reports**
- **GST Purchase Sheet** — Cross-project monthly GST detail table with PROJECT ADDRESS column; export to Excel; print-ready bordered table.
- **Pending Payments** — Cross-project view of all outstanding balances; export to Excel.
- **Dashboard** — Stat cards (total projects, this-month expenses, total pending) + Monthly Trend chart + Category Breakdown pie + Project Overview table with period filter (This Month / Last Month / This Quarter / Last Quarter / This Year / All Time).

**Global Search**
- **⌘K / Ctrl+K** opens a search modal that searches projects, vendors, and expenses simultaneously. Click any result to navigate directly.

**App & Platform**
- Custom brand icon (architectural arch + bar chart + ₹ badge) for macOS Dock and Windows taskbar.
- Onboarding Wizard on first launch (Company Name → Currency → First Project).
- Multi-currency support: INR, USD, EUR, GBP, AED, SAR, SGD, AUD.
- Dark mode throughout.
- Shared SQLite database for multi-user setups over a network or cloud-synced folder.
- SQLite file backup / restore and full JSON export / import (covers all tables including Vendor Directory).
- RSA-signed, machine-locked offline licensing with AES-256-GCM storage binding.
- Silent auto-update via electron-updater; banner + Restart & Update button when an update is ready.

---

*For support, contact HashX Labs. Provide your Machine ID and a description of the issue.*
