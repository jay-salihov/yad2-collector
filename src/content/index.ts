import { ALLOWED_HOST, URL_PATTERNS } from "../shared/constants";
import type {
  ContentMessage,
  ListingsBatchMessage,
  ListingDetailMessage,
} from "../shared/messages";
import { sanitizeListings, sanitizeListing } from "../shared/sanitizer";
import type { Category, PageType } from "../shared/types";
import {
  extractNextData,
  extractFromFetchResponse,
  findFeedQuery,
  findItemQuery,
} from "./extractor";
import type { NextDataQueries } from "./extractor";
import { setupNavigationObserver } from "./observer";
import {
  parseFeedListings as parseVehicleFeed,
  parseDetailListing as parseVehicleDetail,
} from "./parsers/vehicles";
import {
  parseFeedListings as parseRealestateFeed,
  parseDetailListing as parseRealestateDetail,
} from "./parsers/realestate";

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

function processFeedPage(page: PageInfo, data: NextDataQueries): void {
  const feedData = findFeedQuery(data);
  if (!feedData) {
    console.debug("[yad2-collector] No feed query found on this page");
    return;
  }

  const rawListings =
    page.category === "vehicles"
      ? parseVehicleFeed(feedData, page.subcategory)
      : parseRealestateFeed(feedData, page.subcategory);

  const listings = sanitizeListings(rawListings);

  if (listings.length === 0) {
    console.debug("[yad2-collector] No valid listings found on feed page");
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

function processDetailPage(page: PageInfo, data: NextDataQueries): void {
  const itemData = findItemQuery(data);
  if (!itemData) {
    console.debug("[yad2-collector] No item query found on detail page");
    return;
  }

  const rawListing =
    page.category === "vehicles"
      ? parseVehicleDetail(itemData, page.subcategory)
      : parseRealestateDetail(itemData, page.subcategory);

  if (!rawListing) {
    console.debug("[yad2-collector] Failed to parse detail listing");
    return;
  }

  const listing = sanitizeListing(rawListing);
  if (!listing) return;

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
    `[yad2-collector] Sent detail data for listing ${listing.token}`,
  );
}

function sendMessage(message: ContentMessage): void {
  browser.runtime.sendMessage(message).catch((err: unknown) => {
    console.warn("[yad2-collector] Failed to send message:", err);
  });
}

function processPageWithData(data: NextDataQueries): void {
  const page = detectPage(new URL(location.href));
  if (!page) return;

  console.debug(
    `[yad2-collector] Detected ${page.category}/${page.subcategory} ${page.pageType} page`,
  );

  if (page.pageType === "feed") {
    processFeedPage(page, data);
  } else {
    processDetailPage(page, data);
  }
}

function processCurrentPage(): void {
  const data = extractNextData();
  if (!data) return;
  processPageWithData(data);
}

const FETCH_MESSAGE_TYPE = "__yad2_collector_next_data__";

function setupFetchDataListener(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;

    const msg = event.data as { type?: string; payload?: unknown } | undefined;
    if (msg?.type !== FETCH_MESSAGE_TYPE) return;

    const data = extractFromFetchResponse(msg.payload);
    if (!data) return;

    console.debug(
      "[yad2-collector] Received intercepted /_next/data/ response",
    );
    processPageWithData(data);
  });
}

function main(): void {
  processCurrentPage();
  setupFetchDataListener();
  setupNavigationObserver(processCurrentPage);
}

main();
