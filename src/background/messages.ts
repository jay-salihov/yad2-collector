import type {
  ListingsBatchMessage,
  ListingDetailMessage,
} from "../shared/messages";
import {
  getStats,
  upsertDetailListing,
  upsertListings,
  writeCollectionLog,
} from "./db";

export function setupMessageListener(): void {
  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: browser.runtime.MessageSender,
    ): Promise<unknown> | undefined => {
      const msg = message as { type: string };

      switch (msg.type) {
        case "LISTINGS_BATCH":
          return handleListingsBatch(
            (message as ListingsBatchMessage).payload,
          );

        case "LISTING_DETAIL":
          return handleListingDetail(
            (message as ListingDetailMessage).payload,
          );

        case "GET_STATS":
          return getStats();

        case "EXPORT_CSV":
          // Phase 3
          return Promise.resolve({ error: "Export not yet implemented" });

        default:
          console.warn("[yad2-collector] Unknown message type:", msg);
          return undefined;
      }
    },
  );
}

async function handleListingsBatch(
  payload: ListingsBatchMessage["payload"],
): Promise<{ newListings: number; priceChanges: number }> {
  const { listings, url, category, pageType } = payload;

  const result = await upsertListings(listings);

  await writeCollectionLog({
    url,
    category,
    pageType,
    listingsFound: listings.length,
    newListings: result.newListings,
    priceChanges: result.priceChanges,
    collectedAt: new Date().toISOString(),
  });

  updateBadge(result.newListings);

  console.debug(
    `[yad2-collector] Batch: ${listings.length} listings, ${result.newListings} new, ${result.priceChanges} price changes`,
  );

  return result;
}

async function handleListingDetail(
  payload: ListingDetailMessage["payload"],
): Promise<{ ok: boolean }> {
  const { listing, url, category } = payload;

  await upsertDetailListing(listing);

  await writeCollectionLog({
    url,
    category,
    pageType: "detail",
    listingsFound: 1,
    newListings: 0,
    priceChanges: 0,
    collectedAt: new Date().toISOString(),
  });

  console.debug(
    `[yad2-collector] Detail enrichment for ${listing.token}`,
  );

  return { ok: true };
}

function updateBadge(newCount: number): void {
  if (newCount > 0) {
    browser.action.setBadgeText({ text: String(newCount) }).catch(() => {});
    browser.action.setBadgeBackgroundColor({ color: "#4285F4" }).catch(() => {});

    // Clear badge after 3 seconds
    setTimeout(() => {
      browser.action.setBadgeText({ text: "" }).catch(() => {});
    }, 3000);
  }
}
