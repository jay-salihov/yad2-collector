import { ALLOWED_HOST, URL_PATTERNS } from "../shared/constants";
import type {
  ContentMessage,
  ListingsBatchMessage,
  ListingDetailMessage,
} from "../shared/messages";
import type { AdType, Category, Listing, PageType } from "../shared/types";
import { extractNextData, findFeedQuery, findItemQuery } from "./extractor";

const VEHICLE_AD_TYPES: AdType[] = [
  "commercial",
  "private",
  "platinum",
  "boost",
  "solo",
];
const REALESTATE_AD_TYPES: AdType[] = ["private", "commercial", "yad1"];

interface PageInfo {
  category: Category;
  subcategory: string;
  pageType: PageType;
}

function detectPage(url: URL): PageInfo | null {
  if (url.hostname !== ALLOWED_HOST) return null;

  const path = url.pathname;
  let category: Category;

  if (URL_PATTERNS.VEHICLES.test(path)) {
    category = "vehicles";
  } else if (URL_PATTERNS.REALESTATE.test(path)) {
    category = "realestate";
  } else {
    return null;
  }

  const pageType: PageType = URL_PATTERNS.DETAIL.test(path)
    ? "detail"
    : "feed";

  // Extract subcategory from path: /vehicles/cars -> "cars", /realestate/rent -> "rent"
  const segments = path.split("/").filter(Boolean);
  const subcategory = segments[1] ?? "";

  return { category, subcategory, pageType };
}

function buildMinimalListing(
  raw: Record<string, unknown>,
  adType: AdType,
  category: Category,
  subcategory: string,
  pageType: PageType,
): Listing {
  const token = String(raw["token"] ?? "");
  const priceRaw = raw["price"];
  const price =
    priceRaw !== null && priceRaw !== undefined
      ? Number(priceRaw) || null
      : null;

  // Build a basic title from available data
  let title = "";
  if (category === "vehicles") {
    const mfr = extractText(raw["manufacturer"]);
    const model = extractText(raw["model"]);
    const year = extractNested(raw, "vehicleDates", "yearOfProduction");
    title = [mfr, model, year].filter(Boolean).join(" ");
  } else {
    const propertyType = extractText(raw["propertyType"]);
    const city = extractNested(raw, "address", "city", "text");
    title = [propertyType, city].filter(Boolean).join(", ");
  }

  const address =
    extractNested(raw, "address", "area", "text") ??
    extractNested(raw, "address", "city", "text") ??
    "";

  const imageUrl =
    extractNested(raw, "metaData", "coverImage") ??
    extractNested(raw, "coverImage") ??
    "";

  // Placeholder categoryFields — parsers (Phase 2) will provide full normalization
  const categoryFields =
    category === "vehicles"
      ? {
          manufacturer: extractText(raw["manufacturer"]),
          manufacturerId: extractId(raw["manufacturer"]),
          model: extractText(raw["model"]),
          modelId: extractId(raw["model"]),
          subModel: extractText(raw["subModel"]),
          year: toNumberOrNull(
            extractNested(raw, "vehicleDates", "yearOfProduction"),
          ),
          engineType: extractText(raw["engineType"]),
          engineVolumeCc: String(raw["engineVolume"] ?? ""),
          gearBox: extractText(raw["gearBox"]),
          hand: toNumberOrNull(raw["handNumber"]),
          km: toNumberOrNull(raw["kilometers"]),
          color: extractText(raw["color"]),
        }
      : {
          propertyType: extractText(raw["propertyType"]),
          rooms: toNumberOrNull(raw["rooms"]),
          squareMeters: toNumberOrNull(raw["squareMeter"]),
          squareMetersBuild: toNumberOrNull(raw["squareMeterBuild"]),
          floor: toNumberOrNull(extractNested(raw, "floor", "value")),
          totalFloors: toNumberOrNull(raw["totalFloors"]),
          condition: extractText(raw["condition"]),
          neighborhood: extractNested(raw, "address", "neighborhood", "text") ?? "",
          city: extractNested(raw, "address", "city", "text") ?? "",
        };

  const now = new Date().toISOString();

  return {
    token,
    category,
    subcategory,
    adType,
    pageType,
    currentPrice: price,
    firstPrice: price,
    priceChangeCount: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    title,
    address,
    imageUrl,
    categoryFields,
    detailFields: null,
    rawData: raw as Record<string, unknown>,
  };
}

function extractText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    return String((val as Record<string, unknown>)["text"] ?? "");
  }
  return String(val);
}

function extractId(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    return String((val as Record<string, unknown>)["id"] ?? "");
  }
  return "";
}

function extractNested(obj: unknown, ...keys: string[]): string | null {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (current === null || current === undefined) return null;
  return String(current);
}

function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function processFeedPage(page: PageInfo): void {
  const data = extractNextData();
  if (!data) return;

  const feedData = findFeedQuery(data);
  if (!feedData) {
    console.debug("[yad2-collector] No feed query found on this page");
    return;
  }

  const adTypes =
    page.category === "vehicles" ? VEHICLE_AD_TYPES : REALESTATE_AD_TYPES;

  const listings: Listing[] = [];

  for (const adType of adTypes) {
    const items = feedData[adType];
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (
        typeof item !== "object" ||
        item === null ||
        !("token" in item) ||
        !item.token
      ) {
        continue;
      }

      const raw = item as Record<string, unknown>;
      listings.push(
        buildMinimalListing(
          raw,
          adType,
          page.category,
          page.subcategory,
          "feed",
        ),
      );
    }
  }

  if (listings.length === 0) {
    console.debug("[yad2-collector] No listings found on feed page");
    return;
  }

  const message: ListingsBatchMessage = {
    type: "LISTINGS_BATCH",
    payload: {
      listings,
      url: location.href,
      category: page.category,
      pageType: "feed",
    },
  };

  sendMessage(message);
  console.debug(
    `[yad2-collector] Sent ${listings.length} listings from feed page`,
  );
}

function processDetailPage(page: PageInfo): void {
  const data = extractNextData();
  if (!data) return;

  const itemData = findItemQuery(data);
  if (!itemData) {
    console.debug("[yad2-collector] No item query found on detail page");
    return;
  }

  const token = String(itemData["token"] ?? "");
  if (!token) {
    console.debug("[yad2-collector] No token found in item data");
    return;
  }

  const listing = buildMinimalListing(
    itemData,
    (itemData["adType"] as AdType) ?? "private",
    page.category,
    page.subcategory,
    "detail",
  );

  // Extract detail-specific fields
  listing.detailFields = {
    description: String(itemData["description"] ?? ""),
    sellerName: extractNested(itemData, "customer", "name") ?? "",
    updatedAt: String(itemData["updatedAt"] ?? ""),
    additionalInfo: {},
    enrichedAt: new Date().toISOString(),
  };

  const message: ListingDetailMessage = {
    type: "LISTING_DETAIL",
    payload: {
      listing,
      url: location.href,
      category: page.category,
    },
  };

  sendMessage(message);
  console.debug(
    `[yad2-collector] Sent detail data for listing ${token}`,
  );
}

function sendMessage(message: ContentMessage): void {
  browser.runtime.sendMessage(message).catch((err: unknown) => {
    console.warn("[yad2-collector] Failed to send message:", err);
  });
}

function main(): void {
  const page = detectPage(new URL(location.href));
  if (!page) return;

  console.debug(
    `[yad2-collector] Detected ${page.category}/${page.subcategory} ${page.pageType} page`,
  );

  if (page.pageType === "feed") {
    processFeedPage(page);
  } else {
    processDetailPage(page);
  }
}

main();
