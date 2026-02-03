# BUG-001: Phantom price changes reported on first collection

| Field           | Value                                      |
|-----------------|--------------------------------------------|
| **ID**          | BUG-001                                    |
| **Reported**    | 2026-02-03                                 |
| **Reporter**    | Manual tester                              |
| **Severity**    | High                                       |
| **Status**      | Resolved                                   |
| **Resolved**    | 2026-02-03                                 |
| **Component**   | Background / price change detection        |
| **Browser**     | Firefox Developer Edition                  |
| **Page**        | https://www.yad2.co.il/vehicles/cars       |

## Summary

On a fresh install with an empty database, the popup reports price changes immediately after the first collection. Since no prior prices exist, the price change counter should be 0. Additionally, stats become unstable on repeated checks and eventually reset entirely.

## Steps to Reproduce

1. Install the extension in Firefox Developer Edition (clean profile, no prior data).
2. Navigate to https://www.yad2.co.il/vehicles/cars.
3. Open the extension popup.
4. Observe the vehicle counter and price changes counter.
5. Wait a few seconds without interacting with the page, then reopen the popup.
6. Wait a few more minutes without interacting, then reopen the popup again.

## Expected Behavior

- **Step 4:** Vehicle counter shows the number of collected listings (e.g. 40). Price changes counter shows **0** (no prior data to compare against).
- **Step 5:** Counters remain stable or increase only if new data was actually collected from the page.
- **Step 6:** Counters remain stable; "last collected" date reflects the actual last collection time.

## Actual Behavior

- **Step 4:** Vehicle counter shows 40 (correct), but price changes shows **36** (incorrect — no prior prices exist).
- **Step 5:** Without any page interaction, counters jump to 58 vehicles and 52 price changes.
- **Step 6:** All counters reset to "--" and "last collected" resets to "never".

## Root Cause

Two confirmed root causes were identified:

1. **Price change stat miscounted initial observations:** `getStats()` counted all `price_history` records (which includes the initial price recorded for every new listing), instead of summing the per-listing `priceChangeCount` field. On first collection, every listing with a price created a `price_history` record, inflating the counter. For 40 vehicles with 36 having prices, 36 price "changes" were reported despite zero actual changes.

2. **Service worker message listener race condition:** The `onMessage` listener was registered after an async `await openDB()` call in the background script init. Per MV3 rules, event listeners must be registered synchronously at the top level. When the service worker was terminated and re-woken by a message (e.g., popup opening), the message arrived before the async `openDB()` completed, so no listener was registered yet. The message was dropped, the popup received no response, `updateStatsUI()` never ran, and the HTML defaults ("--", "never") remained.

## Fix

- `src/background/db.ts`: Changed `getTotalPriceChanges()` to iterate the `listings` store with a cursor and sum each listing's `priceChangeCount`, instead of counting all `price_history` records.
- `src/background/index.ts`: Moved `setupMessageListener()` to module-level synchronous execution before any async work. `openDB()` is now a non-blocking warm-up call since every DB function already calls `openDB()` internally.

## Note on Step 5

The 40-to-58 vehicle count increase without interaction could not be reproduced or root-caused in code review. It may be related to Yad2 SPA behavior (lazy loading additional results, URL parameter updates triggering re-extraction). This should be retested after the fix is deployed — if it persists, it should be filed as a separate bug.

## Impact

The price change feature is a core value proposition of the extension. False positives on a fresh install undermine user trust in the data and make real price changes indistinguishable from noise.
