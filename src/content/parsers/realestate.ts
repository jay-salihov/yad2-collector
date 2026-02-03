import type {
  AdType,
  DetailFields,
  Listing,
  RealEstateFields,
} from "../../shared/types";
import { get, getString, getText, toNumberOrNull } from "./common";

type RawObject = Record<string, unknown>;

const REALESTATE_AD_TYPES: AdType[] = ["private", "commercial", "yad1"];

function buildRealEstateFields(raw: RawObject): RealEstateFields {
  return {
    propertyType: getText(raw, "propertyType"),
    rooms: toNumberOrNull(get(raw, "rooms")),
    squareMeters: toNumberOrNull(get(raw, "squareMeter")),
    squareMetersBuild: toNumberOrNull(get(raw, "squareMeterBuild")),
    floor: toNumberOrNull(get(raw, "floor", "value")),
    totalFloors: toNumberOrNull(get(raw, "totalFloors")),
    condition: getText(raw, "condition"),
    neighborhood: getString(raw, "address", "neighborhood", "text"),
    city: getString(raw, "address", "city", "text"),
  };
}

function buildTitle(raw: RawObject): string {
  const propertyType = getText(raw, "propertyType");
  const city = getString(raw, "address", "city", "text");
  return [propertyType, city].filter(Boolean).join(", ");
}

function buildListing(
  raw: RawObject,
  adType: AdType,
  subcategory: string,
): Listing {
  const token = getString(raw, "token");
  const priceRaw = get(raw, "price");
  const price =
    priceRaw !== null && priceRaw !== undefined
      ? toNumberOrNull(priceRaw)
      : null;

  const address =
    getString(raw, "address", "area", "text") ||
    getString(raw, "address", "city", "text");

  const imageUrl =
    getString(raw, "metaData", "coverImage") ||
    getString(raw, "coverImage");

  const now = new Date().toISOString();

  return {
    token,
    category: "realestate",
    subcategory,
    adType,
    pageType: "feed",
    currentPrice: price,
    firstPrice: price,
    priceChangeCount: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    title: buildTitle(raw),
    address,
    imageUrl,
    categoryFields: buildRealEstateFields(raw),
    detailFields: null,
    rawData: raw,
  };
}

export function parseFeedListings(
  feedData: RawObject,
  subcategory: string,
): Listing[] {
  const listings: Listing[] = [];

  for (const adType of REALESTATE_AD_TYPES) {
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
      listings.push(buildListing(item as RawObject, adType, subcategory));
    }
  }

  return listings;
}

export function parseDetailListing(
  itemData: RawObject,
  subcategory: string,
): Listing | null {
  const token = getString(itemData, "token");
  if (!token) return null;

  const adType = (itemData["adType"] as AdType | undefined) ?? "private";

  const listing = buildListing(itemData, adType, subcategory);
  listing.pageType = "detail";

  const detailFields: DetailFields = {
    description: getString(itemData, "description"),
    updatedAt: getString(itemData, "updatedAt"),
    additionalInfo: {},
    enrichedAt: new Date().toISOString(),
  };

  listing.detailFields = detailFields;
  return listing;
}
