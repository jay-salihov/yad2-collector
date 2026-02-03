import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { Listing, VehicleFields, RealEstateFields } from "../../src/shared/types";
import type * as DbModule from "../../src/background/db";

let db: typeof DbModule;

function makeVehicleListing(overrides: Partial<Listing> = {}): Listing {
  return {
    token: "v1",
    category: "vehicles",
    subcategory: "cars",
    adType: "private",
    pageType: "feed",
    currentPrice: 80000,
    firstPrice: 80000,
    priceChangeCount: 0,
    firstSeenAt: "2024-01-01T00:00:00.000Z",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    title: "Toyota Corolla 2020",
    address: "Tel Aviv",
    imageUrl: "https://example.com/img.jpg",
    categoryFields: {
      manufacturer: "Toyota",
      manufacturerId: "1",
      model: "Corolla",
      modelId: "2",
      subModel: "",
      year: 2020,
      engineType: "Petrol",
      engineVolumeCc: "1600",
      gearBox: "Automatic",
      hand: 2,
      km: 50000,
      color: "White",
    } as VehicleFields,
    detailFields: null,
    rawData: {},
    ...overrides,
  };
}

function makeRealEstateListing(overrides: Partial<Listing> = {}): Listing {
  return {
    token: "re1",
    category: "realestate",
    subcategory: "forsale",
    adType: "private",
    pageType: "feed",
    currentPrice: 2500000,
    firstPrice: 2500000,
    priceChangeCount: 0,
    firstSeenAt: "2024-01-01T00:00:00.000Z",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    title: "Apartment, Tel Aviv",
    address: "Center",
    imageUrl: "https://example.com/img.jpg",
    categoryFields: {
      propertyType: "Apartment",
      rooms: 4,
      squareMeters: 100,
      squareMetersBuild: 90,
      floor: 3,
      totalFloors: 8,
      condition: "Renovated",
      neighborhood: "Florentin",
      city: "Tel Aviv",
    } as RealEstateFields,
    detailFields: null,
    rawData: {},
    ...overrides,
  };
}

beforeEach(async () => {
  // Create a completely fresh IDBFactory for each test — clean slate
  globalThis.indexedDB = new IDBFactory();
  globalThis.IDBKeyRange = IDBKeyRange;

  // Reset module cache so db.ts gets a fresh dbInstance = null
  vi.resetModules();
  db = await import("../../src/background/db");
});

describe("openDB", () => {
  it("creates DB with correct stores and indexes", async () => {
    const idb = await db.openDB();
    expect(idb.name).toBe("yad2_collector");
    expect(idb.version).toBe(1);

    const storeNames = Array.from(idb.objectStoreNames);
    expect(storeNames).toContain("listings");
    expect(storeNames).toContain("price_history");
    expect(storeNames).toContain("collection_log");

    const tx = idb.transaction("listings", "readonly");
    const listingsStore = tx.objectStore("listings");
    const indexNames = Array.from(listingsStore.indexNames);
    expect(indexNames).toContain("category");
    expect(indexNames).toContain("lastSeenAt");
    expect(indexNames).toContain("currentPrice");
    expect(indexNames).toContain("category_lastSeenAt");
    tx.abort();
  });
});

describe("upsertListings", () => {
  it("inserts new listings", async () => {
    const result = await db.upsertListings([
      makeVehicleListing({ token: "new1" }),
      makeVehicleListing({ token: "new2" }),
    ]);
    expect(result.newListings).toBe(2);
    expect(result.priceChanges).toBe(0);

    const listings = await db.getListings();
    expect(listings).toHaveLength(2);
  });

  it("updates existing listing lastSeenAt", async () => {
    await db.upsertListings([makeVehicleListing({ token: "t1" })]);
    const before = await db.getListings();
    const beforeSeen = before[0]!.lastSeenAt;

    await new Promise((r) => setTimeout(r, 10));
    await db.upsertListings([makeVehicleListing({ token: "t1" })]);

    const after = await db.getListings();
    expect(after[0]!.lastSeenAt).not.toBe(beforeSeen);
  });

  it("detects price changes and writes price_history", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);

    const result = await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 75000 }),
    ]);

    expect(result.priceChanges).toBe(1);
    expect(result.newListings).toBe(0);

    const listings = await db.getListings();
    expect(listings[0]!.currentPrice).toBe(75000);
    expect(listings[0]!.priceChangeCount).toBe(1);
  });

  it("does not count as price change when price is the same", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);
    const result = await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);
    expect(result.priceChanges).toBe(0);
  });

  it("does not count as price change when new price is null", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);
    const result = await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: null }),
    ]);
    expect(result.priceChanges).toBe(0);
  });
});

