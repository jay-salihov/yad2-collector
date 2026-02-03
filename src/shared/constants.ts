export const DB_NAME = "yad2_collector";
export const DB_VERSION = 1;

export const STORES = {
  LISTINGS: "listings",
  PRICE_HISTORY: "price_history",
  COLLECTION_LOG: "collection_log",
} as const;

export const URL_PATTERNS = {
  VEHICLES: /^\/vehicles\//,
  REALESTATE: /^\/realestate\//,
  DETAIL: /\/item\//,
} as const;

export const ALLOWED_HOST = "www.yad2.co.il";

export const DEBOUNCE_MS = 300;
