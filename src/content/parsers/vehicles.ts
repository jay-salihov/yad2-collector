import type {
  AdType,
  DetailFields,
  Listing,
  VehicleFields,
} from "../../shared/types";
import { get, getId, getString, getText, toNumberOrNull } from "./common";

type RawObject = Record<string, unknown>;

const VEHICLE_AD_TYPES: AdType[] = [
  "commercial",
  "private",
  "platinum",
  "boost",
  "solo",
];

function buildVehicleFields(raw: RawObject): VehicleFields {
  return {
    manufacturer: getText(raw, "manufacturer"),
    manufacturerId: getId(raw, "manufacturer"),
    model: getText(raw, "model"),
    modelId: getId(raw, "model"),
    subModel: getText(raw, "subModel"),
    year: toNumberOrNull(get(raw, "vehicleDates", "yearOfProduction")),
    engineType: getText(raw, "engineType"),
    engineVolumeCc: getString(raw, "engineVolume"),
    gearBox: getText(raw, "gearBox"),
    hand: toNumberOrNull(get(raw, "handNumber")),
    km: toNumberOrNull(get(raw, "kilometers")),
    color: getText(raw, "color"),
  };
}

function buildTitle(raw: RawObject): string {
  const mfr = getText(raw, "manufacturer");
  const model = getText(raw, "model");
  const year = getString(raw, "vehicleDates", "yearOfProduction");
  return [mfr, model, year].filter(Boolean).join(" ");
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
    category: "vehicles",
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
    categoryFields: buildVehicleFields(raw),
    detailFields: null,
    rawData: raw,
  };
}

export function parseFeedListings(
  feedData: RawObject,
  subcategory: string,
): Listing[] {
  const listings: Listing[] = [];

  for (const adType of VEHICLE_AD_TYPES) {
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
    sellerName: getString(itemData, "customer", "name"),
    updatedAt: getString(itemData, "updatedAt"),
    additionalInfo: {},
    enrichedAt: new Date().toISOString(),
  };

  listing.detailFields = detailFields;
  return listing;
}
