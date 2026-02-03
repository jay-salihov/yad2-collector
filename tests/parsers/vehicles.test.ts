import { describe, it, expect } from "vitest";
import {
  parseFeedListings,
  parseDetailListing,
} from "../../src/content/parsers/vehicles";
import type { VehicleFields } from "../../src/shared/types";

type RawObject = Record<string, unknown>;

function makeVehicleItem(overrides: RawObject = {}): RawObject {
  return {
    token: "abc123",
    price: 80000,
    manufacturer: { id: 1, text: "Toyota" },
    model: { id: 2, text: "Corolla" },
    subModel: { id: 3, text: "GLi" },
    vehicleDates: { yearOfProduction: 2020 },
    engineType: { id: 1, text: "Petrol" },
    engineVolume: "1600",
    gearBox: { id: 1, text: "Automatic" },
    handNumber: 2,
    kilometers: 50000,
    color: { id: 1, text: "White" },
    address: { area: { text: "Center" }, city: { text: "Tel Aviv" } },
    metaData: { coverImage: "https://img.yad2.co.il/cover.jpg" },
    ...overrides,
  };
}

describe("parseFeedListings", () => {
  it("parses listings from multiple ad types", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem({ token: "p1" })],
      commercial: [makeVehicleItem({ token: "c1" })],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result).toHaveLength(2);
    // Iteration order follows VEHICLE_AD_TYPES: commercial, private, ...
    expect(result[0]!.token).toBe("c1");
    expect(result[0]!.adType).toBe("commercial");
    expect(result[1]!.token).toBe("p1");
    expect(result[1]!.adType).toBe("private");
  });

  it("returns empty array for empty feed data", () => {
    expect(parseFeedListings({}, "cars")).toHaveLength(0);
  });

  it("skips items without token property", () => {
    const feedData: RawObject = {
      private: [{ price: 100 }, makeVehicleItem({ token: "valid" })],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result).toHaveLength(1);
    expect(result[0]!.token).toBe("valid");
  });

  it("skips items with null token", () => {
    const feedData: RawObject = {
      private: [
        makeVehicleItem({ token: null }),
        makeVehicleItem({ token: "valid" }),
      ],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result).toHaveLength(1);
  });

  it("skips non-array ad type entries", () => {
    const feedData: RawObject = {
      private: "not an array",
      commercial: [makeVehicleItem({ token: "c1" })],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result).toHaveLength(1);
  });

  it("sets category to 'vehicles'", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem()],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result[0]!.category).toBe("vehicles");
  });

  it("sets pageType to 'feed'", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem()],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result[0]!.pageType).toBe("feed");
  });
});

describe("parseDetailListing", () => {
  it("produces listing with detailFields for valid item", () => {
    const item = makeVehicleItem({
      description: "Great car",
      updatedAt: "2024-01-01",
    });
    const result = parseDetailListing(item, "cars");
    expect(result).not.toBeNull();
    expect(result!.pageType).toBe("detail");
    expect(result!.detailFields).not.toBeNull();
    expect(result!.detailFields!.description).toBe("Great car");
  });

  it("returns null for missing token", () => {
    const item = makeVehicleItem({ token: "" });
    expect(parseDetailListing(item, "cars")).toBeNull();
  });

  it("defaults adType to 'private' when not provided", () => {
    const item = makeVehicleItem();
    delete item.adType;
    const result = parseDetailListing(item, "cars");
    expect(result!.adType).toBe("private");
  });

  it("uses provided adType", () => {
    const item = makeVehicleItem({ adType: "commercial" });
    const result = parseDetailListing(item, "cars");
    expect(result!.adType).toBe("commercial");
  });
});

describe("vehicle field extraction", () => {
  it("extracts all vehicle fields correctly", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem()],
    };
    const result = parseFeedListings(feedData, "cars");
    const fields = result[0]!.categoryFields as VehicleFields;
    expect(fields.manufacturer).toBe("Toyota");
    expect(fields.manufacturerId).toBe("1");
    expect(fields.model).toBe("Corolla");
    expect(fields.modelId).toBe("2");
    expect(fields.subModel).toBe("GLi");
    expect(fields.year).toBe(2020);
    expect(fields.engineType).toBe("Petrol");
    expect(fields.engineVolumeCc).toBe("1600");
    expect(fields.gearBox).toBe("Automatic");
    expect(fields.hand).toBe(2);
    expect(fields.km).toBe(50000);
    expect(fields.color).toBe("White");
  });

  it("builds title from manufacturer, model, year", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem()],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result[0]!.title).toBe("Toyota Corolla 2020");
  });

  it("extracts price correctly", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem({ price: 120000 })],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result[0]!.currentPrice).toBe(120000);
  });

  it("handles null price", () => {
    const feedData: RawObject = {
      private: [makeVehicleItem({ price: null })],
    };
    const result = parseFeedListings(feedData, "cars");
    expect(result[0]!.currentPrice).toBeNull();
  });
});