describe("upsertDetailListing", () => {
  it("merges detailFields into existing listing", async () => {
    await db.upsertListings([makeVehicleListing({ token: "t1" })]);

    const detail = makeVehicleListing({
      token: "t1",
      pageType: "detail",
      detailFields: {
        description: "Great car",
        sellerName: "John",
        updatedAt: "2024-06-01",
        additionalInfo: {},
        enrichedAt: "2024-06-01T00:00:00.000Z",
      },
    });

    await db.upsertDetailListing(detail);

    const listings = await db.getListings();
    expect(listings[0]!.detailFields).not.toBeNull();
    expect(listings[0]!.detailFields!.description).toBe("Great car");
  });

  it("creates new listing if not found", async () => {
    const detail = makeVehicleListing({
      token: "newdetail",
      pageType: "detail",
      detailFields: {
        description: "Brand new",
        sellerName: "Seller",
        updatedAt: "2024-06-01",
        additionalInfo: {},
        enrichedAt: "2024-06-01T00:00:00.000Z",
      },
    });

    await db.upsertDetailListing(detail);

    const listings = await db.getListings();
    expect(listings).toHaveLength(1);
    expect(listings[0]!.token).toBe("newdetail");
    expect(listings[0]!.detailFields!.description).toBe("Brand new");
  });

  it("detects price change on detail upsert", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);

    const detail = makeVehicleListing({
      token: "t1",
      currentPrice: 70000,
      detailFields: {
        description: "Updated",
        sellerName: "Seller",
        updatedAt: "2024-06-01",
        additionalInfo: {},
        enrichedAt: "2024-06-01T00:00:00.000Z",
      },
    });

    await db.upsertDetailListing(detail);

    const listings = await db.getListings();
    expect(listings[0]!.currentPrice).toBe(70000);
    expect(listings[0]!.priceChangeCount).toBe(1);
  });
});

describe("getStats", () => {
  it("returns correct counts per category", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "v1" }),
      makeVehicleListing({ token: "v2" }),
      makeRealEstateListing({ token: "re1" }),
    ]);

    const stats = await db.getStats();
    expect(stats.vehicles).toBe(2);
    expect(stats.realestate).toBe(1);
    expect(stats.total).toBe(3);
  });

  it("returns zero counts for empty DB", async () => {
    const stats = await db.getStats();
    expect(stats.vehicles).toBe(0);
    expect(stats.realestate).toBe(0);
    expect(stats.total).toBe(0);
    expect(stats.priceChanges).toBe(0);
    expect(stats.lastCollectedAt).toBeNull();
  });

  it("counts price changes correctly", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 80000 }),
    ]);
    await db.upsertListings([
      makeVehicleListing({ token: "t1", currentPrice: 75000 }),
    ]);

    const stats = await db.getStats();
    // 1 actual price change (80000 → 75000); initial observation is not a change
    expect(stats.priceChanges).toBe(1);
  });
});

describe("getListings", () => {
  it("returns all listings when no category specified", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "v1" }),
      makeRealEstateListing({ token: "re1" }),
    ]);

    const all = await db.getListings();
    expect(all).toHaveLength(2);
  });

  it("filters by category", async () => {
    await db.upsertListings([
      makeVehicleListing({ token: "v1" }),
      makeRealEstateListing({ token: "re1" }),
    ]);

    const vehicles = await db.getListings("vehicles");
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0]!.category).toBe("vehicles");

    const realestate = await db.getListings("realestate");
    expect(realestate).toHaveLength(1);
    expect(realestate[0]!.category).toBe("realestate");
  });
});

describe("writeCollectionLog", () => {
  it("writes entry and affects stats", async () => {
    await db.writeCollectionLog({
      url: "https://www.yad2.co.il/vehicles/cars",
      category: "vehicles",
      pageType: "feed",
      listingsFound: 10,
      newListings: 5,
      priceChanges: 0,
      collectedAt: "2024-01-01T12:00:00.000Z",
    });

    const stats = await db.getStats();
    expect(stats.lastCollectedAt).toBe("2024-01-01T12:00:00.000Z");
  });

  it("returns most recent collectedAt", async () => {
    await db.writeCollectionLog({
      url: "https://www.yad2.co.il/vehicles/cars",
      category: "vehicles",
      pageType: "feed",
      listingsFound: 10,
      newListings: 5,
      priceChanges: 0,
      collectedAt: "2024-01-01T12:00:00.000Z",
    });

    await db.writeCollectionLog({
      url: "https://www.yad2.co.il/vehicles/cars",
      category: "vehicles",
      pageType: "feed",
      listingsFound: 8,
      newListings: 2,
      priceChanges: 1,
      collectedAt: "2024-01-02T12:00:00.000Z",
    });

    const stats = await db.getStats();
    expect(stats.lastCollectedAt).toBe("2024-01-02T12:00:00.000Z");
  });
});
