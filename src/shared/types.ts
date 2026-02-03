export type Category = "vehicles" | "realestate";

export type PageType = "feed" | "detail";

export type AdType =
  | "private"
  | "commercial"
  | "agency"
  | "platinum"
  | "boost"
  | "solo"
  | "yad1";

export interface Listing {
  token: string;
  category: Category;
  subcategory: string;
  adType: AdType;
  pageType: PageType;
  currentPrice: number | null;
  firstPrice: number | null;
  priceChangeCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  title: string;
  address: string;
  imageUrl: string;
  categoryFields: VehicleFields | RealEstateFields;
  detailFields: DetailFields | null;
  rawData: Record<string, unknown>;
}

export interface VehicleFields {
  manufacturer: string;
  manufacturerId: string;
  model: string;
  modelId: string;
  subModel: string;
  year: number | null;
  engineType: string;
  engineVolumeCc: string;
  gearBox: string;
  hand: number | null;
  km: number | null;
  color: string;
}

export interface RealEstateFields {
  propertyType: string;
  rooms: number | null;
  squareMeters: number | null;
  squareMetersBuild: number | null;
  floor: number | null;
  totalFloors: number | null;
  condition: string;
  neighborhood: string;
  city: string;
}

export interface DetailFields {
  description: string;
  updatedAt: string;
  additionalInfo: Record<string, string>;
  enrichedAt: string;
}

export interface PriceRecord {
  id?: number;
  token: string;
  price: number;
  recordedAt: string;
}

export interface CollectionLogEntry {
  id?: number;
  url: string;
  category: Category;
  pageType: PageType;
  listingsFound: number;
  newListings: number;
  priceChanges: number;
  collectedAt: string;
}
