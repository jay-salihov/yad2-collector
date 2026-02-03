# BUG-002: No collection when navigating to next page (SPA pagination)

| Field           | Value                                              |
|-----------------|----------------------------------------------------|
| **ID**          | BUG-002                                            |
| **Reported**    | 2026-02-03                                         |
| **Reporter**    | Manual tester                                      |
| **Severity**    | High                                               |
| **Status**      | Resolved                                           |
| **Resolved**    | 2026-02-03                                         |
| **Component**   | Content Script / SPA navigation handling            |
| **Browser**     | Firefox Developer Edition                          |
| **Page**        | https://www.yad2.co.il/vehicles/cars               |

## Summary

When navigating to the next page via Yad2's SPA pagination controls, the extension does not collect listings from the new page. Only the initial page load's listings are ever captured; all subsequent pages visited via client-side navigation are missed entirely.

## Steps to Reproduce

1. Install the extension in Firefox Developer Edition.
2. Navigate to https://www.yad2.co.il/vehicles/cars.
3. Open the extension popup — observe that listings from page 1 are collected.
4. Click the "next page" pagination control on the Yad2 page (navigates to page 2).
5. Open the extension popup — observe the listing count.

## Expected Behavior

- **Step 5:** The listing count increases by the number of listings on page 2 (typically ~40 new listings). The collector should capture fresh data from each page navigated to via SPA pagination.

## Actual Behavior

- **Step 5:** The listing count remains the same as after step 3. No new listings from page 2 are collected. The same page 1 data may be reprocessed (harmless upserts) but page 2 listings are never captured.

## Root Cause

The extension extracts listing data by reading the `__NEXT_DATA__` script tag from the DOM (`src/content/extractor.ts:extractNextData()`). This works correctly on the initial page load because Next.js server-renders the page and populates `__NEXT_DATA__` with the dehydrated React Query state.

However, `__NEXT_DATA__` is a **static artifact of the initial server-side render**. On subsequent client-side SPA navigations (including pagination), Next.js does NOT update the `__NEXT_DATA__` DOM element. Instead, it:

1. Calls `history.pushState()` to update the URL (e.g., `?page=2`)
2. Fetches fresh page data from `/_next/data/<buildId>/<path>.json` via `window.fetch()`
3. Hydrates React Query's client-side cache with the response
4. Re-renders the page components with the new data

This means:

- **MutationObserver on `__NEXT_DATA__`**: Never fires — the script element is unchanged.
- **Head observer for script replacement**: Never fires — no new script element is added.
- **History API interception**: May detect the URL change (see caveat below), but `extractNextData()` reads **stale page 1 data** from the unchanged `__NEXT_DATA__` element.

### Additional caveat: History API wrapping in Firefox isolated world

The observer wraps `history.pushState`/`replaceState` from the content script's isolated world. In Firefox, content scripts use Xray wrappers — modifications to `history.pushState` on the Xray view are not visible to page-level JavaScript. The page's calls to `history.pushState()` bypass the content script's wrapper entirely. Only `popstate` (back/forward navigation) reliably fires from the content script's event listener.

This means forward SPA navigation (clicking "next page") may not even trigger `processCurrentPage()` in some cases, compounding the issue.

## Fix

Add a **MAIN-world content script** (`src/content/page-script.ts`) that intercepts `window.fetch()` in the page's JavaScript execution context:

1. The page-script runs at `document_start` in `world: "MAIN"` (before any page scripts execute), ensuring `fetch` is wrapped before the page uses it.
2. When a `fetch()` response from a `/_next/data/` URL is detected, the response is cloned, parsed as JSON, and forwarded to the content script via `window.postMessage()`.
3. The content script (`src/content/index.ts`) listens for these messages, extracts `pageProps.dehydratedState.queries`, and processes them through the existing parser and sanitizer pipeline.

### Files changed

- `src/content/page-script.ts` — New MAIN-world script: intercepts `fetch()` for `/_next/data/` responses
- `src/content/index.ts` — Listens for `postMessage` from page-script, processes intercepted data
- `src/content/extractor.ts` — Adds `extractQueriesFromFetchResponse()` for the `/_next/data/` response format
- `manifest.json` — Registers the MAIN-world content script
- `esbuild.config.mjs` — Adds `page-script` entry point

## Impact

Pagination is a core browsing pattern for Yad2 users. Without this fix, the extension only captures ~40 listings from the initial page load, missing potentially hundreds of listings across subsequent pages. This severely limits the extension's data collection capability and usefulness.

## Related

- BUG-001 noted unexplained count increases that could be related to SPA re-extraction behavior (see BUG-001 "Note on Step 5")
