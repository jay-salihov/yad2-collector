# Yad2 Listing Collector

Firefox WebExtension (Manifest V3) that passively collects [Yad2](https://www.yad2.co.il) listing data as you browse. It stores listings in IndexedDB, tracks price changes over time, and exports to CSV. Built with TypeScript and zero runtime dependencies — only browser APIs.

Supports **vehicles** and **real estate** categories.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Firefox](https://www.mozilla.org/firefox/) (Developer Edition or Nightly recommended for unsigned extensions)

### Setup

```bash
git clone <repo-url>
cd yad2-collector
npm install
npm run build
```

### Load in Firefox

**Temporary installation (for development):**

1. Run `npm run build` to produce the `dist/` output.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **"Load Temporary Add-on..."**.
4. Select the `manifest.json` file in the project root.
5. The extension icon should appear in the toolbar.

**Using web-ext (recommended for development):**

```bash
npm run start
```

This builds the extension and launches Firefox with it loaded, opening `https://www.yad2.co.il/vehicles/cars` automatically.

> **Note:** Temporary add-ons are removed when Firefox closes. You'll need to re-load after each restart.

## Usage

1. Browse any Yad2 vehicles or real estate page as you normally would.
2. The extension silently extracts listing data from the page in the background.
3. Click the extension icon in the toolbar to see collection stats (total listings, price changes detected, etc.).
4. Use the **Export CSV** buttons in the popup to download your collected data.

CSV files include a UTF-8 BOM so Hebrew characters display correctly in Excel.

### What gets collected

- Listing details: title, price, address, images, category-specific fields
- Price history: every price change is recorded with a timestamp
- Collection log: when and where data was collected

The extension only activates on `www.yad2.co.il/vehicles/*` and `www.yad2.co.il/realestate/*` pages. No data is sent anywhere — everything stays in your browser's IndexedDB.

## Development

### Commands

| Command | Description |
|---|---|
| `npm run build` | Bundle TypeScript via esbuild into `dist/` |
| `npm run watch` | Rebuild on file changes |
| `npm run start` | Launch Firefox with the extension loaded |
| `npm run test` | Run the vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint + TypeScript type checking |

### Project Structure

```
src/
├── background/        # Service worker — IndexedDB ops, message handling, CSV export
├── content/           # Content script — DOM extraction, SPA navigation observer
│   └── parsers/       # Category-specific parsers (vehicles, realestate)
├── popup/             # Toolbar popup UI — stats display, export buttons
├── options/           # Settings page (placeholder)
├── export/            # CSV generation logic
└── shared/            # Types, constants, sanitizer, message definitions
tests/                 # Vitest test suite mirroring src/ structure
context/               # Reference materials (Python scraper, sample API responses)
```

### Architecture

The extension has four entry points bundled by esbuild:

1. **Content script** — Injected into Yad2 pages at `document_idle`. Extracts listing data from the Next.js `__NEXT_DATA__` script tag. A `MutationObserver` detects SPA navigation (debounced at 300ms).
2. **Background service worker** — Receives messages from the content script. Upserts listings into IndexedDB, tracks price changes, and handles CSV export requests.
3. **Popup** — Displays collection statistics and provides export controls.
4. **Options** — Placeholder for future settings UI.

## Testing

### Running Tests

```bash
npm run test           # Single run
npm run test:watch     # Watch mode — re-runs on file changes
```

Tests use [Vitest](https://vitest.dev/) and [`fake-indexeddb`](https://github.com/nicedoc/fake-indexeddb) to mock browser IndexedDB in Node.js.

### Test Coverage Areas

| Area | Test file | What it covers |
|---|---|---|
| Input sanitization | `tests/sanitizer/sanitizer.test.ts` | Token format, price bounds, enum validation, HTML stripping |
| Safe accessor | `tests/parsers/common.test.ts` | Nested property access, missing keys, default values |
| Vehicle parser | `tests/parsers/vehicles.test.ts` | Feed + detail page parsing for vehicle listings |
| Real estate parser | `tests/parsers/realestate.test.ts` | Feed + detail page parsing for property listings |
| Data extraction | `tests/parsers/extractor.test.ts` | `__NEXT_DATA__` JSON extraction from DOM |
| IndexedDB operations | `tests/db/db.test.ts` | Upsert, price change detection, stats queries |
| CSV export | `tests/export/csv.test.ts` | Column generation, UTF-8 BOM, field escaping |

### Linting and Type Checking

```bash
npm run lint
```

This runs ESLint (flat config, ESLint 9) and the TypeScript compiler in check-only mode (`tsc --noEmit`). Both must pass cleanly.

### Manual Testing & Identifying Issues

To test the extension end-to-end in Firefox:

1. **Load the extension** using `npm run start` or the temporary add-on method above.

2. **Check the content script:**
   - Navigate to a Yad2 vehicles or real estate feed page (e.g., `https://www.yad2.co.il/vehicles/cars`).
   - Open the browser console (`F12` > Console tab).
   - Look for log messages prefixed with `[yad2-collector]` — these confirm the content script is running and extracting data.
   - If no messages appear, check the Extensions tab in DevTools for errors.

3. **Test SPA navigation:**
   - From a feed page, click into a listing detail page and then navigate back.
   - Each navigation should produce new `[yad2-collector]` log messages in the console.
   - Verify that the same page isn't processed twice (the observer tracks `lastProcessedUrl`).

4. **Check the background script:**
   - Go to `about:debugging#/runtime/this-firefox`.
   - Find the extension and click **Inspect** to open the background script's DevTools.
   - Look for `[yad2-collector]` messages confirming listings are being received and stored.

5. **Verify the popup:**
   - Click the extension icon in the toolbar.
   - Stats should update to reflect collected listings.
   - Test the CSV export buttons — a file should download.

6. **Inspect IndexedDB directly:**
   - In the background script's DevTools, go to the **Storage** tab.
   - Expand **IndexedDB** > `yad2_collector`.
   - Check the `listings`, `price_history`, and `collection_log` stores for expected data.

7. **Common issues to watch for:**
   - **No data extracted:** Yad2 may have changed their page structure or removed the `__NEXT_DATA__` script tag. Check the console for parser errors.
   - **Extension not activating:** Verify the URL matches the content script patterns (`/vehicles/*` or `/realestate/*`).
   - **Build errors:** Run `npm run lint` to catch TypeScript issues. Run `npm run build` and check for esbuild errors.
   - **IndexedDB errors:** Check the background script console for transaction failures or schema version conflicts.
   - **CSV encoding issues:** If Hebrew characters appear garbled, ensure the CSV is opened with UTF-8 encoding (the BOM should handle this automatically in Excel).

## Permissions

The extension requests minimal permissions:

- **`storage`** — For IndexedDB access (listing data persistence)
- **`downloads`** — For triggering CSV file downloads
- **`host_permissions: www.yad2.co.il`** — Content script injection on Yad2 pages only

No data leaves your browser. There are no analytics, telemetry, or external API calls.

## License

Private project — not published or distributed.
