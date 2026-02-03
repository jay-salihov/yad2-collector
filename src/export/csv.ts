import type { Exporter } from "./base";
import type { Listing, Category, VehicleFields, RealEstateFields } from "../shared/types";

const vehicleHeaders = [
  "token", "ad_type", "manufacturer", "model", "sub_model", "year",
  "engine_type", "hand", "km", "price", "first_price", "price_changes",
  "address", "description", "image_url", "first_seen", "last_seen", "seller_name", "updated_at"
];

const realEstateHeaders = [
  "token", "ad_type", "property_type", "rooms", "sqm", "floor", "condition",
  "price", "first_price", "price_changes", "city", "neighborhood", "address",
  "description", "image_url", "first_seen", "last_seen", "seller_name", "updated_at"
];

type CsvField = string | number | null | undefined;

function escapeCsvField(field: CsvField): string {
  if (field === null || typeof field === "undefined") {
    return "";
  }
  const str = String(field);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function listingsToCsv(listings: Listing[], headers: string[], rowMapper: (l: Listing) => CsvField[]): string {
  const rows = listings.map(rowMapper);
  const csvRows = [headers.join(","), ...rows.map(row => row.map(escapeCsvField).join(","))];
  return csvRows.join("\r\n");
}

function createCsvBlob(csvContent: string): Blob {
  // UTF-8 BOM to ensure Excel opens with correct encoding for Hebrew characters
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  return new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
}

export class CsvExporter implements Exporter {
  name = "CSV Exporter";
  extension = "csv";

  generate(listings: Listing[]): Blob {
    if (listings.length === 0) {
      return createCsvBlob("");
    }

    const first = listings[0]!;
    const category = first.category;
    const sameCategory = listings.every(l => l.category === category);
    if (!sameCategory) {
      throw new Error("Cannot export a mixed batch of listings to CSV. All listings must belong to the same category.");
    }
    
    const csvContent = this.generateCategoryCsv(listings, category);
    return createCsvBlob(csvContent);
  }

  generateCategoryCsv(listings: Listing[], category: Category): string {
    if (category === "vehicles") {
      return listingsToCsv(listings, vehicleHeaders, this.mapVehicleRow);
    } else if (category === "realestate") {
      return listingsToCsv(listings, realEstateHeaders, this.mapRealEstateRow);
    }
    return "";
  }

  private mapVehicleRow(listing: Listing): CsvField[] {
    const catFields = listing.categoryFields as VehicleFields;
    const detailFields = listing.detailFields;
    return [
      listing.token,
      listing.adType,
      catFields.manufacturer,
      catFields.model,
      catFields.subModel,
      catFields.year,
      catFields.engineType,
      catFields.hand,
      catFields.km,
      listing.currentPrice,
      listing.firstPrice,
      listing.priceChangeCount,
      listing.address,
      detailFields?.description,
      listing.imageUrl,
      listing.firstSeenAt,
      listing.lastSeenAt,
      detailFields?.sellerName,
      detailFields?.updatedAt
    ];
  }

  private mapRealEstateRow(listing: Listing): CsvField[] {
    const catFields = listing.categoryFields as RealEstateFields;
    const detailFields = listing.detailFields;
    return [
      listing.token,
      listing.adType,
      catFields.propertyType,
      catFields.rooms,
      catFields.squareMeters,
      catFields.floor,
      catFields.condition,
      listing.currentPrice,
      listing.firstPrice,
      listing.priceChangeCount,
      catFields.city,
      catFields.neighborhood,
      listing.address,
      detailFields?.description,
      listing.imageUrl,
      listing.firstSeenAt,
      listing.lastSeenAt,
      detailFields?.sellerName,
      detailFields?.updatedAt
    ];
  }
}