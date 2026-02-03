# Session 001 — Project Scaffolding & Phase 1 Core Pipeline

## What Was Done

### 1. Project scaffolding (commit `9febfd8`)
Created the full directory structure and config files for a Firefox WebExtension (Manifest V3) written in TypeScript, per `context/PLAN.md`:

- **Build tooling:** `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `web-ext-config.mjs`
- **Manifest:** MV3 with minimal permissions (`storage`, `downloads`, host-only `yad2.co.il`)
- **Source stubs:** All files under `src/` created with module-level comments
- **Type definitions:** `shared/types.ts` fully defines `Listing`, `VehicleFields`, `RealEstateFields`, `DetailFields`, `PriceRecord`, `CollectionLogEntry`
- **Message protocol:** `shared/messages.ts` defines `LISTINGS_BATCH`, `LISTING_DETAIL`, `GET_STATS`, `EXPORT_CSV`
- **Constants:** `shared/constants.ts` — DB name/version, URL regex patterns, allowed host
- **Placeholder icons:** 48px and 96px blue PNGs in `icons/`
- **Test directory structure:** `tests/{parsers,db,sanitizer,fixtures}/` with `.gitkeep`
- **GitHub repo created:** `jay-salihov/yad2-collector` (public)

### 2. Phase 1 implementation (commit `40c51b2`)
Implemented the end-to-end data pipeline from content script extraction to IndexedDB storage:

**`src/background/db.ts`**
- Opens IndexedDB (`yad2_collector`, version 1) with three object stores:
  - `listings` (keyPath: `token`) — indexes on `category`, `lastSeenAt`, `currentPrice`, compound `[category, lastSeenAt]`
  - `price_history` (autoIncrement) — indexes on `token`, compound `[token, recordedAt]`
  - `collection_log` (autoIncrement) — index on `collectedAt`
- `upsertListings()` — batch upsert in a single transaction; detects price changes and writes to `price_history`
- `upsertDetailListing()` — merges `detailFields` into existing records or creates new ones
- `writeCollectionLog()` — writes collection metadata per page visit
- `getStats()` — counts by category, total price history records, last collection timestamp

**`src/content/extractor.ts`**
- `extractNextData()` — finds `<script id="__NEXT_DATA__">`, parses JSON, navigates to `dehydratedState.queries`
- `findFeedQuery()` — locates the query where `queryKey[0] === "feed"`
- `findItemQuery()` — locates item/detail queries (matches `"item"` or `"light"` in queryKey)

**`src/content/index.ts`**
- `detectPage()` — URL-based routing: hostname check, category detection (vehicles/realestate), page type (feed if no `/item/`, detail if `/item/`), subcategory extraction from path segments
- `processFeedPage()` — iterates ad-type arrays (vehicles: `commercial`, `private`, `platinum`, `boost`, `solo`; realestate: `private`, `commercial`, `yad1`), builds Listing objects, sends `LISTINGS_BATCH`
- `processDetailPage()` — extracts single item, populates `detailFields`, sends `LISTING_DETAIL`
- `buildMinimalListing()` — constructs Listing objects with basic field extraction (title, address, imageUrl, categoryFields). Uses inline helpers (`extractText`, `extractId`, `extractNested`, `toNumberOrNull`) that mirror the Python scraper's `g()` and `nested_text()` patterns
- Runs once on `document_idle` via `main()`

**`src/background/messages.ts`**
- `setupMessageListener()` — routes by message type to appropriate handlers
- `handleListingsBatch()` — calls `upsertListings`, writes collection log, updates badge
- `handleListingDetail()` — calls `upsertDetailListing`, writes collection log
- `updateBadge()` — shows new listing count for 3 seconds then clears

**`src/background/index.ts`**
- Calls `openDB()` then `setupMessageListener()` on service worker init

**`src/shared/browser.d.ts`**
- Minimal type declarations for `browser.runtime`, `browser.action`, `browser.downloads` — enough for the APIs we use without pulling in a full `@types/webextension-polyfill`

## Key Discoveries & Decisions

1. **Yad2 data structure:** The `__NEXT_DATA__` JSON lives at `props.pageProps.dehydratedState.queries[]`. Feed data is in the query where `queryKey[0] === "feed"`, with listings split across ad-type arrays (`commercial`, `private`, `platinum`, `boost`, `solo` for vehicles). Each listing has `token` as a unique identifier.

2. **Python scraper reference files** are in `context/` (`parser.py`, `models.py`, `sample_data.py`). These are gitignored (`context/*.py`) but available locally. They show the exact field paths: `manufacturer.text`, `model.id`, `vehicleDates.yearOfProduction`, `address.area.text`, `metaData.coverImage`, etc.

3. **Phase 1 content script does inline field extraction** rather than using the planned parser modules. The `buildMinimalListing()` function in `content/index.ts` handles both vehicle and realestate fields directly. When Phase 2 parsers are built, they should replace this inline logic.

4. **Some Phase 2 items were completed early** because they naturally belonged in the db/messages layer: price change detection (#14), badge updates (#16), collection_log tracking (#17). These are marked as done in `PLAN.md`.

## Pitfalls to Avoid

1. **`ExtensionMessage` union type and conditional inference:** Using `ExtensionMessage extends { type: "X"; payload: infer P } ? P : never` as a parameter type resolves to `never` because `ExtensionMessage` is a union and the conditional distributes incorrectly. Use `MessageType["payload"]` indexed access instead (e.g., `ListingsBatchMessage["payload"]`).

2. **Non-existent npm packages in scaffolding:** The initial `package.json` included `@anthropic-ai/eslint-config` and `esbuild-copy-static-files` which don't exist on npm. These were removed. The esbuild config handles static file copying with a custom plugin instead.

3. **IndexedDB transaction lifetime:** All reads and writes for a single upsert batch must happen within the same transaction. The current implementation uses `Promise.allSettled` for individual listing upserts within one transaction, then awaits `tx.oncomplete`. Be careful not to introduce async gaps that would cause the transaction to auto-commit.

4. **SPA navigation not yet handled:** The content script only runs once on `document_idle`. Yad2 is a Next.js SPA, so client-side navigation won't trigger re-extraction. The `content/observer.ts` (Phase 2, item 15) is critical for real-world use.

## Current State

- `npm run build` — passes (esbuild bundles all 4 entry points)
- `npx tsc --noEmit` — passes (zero type errors)
- Phase 1 items 1–8 complete, item 9 (manual smoke test) pending
- Extension is structurally loadable in Firefox via `npm run start` / `web-ext run`

## Next Steps (Phase 2)

Per `context/PLAN.md`, remaining Phase 2 items:

1. **`shared/sanitizer.ts`** (item 10) — Token validation (`/^[a-z0-9]+$/i`, max 50 chars), price validation (finite positive number), enum validation for category/adType, string truncation (2000 chars), HTML tag stripping. Listings failing validation should be logged and skipped.

2. **`content/parsers/common.ts`** (item 11) — `get(obj, ...keys)` safe nested accessor (replaces inline `extractNested`/`extractText`/`extractId` helpers currently in `content/index.ts`).

3. **`content/parsers/vehicles.ts`** (item 12) — `parseFeedListings(data, subcategory)` and `parseDetailListing(data, subcategory)` that return fully normalized `Listing[]` / `Listing`. Should replace the inline `buildMinimalListing` logic for vehicles.

4. **`content/parsers/realestate.ts`** (item 13) — Same pattern for real estate listings.

5. **`content/observer.ts`** (item 15) — MutationObserver on `<script id="__NEXT_DATA__">` for SPA navigation detection. Track `lastProcessedUrl` to avoid duplicates. Debounce at 300ms (`DEBOUNCE_MS` constant already defined).

After Phase 2, the parsers should be wired into `content/index.ts` to replace `buildMinimalListing()`, and the sanitizer should be called before sending messages to background.
