import { describe, it, expect } from "vitest";
import {
  parseFeedListings,
  parseDetailListing,
} from "../../src/content/parsers/realestate";
import type { RealEstateFields } from "../../src/shared/types";

type RawObject = Record<string, unknown>;

function makeRealEstateItem(overrides: RawObject = {}): RawObject {
  return {
    token: "re123",
    price: 2500000,
    propertyType: { id: 1, text: "Apartment" },
    rooms: 4,
    squareMeter: 100,
    squareMeterBuild: 90,
    floor: { value: 3 },
    totalFloors: 8,
    condition: { id: 1, text: "Renovated" },
    address: {
      area: { text: "Center" },
      city: { text: "Tel Aviv" },
      neighborhood: { text: "Florentin" },
    },
    metaData: { coverImage: "https://img.yad2.co.il/cover.jpg" },
    ...overrides,
  };
}

describe("parseFeedListings", () => {
  it("parses listings from multiple ad types", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem({ token: "p1" })],
      agency: [makeRealEstateItem({ token: "a1" })],
      platinum: [makeRealEstateItem({ token: "pl1" })],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty feed", () => {
    expect(parseFeedListings({}, "forsale")).toHaveLength(0);
  });

  it("skips items without token", () => {
    const feedData: RawObject = {
      private: [{ price: 100 }, makeRealEstateItem({ token: "valid" })],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result).toHaveLength(1);
  });

  it("sets category to 'realestate'", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem()],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result[0]!.category).toBe("realestate");
  });

  it("sets pageType to 'feed'", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem()],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result[0]!.pageType).toBe("feed");
  });
});

describe("parseDetailListing", () => {
  it("produces listing with detailFields", () => {
    const item = makeRealEstateItem({
      description: "Nice apartment",
      updatedAt: "2024-06-01",
    });
    const result = parseDetailListing(item, "forsale");
    expect(result).not.toBeNull();
    expect(result!.pageType).toBe("detail");
    expect(result!.detailFields!.description).toBe("Nice apartment");
  });

  it("returns null for missing token", () => {
    const item = makeRealEstateItem({ token: "" });
    expect(parseDetailListing(item, "forsale")).toBeNull();
  });

  it("defaults adType to 'private'", () => {
    const item = makeRealEstateItem();
    delete item.adType;
    const result = parseDetailListing(item, "forsale");
    expect(result!.adType).toBe("private");
  });
});

describe("real estate field extraction", () => {
  it("extracts all real estate fields correctly", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem()],
    };
    const result = parseFeedListings(feedData, "forsale");
    const fields = result[0]!.categoryFields as RealEstateFields;
    expect(fields.propertyType).toBe("Apartment");
    expect(fields.rooms).toBe(4);
    expect(fields.squareMeters).toBe(100);
    expect(fields.squareMetersBuild).toBe(90);
    expect(fields.floor).toBe(3);
    expect(fields.totalFloors).toBe(8);
    expect(fields.condition).toBe("Renovated");
    expect(fields.city).toBe("Tel Aviv");
    expect(fields.neighborhood).toBe("Florentin");
  });

  it("builds title from propertyType and city", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem()],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result[0]!.title).toBe("Apartment, Tel Aviv");
  });

  it("extracts address from area text", () => {
    const feedData: RawObject = {
      private: [makeRealEstateItem()],
    };
    const result = parseFeedListings(feedData, "forsale");
    expect(result[0]!.address).toBe("Center");
  });

  it("falls back to city when area is missing", () => {
    const item = makeRealEstateItem({
      address: { city: { text: "Haifa" } },
    });
    const feedData: RawObject = { private: [item] };
    const result = parseFeedListings(feedData, "forsale");
    expect(result[0]!.address).toBe("Haifa");
  });
});
