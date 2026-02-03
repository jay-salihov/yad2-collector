import type {
  ExportCsvMessage,
  ListingsBatchMessage,
  ListingDetailMessage,
} from "../shared/messages";
import {
  clearDatabase,
  getListings,
  getStats,
  upsertDetailListing,
  upsertListings,
  writeCollectionLog,
} from "./db";
import { CsvExporter } from "../export/csv";
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
          return handleExportCsv((message as ExportCsvMessage).payload);

        case "CLEAR_DATABASE":
          return handleClearDatabase();

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

async function handleExportCsv(
  payload: ExportCsvMessage["payload"],
): Promise<{ ok: boolean; error?: string }> {
  const { category } = payload;
  const exporter = new CsvExporter();

  try {
    if (category === "all") {
      // Export vehicles and realestate as separate files
      const [vehicles, realestate] = await Promise.all([
        getListings("vehicles"),
        getListings("realestate"),
      ]);

      if (vehicles.length > 0) {
        await downloadFile(
          exporter.generate(vehicles),
          `yad2_vehicles_${getDateString()}.csv`,
        );
      }
      if (realestate.length > 0) {
        await downloadFile(
          exporter.generate(realestate),
          `yad2_realestate_${getDateString()}.csv`,
        );
      }
    } else {
      const listings = await getListings(category);
      if (listings.length === 0) {
        console.info(`[yad2-collector] No listings to export for ${category}`);
        return { ok: true };
      }
      const blob = exporter.generate(listings);
      const filename = `yad2_${category}_${getDateString()}.csv`;
      await downloadFile(blob, filename);
    }

    return { ok: true };
  } catch (error) {
    console.error("[yad2-collector] Export failed:", error);
    return { ok: false, error: String(error) };
  }
}

async function downloadFile(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    await browser.downloads.download({
      url,
      filename,
      saveAs: true, // Prompt user for location
    });
  } finally {
    // Timeout needed for Firefox to start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function getDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


async function handleClearDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await clearDatabase();
    console.debug("[yad2-collector] Database cleared");
    return { ok: true };
  } catch (error) {
    console.error("[yad2-collector] Clear database failed:", error);
    return { ok: false, error: String(error) };
  }
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
