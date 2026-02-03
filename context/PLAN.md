# Yad2 Browser Extension — Implementation Plan

## Overview

A Firefox WebExtension (Manifest V3) that passively collects Yad2 listing data as the user browses, stores it in IndexedDB, tracks price changes, and exports to CSV. Written in TypeScript. Separate repository from the Python scraper.

**Decisions:** Separate repo | TypeScript | Collect from both feed and detail pages

---

## Project Structure

```
yad2-collector/                     # New standalone repository
├── package.json                    # Dependencies, scripts
├── tsconfig.json                   # TypeScript configuration
├── manifest.json                   # MV3 manifest (points to dist/)
├── web-ext-config.mjs              # web-ext tool configuration
├── src/
│   ├── background/
│   │   ├── index.ts                # Service worker entry
│   │   ├── db.ts                   # IndexedDB operations (open, upsert, query, export)
│   │   └── messages.ts             # Message handler (content script → background)
│   ├── content/
│   │   ├── index.ts                # Entry: URL check → extract → send
│   │   ├── extractor.ts            # __NEXT_DATA__ extraction from DOM
│   │   ├── parsers/
│   │   │   ├── vehicles.ts         # Vehicle listing normalizer (feed + detail)
│   │   │   ├── realestate.ts       # Real estate listing normalizer (feed + detail)
│   │   │   └── common.ts           # Safe nested access, shared parser utils
│   │   └── observer.ts             # MutationObserver for SPA navigation
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts                # Stats, recent listings, export trigger
│   │   └── popup.css
│   ├── options/
│   │   ├── options.html            # Placeholder for future filter rules UI
│   │   ├── options.ts
│   │   └── options.css
│   ├── export/
│   │   ├── csv.ts                  # CSV generation with UTF-8 BOM
│   │   └── base.ts                 # Exporter interface (future: Notion, Airtable)
│   └── shared/
│       ├── constants.ts            # URL patterns, DB name, version
│       ├── sanitizer.ts            # Input validation & sanitization
│       ├── types.ts                # All TypeScript interfaces and types
│       └── messages.ts             # Message type definitions (content ↔ background)
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
├── tests/
│   ├── parsers/
│   ├── db/
│   ├── sanitizer/
│   └── fixtures/                   # Sample __NEXT_DATA__ blobs (feed + detail pages)
└── dist/                           # Build output (gitignored)
```

---

## Build & Tooling

```json
// tsconfig.json — key settings
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "noUncheckedIndexedAccess": true
  }
}
```

**Build tool:** esbuild (fast, minimal config, handles TS → JS bundling)
- Bundles `src/background/index.ts` → `dist/background.js`
- Bundles `src/content/index.ts` → `dist/content.js`
- Bundles `src/popup/popup.ts` → `dist/popup.js`
- Copies HTML/CSS/icons to `dist/`

**Dev workflow:**
- `npm run build` — one-shot build
- `npm run watch` — rebuild on changes
- `npm run start` — `web-ext run` to load in Firefox with auto-reload
- `npm run test` — vitest
- `npm run lint` — eslint + tsc --noEmit

---

## Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Yad2 Listing Collector",
  "version": "0.1.0",
  "permissions": ["storage", "downloads"],
  "host_permissions": ["https://www.yad2.co.il/*"],
  "background": {
    "scripts": ["dist/background.js"],
    "type": "module"
  },
  "content_scripts": [{
    "matches": [
      "https://www.yad2.co.il/vehicles/*",
      "https://www.yad2.co.il/realestate/*"
    ],
    "js": ["dist/content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "dist/popup.html",
    "default_icon": { "48": "icons/icon-48.png", "96": "icons/icon-96.png" }
  },
  "options_ui": {
    "page": "dist/options.html"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

- `content_scripts.matches` restricts to vehicle/realestate pages only
- No `"<all_urls>"` — minimal permissions
- Strict CSP — no inline scripts, no eval

---

## TypeScript Types (`shared/types.ts`)

```typescript
type Category = "vehicles" | "realestate";
type PageType = "feed" | "detail";
type AdType = "private" | "commercial" | "platinum" | "boost" | "solo" | "yad1";

interface Listing {
  token: string;                    // Primary key
  category: Category;
  subcategory: string;              // "cars", "rent", "forsale", etc.
  adType: AdType;
  pageType: PageType;               // Where this data came from
  currentPrice: number | null;
  firstPrice: number | null;
  priceChangeCount: number;
  firstSeenAt: string;              // ISO timestamp
  lastSeenAt: string;
  title: string;                    // "Citroën C3 2021" or "3 rooms, Ramat Gan"
  address: string;
  imageUrl: string;
  categoryFields: VehicleFields | RealEstateFields;
  detailFields: DetailFields | null; // Enriched from detail page (null if only seen on feed)
  rawData: Record<string, unknown>;  // Full raw JSON preserved
}

interface VehicleFields {
  manufacturer: string;
  manufacturerId: string;
  model: string;
  modelId: string;
  subModel: string;
  year: number | null;
  engineType: string;
  engineVolumeCc: string;
  gearBox: string;
  hand: number | null;
  km: number | null;
  color: string;
}

interface RealEstateFields {
  propertyType: string;
  rooms: number | null;
  squareMeters: number | null;
  squareMetersBuild: number | null;
  floor: number | null;
  totalFloors: number | null;
  condition: string;
  neighborhood: string;
  city: string;
}

interface DetailFields {
  description: string;              // Full listing description text
  sellerName: string;
  updatedAt: string;                // When seller last updated the listing
  additionalInfo: Record<string, string>;  // Extra key-value pairs from detail page
  enrichedAt: string;               // When we collected the detail data
}

interface PriceRecord {
  id?: number;                      // Auto-increment
  token: string;
  price: number;
  recordedAt: string;
}

interface CollectionLogEntry {
  id?: number;
  url: string;
  category: Category;
  pageType: PageType;
  listingsFound: number;
  newListings: number;
  priceChanges: number;
  collectedAt: string;
}
```

---

## Storage: IndexedDB

**Why IndexedDB over SQLite WASM:**
- Native to browser — zero dependencies, no WASM bundle
- Async API — won't block UI thread
- Well-suited for frequent writes, occasional reads/exports
- Keeps extension small
- Future: can generate .sqlite export via sql.js if needed

### Schema

**DB name:** `yad2_collector` | **Version:** 1

**`listings` store** (keyPath: `token`)
Indexes: `category`, `lastSeenAt`, `currentPrice`, `[category, lastSeenAt]`

**`price_history` store** (autoIncrement)
Indexes: `token`, `[token, recordedAt]`

**`collection_log` store** (autoIncrement)
Indexes: `collectedAt`

---

## Data Flow

### Feed pages (search results)
```
Content Script → detects feed page from URL (no /item/ segment)
  → extracts __NEXT_DATA__ → finds feed query (queryKey[0] == "feed")
  → iterates ad-type arrays (commercial/private/platinum/boost/solo for vehicles;
     private/agency/yad1 for realestate)
  → normalizes each listing → sends batch to background
```

### Detail pages (individual listings)
```
Content Script → detects detail page from URL (contains /item/)
  → extracts __NEXT_DATA__ → finds item query
  → extracts single listing with enriched fields (description, seller info)
  → sends to background as enrichment update
```

### Background processing
```
Background receives message →
  For feed data (type: "LISTINGS_BATCH"):
    → For each listing: upsert into DB
    → If new: insert with firstSeenAt, firstPrice
    → If existing: update lastSeenAt; if price changed → update + write price_history
  For detail data (type: "LISTING_DETAIL"):
    → Find existing listing by token
    → Merge detailFields into existing record
    → If listing doesn't exist yet, create it with detail data
  → Write collection_log entry
  → Update badge count
```

---

## Content Script Design

### Page type detection (`content/index.ts`)
```
URL: /vehicles/cars?...          → category=vehicles, pageType=feed
URL: /vehicles/cars/item/abc123  → category=vehicles, pageType=detail
URL: /realestate/rent?...        → category=realestate, pageType=feed
URL: /realestate/item/xyz456     → category=realestate, pageType=detail
```

Additional runtime URL check as defense-in-depth (beyond manifest `matches`):
- Verify `location.hostname === "www.yad2.co.il"`
- Verify pathname starts with `/vehicles/` or `/realestate/`
- If check fails → do nothing, return immediately

### __NEXT_DATA__ extraction (`content/extractor.ts`)
- `document.querySelector('script#__NEXT_DATA__')`
- `JSON.parse()` in try/catch
- Navigate to `props.pageProps.dehydratedState.queries`
- For feed pages: find query where `queryKey[0] === "feed"`
- For detail pages: find query where `queryKey` relates to individual item

### SPA navigation (`content/observer.ts`)
Yad2 is Next.js — client-side navigation doesn't trigger full page reloads.

Strategy:
1. Initial extraction on `document_idle`
2. `MutationObserver` on `<script id="__NEXT_DATA__">` characterData/childList changes
3. Track `lastProcessedUrl` to avoid duplicate processing
4. Debounce (300ms) to let the DOM settle after navigation

### Parsers
- `common.ts`: `get(obj, ...keys)` safe nested accessor (mirrors Python scraper's `g()`)
- `vehicles.ts`: normalizes vehicle listings from both feed arrays and detail page data
- `realestate.ts`: normalizes real estate listings from both feed arrays and detail page data
- Each parser has `parseFeedListings(data, subcategory)` and `parseDetailListing(data, subcategory)`

---

## Security

1. **Input sanitization** (`shared/sanitizer.ts`):
   - `token`: must match `/^[a-z0-9]+$/i`, max 50 chars
   - `price`: must be finite positive number, reject NaN/Infinity/negative
   - `category`/`adType`: must be known enum value
   - All strings: truncate to 2000 chars, strip HTML tags
   - Listings failing validation are logged and skipped

2. **No dangerous APIs**: no `eval()`, no `new Function()`, no `innerHTML` with raw data

3. **CSP**: `script-src 'self'` in manifest

4. **Minimal permissions**: only yad2.co.il host, storage, downloads

5. **Defense-in-depth URL check**: content script re-validates URL at runtime

6. **Structured clone**: message passing between content/background uses structured clone (safe by default)

---

## Memory Management

1. Content script extracts → sends message → discards. No growing arrays.
2. Feed page batches: ~20-40 listings per message (one page of results)
3. Detail pages: single listing per message
4. Background writes each batch in one IndexedDB transaction, then releases
5. CSV export uses IndexedDB cursor iteration — never loads all records at once
6. No in-memory DB mirror in background script

---

## Popup UI

```
┌──────────────────────────────┐
│  Yad2 Collector              │
│                              │
│  Collection Stats            │
│  ────────────────            │
│  Vehicles:      342          │
│  Real Estate:   187          │
│  Total:         529          │
│                              │
│  Price Changes:  23          │
│  Last collected: 2 min ago   │
│                              │
│  [Export Vehicles CSV]       │
│  [Export Real Estate CSV]    │
│  [Export All CSV]            │
│                              │
│  Settings                    │
└──────────────────────────────┘
```

---

## CSV Export

**Vehicles columns:**
```
token, ad_type, manufacturer, model, sub_model, year, engine_type, hand, km,
price, first_price, price_changes, area, address, description, image_url, first_seen, last_seen
```

**Real Estate columns:**
```
token, ad_type, property_type, rooms, sqm, floor, condition,
price, first_price, price_changes, city, neighborhood, address, description, image_url, first_seen, last_seen
```

- UTF-8 with BOM (`utf-8-sig` equivalent) for Hebrew in Excel
- Export flow: popup button → message to background → cursor-based read → build CSV string → `browser.downloads.download()` with Blob URL

---

## Implementation Phases

### Phase 1 — Project Setup & Foundation ✅
1. ✅ Init repo: `package.json`, `tsconfig.json`, esbuild config, `manifest.json`
2. ✅ `shared/types.ts` — all interfaces and type definitions
3. ✅ `shared/constants.ts` — URL patterns, DB config, field lists
4. ✅ `background/db.ts` — IndexedDB open/upgrade, stores, indexes, upsert, stats
5. ✅ `content/extractor.ts` — __NEXT_DATA__ extraction from DOM
6. ✅ `content/index.ts` — URL detection, page type routing, message dispatch
7. ✅ `background/messages.ts` — message listener, routing
8. ✅ `background/index.ts` — service worker wiring
9. End-to-end smoke test: browse a Yad2 feed page → see data in IndexedDB via devtools

### Phase 2 — Parsers, Sanitization & Data Collection ✅
10. ✅ `shared/sanitizer.ts` — field validation functions
11. ✅ `content/parsers/common.ts` — `get()` helper, shared utilities
12. ✅ `content/parsers/vehicles.ts` — feed + detail page normalizers
13. ✅ `content/parsers/realestate.ts` — feed + detail page normalizers
14. ✅ Price change detection + `price_history` writes in `background/db.ts`
15. ✅ `content/observer.ts` — MutationObserver for SPA navigation
16. ✅ Badge count updates
17. ✅ `collection_log` tracking

### Phase 3 — UI & Export
18. `popup/popup.html` + `popup.ts` + `popup.css` — stats and controls
19. `export/base.ts` — exporter interface
20. `export/csv.ts` — CSV generation with BOM encoding
21. Wire export buttons → background → download
22. `options/options.html` + `options.ts` — placeholder settings page

### Phase 4 — Testing & Polish
23. Unit tests: parsers (with fixture data from real pages)
24. Unit tests: sanitizer, DB operations, CSV export
25. Error handling and edge case logging
26. Manual end-to-end testing with real Yad2 browsing

---

## Verification Plan

1. `npm run build` succeeds with no TS errors
2. `npm run lint` passes
3. `npm run test` — all unit tests pass
4. Load in Firefox via `web-ext run`:
   - Browse to yad2.co.il/vehicles/cars → verify listings appear in IndexedDB (devtools → Storage → IndexedDB)
   - Browse to a detail page → verify `detailFields` is populated
   - Click popup → verify stats are correct
   - Click Export CSV → verify file downloads with correct Hebrew content
   - Navigate within Yad2 (SPA) → verify new pages are collected
   - Browse to non-Yad2 site → verify extension does nothing
   - Browse to yad2.co.il homepage → verify extension does nothing (only /vehicles/ and /realestate/)

---

## Future Extensibility

**Export targets (Notion, Obsidian, Airtable):**
- `export/base.ts` defines `Exporter` interface: `{ name, extension, generate(listings): Blob }`
- New formats implement that interface in separate files
- Popup gets a format dropdown

**Filter rules:**
- New `filter_rules` IndexedDB store
- Options page visual rule builder (field → operator → value → action)
- Background applies rules on ingest or export
- `categoryFields` typed structure makes field-based filtering straightforward
