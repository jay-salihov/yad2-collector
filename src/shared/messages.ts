import type { Category, Listing, PageType } from "./types";

export interface ListingsBatchMessage {
  type: "LISTINGS_BATCH";
  payload: {
    listings: Listing[];
    url: string;
    category: Category;
    pageType: PageType;
  };
}

export interface ListingDetailMessage {
  type: "LISTING_DETAIL";
  payload: {
    listing: Listing;
    url: string;
    category: Category;
  };
}

export interface GetStatsMessage {
  type: "GET_STATS";
}

export interface ExportCsvMessage {
  type: "EXPORT_CSV";
  payload: {
    category: Category | "all";
  };
}

export type ContentMessage = ListingsBatchMessage | ListingDetailMessage;

export type PopupMessage = GetStatsMessage | ExportCsvMessage;

export type ExtensionMessage = ContentMessage | PopupMessage;
