# BUG-001: Phantom price changes reported on first collection

| Field           | Value                                      |
|-----------------|--------------------------------------------|
| **ID**          | BUG-001                                    |
| **Reported**    | 2026-02-03                                 |
| **Reporter**    | Manual tester                              |
| **Severity**    | High                                       |
| **Status**      | Open                                       |
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

## Possible Areas of Investigation

- **Upsert logic in background:** The price change detection during `upsert` may be comparing against stale or partially written records from the same batch, treating every insert as a change.
- **Duplicate message processing:** The `MutationObserver` or content script may be sending duplicate `LISTINGS_BATCH` messages, causing listings to be "upserted" against themselves and triggering false price change counts.
- **Stats reset:** The counters resetting to "--" and "never" after a few minutes suggests the stats query may be scoped to a time window, or the database/service worker may be getting torn down and losing state.
- **Debounce or observer issues:** The 300ms debounce on the `MutationObserver` may not be sufficient for SPA hydration, leading to multiple rapid extractions of the same data.

## Impact

The price change feature is a core value proposition of the extension. False positives on a fresh install undermine user trust in the data and make real price changes indistinguishable from noise.
