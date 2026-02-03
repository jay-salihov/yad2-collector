import { Listing } from "../shared/types";

export interface Exporter {
  name: string;
  extension: string;
  generate(listings: Listing[]): Blob;
}