import type { AdType, Category, Listing } from "./types";

const TOKEN_RE = /^[a-z0-9]+$/i;
const MAX_TOKEN_LENGTH = 50;
const MAX_STRING_LENGTH = 2000;
const HTML_TAG_RE = /<[^>]*>/g;

const VALID_CATEGORIES: ReadonlySet<string> = new Set<Category>([
  "vehicles",
  "realestate",
]);

const VALID_AD_TYPES: ReadonlySet<string> = new Set<AdType>([
  "private",
  "commercial",
  "agency",
  "platinum",
  "boost",
  "solo",
  "yad1",
]);

export function isValidToken(token: string): boolean {
  return (
    typeof token === "string" &&
    token.length > 0 &&
    token.length <= MAX_TOKEN_LENGTH &&
    TOKEN_RE.test(token)
  );
}

export function isValidPrice(price: unknown): price is number {
  return (
    typeof price === "number" &&
    Number.isFinite(price) &&
    price > 0
  );
}

export function isValidCategory(value: string): value is Category {
  return VALID_CATEGORIES.has(value);
}

export function isValidAdType(value: string): value is AdType {
  return VALID_AD_TYPES.has(value);
}

export function sanitizeString(value: string): string {
  if (typeof value !== "string") return "";
  const stripped = value.replace(HTML_TAG_RE, "");
  return stripped.length > MAX_STRING_LENGTH
    ? stripped.slice(0, MAX_STRING_LENGTH)
    : stripped;
}

export function sanitizeListing(listing: Listing): Listing | null {
  if (!isValidToken(listing.token)) {
    console.warn(
      `[yad2-collector] Skipping listing with invalid token: "${listing.token}"`,
    );
    return null;
  }

  if (!isValidCategory(listing.category)) {
    console.warn(
      `[yad2-collector] Skipping listing ${listing.token}: invalid category "${listing.category}"`,
    );
    return null;
  }

  if (!isValidAdType(listing.adType)) {
    console.warn(
      `[yad2-collector] Skipping listing ${listing.token}: invalid adType "${listing.adType}"`,
    );
    return null;
  }

  const price = listing.currentPrice;
  const sanitizedPrice =
    price === null ? null : isValidPrice(price) ? price : null;

  return {
    ...listing,
    currentPrice: sanitizedPrice,
    firstPrice: sanitizedPrice,
    title: sanitizeString(listing.title),
    address: sanitizeString(listing.address),
    imageUrl: sanitizeString(listing.imageUrl),
    subcategory: sanitizeString(listing.subcategory),
  };
}

export function sanitizeListings(listings: Listing[]): Listing[] {
  const result: Listing[] = [];
  for (const listing of listings) {
    const sanitized = sanitizeListing(listing);
    if (sanitized) {
      result.push(sanitized);
    }
  }
  return result;
}
