import { describe, it, expect } from "vitest";
import { CsvExporter } from "../../src/export/csv";
import type { Listing, VehicleFields, RealEstateFields } from "../../src/shared/types";

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
      subModel: "GLi",
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

async function blobToText(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Skip UTF-8 BOM (3 bytes: 0xEF, 0xBB, 0xBF)
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  return new TextDecoder().decode(bytes.slice(start));
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

describe("CsvExporter", () => {
  const exporter = new CsvExporter();

  describe("generate", () => {
    it("returns blob with BOM for empty listings", async () => {
      const blob = exporter.generate([]);
      const bytes = await blobToBytes(blob);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
      const text = await blobToText(blob);
      expect(text).toBe("");
    });

    it("produces correct headers and rows for vehicle listings", async () => {
      const blob = exporter.generate([makeVehicleListing()]);
      const text = await blobToText(blob);
      const lines = text.split("\r\n");
      expect(lines[0]).toBe(
        "token,ad_type,manufacturer,model,sub_model,year,engine_type,hand,km,price,first_price,price_changes,address,description,image_url,first_seen,last_seen,seller_name,updated_at"
      );
      expect(lines).toHaveLength(2);
      // Check first few fields of data row
      const fields = lines[1]!.split(",");
      expect(fields[0]).toBe("v1");
      expect(fields[1]).toBe("private");
      expect(fields[2]).toBe("Toyota");
      expect(fields[3]).toBe("Corolla");
    });

    it("produces correct headers and rows for real estate listings", async () => {
      const blob = exporter.generate([makeRealEstateListing()]);
      const text = await blobToText(blob);
      const lines = text.split("\r\n");
      expect(lines[0]).toBe(
        "token,ad_type,property_type,rooms,sqm,floor,condition,price,first_price,price_changes,city,neighborhood,address,description,image_url,first_seen,last_seen,seller_name,updated_at"
      );
      const fields = lines[1]!.split(",");
      expect(fields[0]).toBe("re1");
      expect(fields[2]).toBe("Apartment");
      expect(fields[3]).toBe("4");
    });

    it("throws for mixed categories", () => {
      expect(() =>
        exporter.generate([makeVehicleListing(), makeRealEstateListing()])
      ).toThrow("Cannot export a mixed batch");
    });
  });

  describe("CSV escaping", () => {
    it("escapes fields with commas", async () => {
      const listing = makeVehicleListing({
        address: "Tel Aviv, Center",
      });
      const blob = exporter.generate([listing]);
      const text = await blobToText(blob);
      expect(text).toContain('"Tel Aviv, Center"');
    });

    it("escapes fields with double quotes", async () => {
      const listing = makeVehicleListing({
        address: 'The "best" place',
      });
      const blob = exporter.generate([listing]);
      const text = await blobToText(blob);
      expect(text).toContain('"The ""best"" place"');
    });

    it("escapes fields with newlines", async () => {
      const listing = makeVehicleListing({
        detailFields: {
          description: "Line 1\nLine 2",
          sellerName: "Seller",
          updatedAt: "2024-01-01",
          additionalInfo: {},
          enrichedAt: "2024-01-01",
        },
      });
      const blob = exporter.generate([listing]);
      const text = await blobToText(blob);
      expect(text).toContain('"Line 1\nLine 2"');
    });
  });

  describe("UTF-8 BOM", () => {
    it("is present in output", async () => {
      const blob = exporter.generate([makeVehicleListing()]);
      const bytes = await blobToBytes(blob);
      expect(bytes[0]).toBe(0xef);
      expect(bytes[1]).toBe(0xbb);
      expect(bytes[2]).toBe(0xbf);
    });
  });

  describe("null detailFields", () => {
    it("handles null detailFields gracefully", async () => {
      const listing = makeVehicleListing({ detailFields: null });
      const blob = exporter.generate([listing]);
      const text = await blobToText(blob);
      const lines = text.split("\r\n");
      // description, sellerName, updatedAt should be empty
      const fields = lines[1]!.split(",");
      // description is index 13
      expect(fields[13]).toBe("");
      // seller_name is index 17
      expect(fields[17]).toBe("");
      // updated_at is index 18
      expect(fields[18]).toBe("");
    });
  });
});
