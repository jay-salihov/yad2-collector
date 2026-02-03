# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Firefox WebExtension (Manifest V3) that passively collects Yad2 (Israeli real estate & vehicles marketplace) listing data as users browse. It stores listings in IndexedDB, tracks price changes, and exports to CSV. Written in TypeScript with no runtime dependencies — only browser APIs.

## Commands

```bash
npm run build        # Bundle TypeScript via esbuild → dist/
npm run watch        # Continuous build on file changes
npm run start        # Launch extension in Firefox via web-ext (opens yad2.co.il/vehicles/cars)
npm run test         # Run vitest suite (tests not yet implemented)
npm run test:watch   # Vitest in watch mode
npm run lint         # ESLint + TypeScript type check (eslint src/ && tsc --noEmit)
```

## Architecture

Four entry points bundled by esbuild into `dist/`:

**Content Script** (`src/content/`) — Injected into yad2.co.il/vehicles/* and /realestate/* pages at `document_idle`. Extracts listing data from Next.js `__NEXT_DATA__` script tag, parses it through category-specific parsers, sanitizes, and sends to background via `browser.runtime.sendMessage`.

**Background Service Worker** (`src/background/`) — Receives messages from content script. Upserts listings into IndexedDB, detects price changes and writes to price_history, logs collection activity. Handles export requests from popup by generating CSV blobs and triggering downloads.

**Popup** (`src/popup/`) — Extension toolbar popup (320px). Displays collection stats and provides CSV export buttons. Communicates with background via messages.

**Options** (`src/options/`) — Placeholder settings page for future filter rules UI.

### Data Flow

```
Yad2 page DOM → Content Script extracts __NEXT_DATA__ JSON
  → Parsers normalize listings (vehicles.ts / realestate.ts)
  → Sanitizer validates fields
  → Message (LISTINGS_BATCH or LISTING_DETAIL) → Background
  → Background upserts to IndexedDB (listings, price_history, collection_log stores)
  → Popup reads stats / triggers CSV export via messages
```

### SPA Navigation Handling

Yad2 is a Next.js SPA. A `MutationObserver` (`src/content/observer.ts`) watches the `__NEXT_DATA__` script element for changes, debounced at 300ms. Tracks `lastProcessedUrl` to avoid reprocessing.

### Message Protocol

Defined in `src/shared/messages.ts`. Discriminated union types:
- `LISTINGS_BATCH` — content → background: batch of feed page listings
- `LISTING_DETAIL` — content → background: single detail page listing
- `GET_STATS` — popup → background: request stats
- `EXPORT_CSV` — popup → background: trigger CSV download

### IndexedDB Schema

DB name: `yad2_collector`, version 1. Three object stores:
- `listings` (keyPath: `token`) — main listing data with price tracking
- `price_history` (autoIncrement) — indexed by `[token, recordedAt]`
- `collection_log` (autoIncrement) — indexed by `collectedAt`

## Key Shared Modules

- `src/shared/types.ts` — All interfaces: `Listing`, `VehicleFields`, `RealEstateFields`, `DetailFields`, `PriceRecord`, `CollectionLogEntry`
- `src/shared/constants.ts` — DB config, URL patterns, debounce timing
- `src/shared/sanitizer.ts` — Input validation (token format, price bounds, enum membership, string length/HTML stripping)
- `src/content/parsers/common.ts` — `get()` safe nested accessor (mirrors Python scraper's `g()` pattern)

## Conventions

- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), ES2022 target
- `browser.*` APIs (Firefox), not `chrome.*`
- `snake_case` for DB columns and CSV headers; `camelCase` for TypeScript code
- Console logs prefixed with `[yad2-collector]`
- CSV exports include UTF-8 BOM for Hebrew character support in Excel
- Parsers reference patterns from `context/` directory (Python scraper models/parser)

## Development Status

Phases 1-3 complete (core pipeline, parsers, UI/export). Phase 4 (testing & polish) is next — see `context/PLAN.md` for the full roadmap. Test directories exist under `tests/` but are placeholder `.gitkeep` files.

## Reference Materials

The `context/` directory contains Python scraper source and sample Yad2 API responses used as reference for building the parsers. These files are partially gitignored (`.py` files).
