import { describe, it, expect } from "vitest";
import {
  isValidToken,
  isValidPrice,
  isValidCategory,
  isValidAdType,
  sanitizeString,
  sanitizeListing,
  sanitizeListings,
} from "../../src/shared/sanitizer";
import type { Listing } from "../../src/shared/types";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    token: "abc123",
    category: "vehicles",
    subcategory: "cars",
    adType: "private",
    pageType: "feed",
    currentPrice: 50000,
    firstPrice: 50000,
    priceChangeCount: 0,
    firstSeenAt: "2024-01-01T00:00:00.000Z",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    title: "Test Listing",
    address: "Tel Aviv",
    imageUrl: "https://example.com/img.jpg",
    categoryFields: {
      manufacturer: "Toyota",
      manufacturerId: "1",
      model: "Corolla",
      modelId: "2",
      subModel: "",
      year: 2020,
      engineType: "petrol",
      engineVolumeCc: "1600",
      gearBox: "automatic",
      hand: 1,
      km: 50000,
      color: "white",
    },
    detailFields: null,
    rawData: {},
    ...overrides,
  };
}

describe("isValidToken", () => {
  it("accepts valid alphanumeric token", () => {
    expect(isValidToken("abc123")).toBe(true);
  });

  it("accepts uppercase letters", () => {
    expect(isValidToken("ABC123")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidToken("")).toBe(false);
  });

  it("rejects token longer than 50 chars", () => {
    expect(isValidToken("a".repeat(51))).toBe(false);
  });

  it("accepts token of exactly 50 chars", () => {
    expect(isValidToken("a".repeat(50))).toBe(true);
  });

  it("rejects special characters", () => {
    expect(isValidToken("abc-123")).toBe(false);
    expect(isValidToken("abc_123")).toBe(false);
    expect(isValidToken("abc!123")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidToken("abc 123")).toBe(false);
  });
});

describe("isValidPrice", () => {
  it("accepts positive numbers", () => {
    expect(isValidPrice(100)).toBe(true);
    expect(isValidPrice(0.01)).toBe(true);
  });

  it("rejects zero", () => {
    expect(isValidPrice(0)).toBe(false);
  });

  it("rejects negative numbers", () => {
    expect(isValidPrice(-1)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isValidPrice(NaN)).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(isValidPrice(Infinity)).toBe(false);
    expect(isValidPrice(-Infinity)).toBe(false);
  });

  it("rejects strings", () => {
    expect(isValidPrice("100")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidPrice(null)).toBe(false);
  });
});

describe("isValidCategory", () => {
  it("accepts 'vehicles'", () => {
    expect(isValidCategory("vehicles")).toBe(true);
  });

  it("accepts 'realestate'", () => {
    expect(isValidCategory("realestate")).toBe(true);
  });

  it("rejects invalid category", () => {
    expect(isValidCategory("cars")).toBe(false);
    expect(isValidCategory("")).toBe(false);
    expect(isValidCategory("VEHICLES")).toBe(false);
  });
});

describe("isValidAdType", () => {
  const validTypes = ["private", "commercial", "platinum", "boost", "solo", "yad1"];

  for (const type of validTypes) {
    it(`accepts '${type}'`, () => {
      expect(isValidAdType(type)).toBe(true);
    });
  }

  it("rejects invalid ad type", () => {
    expect(isValidAdType("premium")).toBe(false);
    expect(isValidAdType("")).toBe(false);
    expect(isValidAdType("PRIVATE")).toBe(false);
  });
});

describe("sanitizeString", () => {
  it("strips HTML tags", () => {
    expect(sanitizeString("<b>bold</b>")).toBe("bold");
    expect(sanitizeString("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("truncates at 2000 characters", () => {
    const long = "a".repeat(2500);
    expect(sanitizeString(long)).toHaveLength(2000);
  });

  it("passes through normal strings unchanged", () => {
    expect(sanitizeString("hello world")).toBe("hello world");
  });

  it("returns empty string for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeString(123 as any)).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeString(null as any)).toBe("");
  });
});

describe("sanitizeListing", () => {
  it("passes through a valid listing", () => {
    const listing = makeListing();
    const result = sanitizeListing(listing);
    expect(result).not.toBeNull();
    expect(result!.token).toBe("abc123");
  });

  it("returns null for invalid token", () => {
    const listing = makeListing({ token: "" });
    expect(sanitizeListing(listing)).toBeNull();
  });

  it("returns null for invalid category", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = makeListing({ category: "invalid" as any });
    expect(sanitizeListing(listing)).toBeNull();
  });

  it("returns null for invalid adType", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = makeListing({ adType: "invalid" as any });
    expect(sanitizeListing(listing)).toBeNull();
  });

  it("coerces invalid price to null", () => {
    const listing = makeListing({ currentPrice: -1 });
    const result = sanitizeListing(listing);
    expect(result).not.toBeNull();
    expect(result!.currentPrice).toBeNull();
    expect(result!.firstPrice).toBeNull();
  });

  it("preserves null price", () => {
    const listing = makeListing({ currentPrice: null });
    const result = sanitizeListing(listing);
    expect(result).not.toBeNull();
    expect(result!.currentPrice).toBeNull();
  });

  it("sanitizes string fields", () => {
    const listing = makeListing({
      title: "<b>Car</b>",
      address: "<em>City</em>",
    });
    const result = sanitizeListing(listing);
    expect(result!.title).toBe("Car");
    expect(result!.address).toBe("City");
  });
});

describe("sanitizeListings", () => {
  it("filters out invalid listings", () => {
    const listings = [
      makeListing({ token: "valid1" }),
      makeListing({ token: "" }), // invalid
      makeListing({ token: "valid2" }),
    ];
    const result = sanitizeListings(listings);
    expect(result).toHaveLength(2);
    expect(result[0]!.token).toBe("valid1");
    expect(result[1]!.token).toBe("valid2");
  });

  it("returns empty array for all-invalid input", () => {
    const listings = [
      makeListing({ token: "" }),
      makeListing({ token: "abc-invalid" }),
    ];
    expect(sanitizeListings(listings)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(sanitizeListings([])).toHaveLength(0);
  });
});
