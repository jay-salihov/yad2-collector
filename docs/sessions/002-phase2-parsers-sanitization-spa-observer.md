# Session 002: Phase 2 Parsers, Sanitization, and SPA Observer

**Date:** 2026-02-03

## Summary

Completed all of Phase 2, moving parsing logic from inline code to dedicated modules. Implemented category-specific parsers for vehicles and real estate in `src/content/parsers/`, each handling both feed and detail page structures. Created a sanitizer module that validates tokens, prices, and enums before data reaches the background script. Implemented a dual MutationObserver strategy to detect Next.js SPA navigation on Yad2, triggering re-parsing when the user navigates without full page reload.

## Key Discoveries

- Next.js updates `__NEXT_DATA__` in two ways: modifying the script element's content (characterData changes) or replacing the entire element. A single MutationObserver misses one pattern, so two observers are required (one on the script element, one on document.head).
- The real estate API nests the floor value as `{ value: N }` instead of a direct number. Using `get(raw, "floor", "value")` extracts it correctly.
- Detail pages often lack the `adType` field. Both parsers default to `"private"` as a safe fallback, matching Phase 1 behavior.
- Sanitizer price validation must distinguish between null prices (valid, listings without prices) and invalid non-null prices (NaN, Infinity, negative). Only the latter are nullified.
- The observer may fail to initialize if `__NEXT_DATA__` doesn't exist at setup time. The head observer compensates by watching for newly added script elements, but this assumes the element will eventually appear.

## Pitfalls to Avoid

- Do not use a single characterData observer on `__NEXT_DATA__`. It won't fire when Next.js replaces the entire script element on some navigations.
- Do not process every mutation immediately. Multiple mutations can fire for a single navigation. The 300ms debounce + URL deduplication prevents duplicate processing.
- Do not assume all Yad2 listings have prices. The sanitizer allows null prices to pass through; only invalid non-null prices are rejected.

## Next Steps

1. Create popup UI (`popup/popup.html`, `popup/popup.ts`, `popup/popup.css`) with stats display (total listings, price changes, last collected time) and export buttons. Wire GET_STATS and EXPORT_CSV messages to background.
2. Define `Exporter` interface in `src/export/base.ts`: `{ name: string, extension: string, generate(listings: Listing[]): Blob }`.
3. Implement CSV exporter in `src/export/csv.ts` with UTF-8 BOM for Hebrew Excel compatibility. Vehicle columns: token, ad_type, manufacturer, model, sub_model, year, engine_type, hand, km, price, first_price, price_changes, area, address, description, image_url, first_seen, last_seen. Real estate columns: token, ad_type, property_type, rooms, sqm, floor, condition, price, first_price, price_changes, city, neighborhood, address, description, image_url, first_seen, last_seen.
4. Wire export button in popup to background message handler that reads from IndexedDB via cursor, generates CSV, and triggers download via `browser.downloads.download()` with Blob URL.
5. Create placeholder options page (`options/options.html`, `options/options.ts`) for future settings.
6. After Phase 3, begin Phase 4: write unit tests for parsers, sanitizer, DB operations, and CSV export. Add comprehensive error handling and logging. Conduct manual end-to-end testing with live Yad2 browsing.
