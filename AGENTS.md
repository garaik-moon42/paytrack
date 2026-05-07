# AGENTS.md

## Project Overview

Paytrack is a Google Sheets-bound Google Apps Script project for managing MOON42 RDI Kft. incoming and payable invoices.

The source is TypeScript under `src/`, compiled to JavaScript under `build/`, and deployed to Apps Script with `clasp`. The deployed Apps Script reads an existing Google Sheets workbook and currently provides a K&H HUF GIRO transfer export sidebar.

Read `README.md` before making product-level changes. It documents the workbook structure, current export behavior, and manual test scenarios.

## Repository Layout

- `src/Code.ts`: Apps Script backend, Sheets menu, validation, export grouping, CSV generation.
- `src/HufTransferExportSidebar.html`: sidebar UI and browser-side file download logic.
- `scripts/copy-manifest.mjs`: copies `appsscript.json` and `.html` files into `build/` after TypeScript compilation.
- `appsscript.json`: Apps Script manifest. Keep `timeZone` as `Europe/Budapest` unless explicitly asked.
- `build/`: generated output. Do not edit this directory by hand.

## Setup Commands

- Install dependencies: `npm ci`
- Build locally: `npm run build`
- Watch TypeScript only: `npm run watch`
- Push to Apps Script: `npm run push`
- Pull from Apps Script: `npm run pull`

Use `npm run build` as the default verification command after code changes.

## Development Workflow

- Edit source files in `src/`, not generated files in `build/`.
- If adding new Apps Script HTML files, place them under `src/`; the build script copies `.html` files to `build/`.
- Keep public Apps Script entrypoints global functions. Apps Script calls functions such as `onOpen`, `showHufTransferExportSidebar`, `getHufTransferExportPreview`, and `getHufTransferExportFile` by name.
- Avoid changing spreadsheet data during preview or export unless the task explicitly asks for it. The current export is read-only.
- Do not run `clasp push` or `clasp pull` unless the user asks for deployment/sync or the task clearly requires it.
- Be careful with `.clasp.json`; it is local, untracked, and contains the target Apps Script `scriptId`.

## Code Style

- TypeScript strict mode is enabled. Keep code compatible with Apps Script V8 and the `ES2019` target.
- The project currently uses double quotes and semicolons; follow that style.
- Prefer small pure helper functions for parsing, validation, grouping, and CSV generation.
- Use Google Apps Script services directly only at the boundary layer. Keep business logic easy to inspect and test manually.
- Preserve Hungarian user-facing labels and spreadsheet header names exactly, including accents and case.
- Avoid broad refactors when implementing narrow feature requests.

## Workbook and Export Rules

- The invoice sheet is named `SZÁMLÁK`.
- Configuration is read from the `CONFIG` sheet. It has a header row with `property` and `value` columns.
- Required export headers are matched by name: `Kedvezményezett`, `Számlaszám`, `Közlemény`, `bruttó`, `pénznem`, `státusz`, `utalás napja`.
- HUF export only includes rows where `státusz` is exactly `Rögzíthető` and `pénznem` is exactly `HUF`.
- The source account comes from the `CONFIG` sheet property `PAYTRACK_HUF_SOURCE_ACCOUNT`.
- K&H export files are `.HUF.CSV`, semicolon-delimited, encoded as `ISO-8859-2`, with a header row and at most 40 items per file.
- The export must not silently truncate or repair invalid data. Report validation errors instead.

## Testing Instructions

Run:

```bash
npm run build
```

Manual scenarios to consider when changing export logic:

- Missing `CONFIG` sheet or missing `PAYTRACK_HUF_SOURCE_ACCOUNT` shows a validation error.
- Missing required sheet headers show validation errors.
- Valid `Rögzíthető` + `HUF` rows appear in the daily summary.
- Non-HUF rows, empty transfer dates, past dates, non-integer amounts, invalid GIRO numbers, and too-long text fields fail validation.
- 41 items on the same transfer date produce 2 files.
- Downloaded CSV includes the expected header row, semicolon-separated fields, `yyyy.MM.dd` value dates, and `.HUF.CSV` filename.

## Security and Data Handling

- Do not commit `.clasp.json`, generated `build/` output, credentials, CONFIG values from real data, bank account numbers from real data, or downloaded bank import files.
- Treat invoice data, partner names, bank account numbers, and payment comments as sensitive business data.
- Prefer validation failures over lossy transformations for payment exports.
- Do not modify payment statuses automatically unless the user explicitly requests that behavior.

## Pull Request Notes

- Summarize behavior changes and mention any spreadsheet headers, CONFIG properties, or Apps Script entrypoints affected.
- Include the verification command you ran, normally `npm run build`.
- If a change cannot be verified locally because it needs a live Google Sheet or Apps Script deployment, say that explicitly.
