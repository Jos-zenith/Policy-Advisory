/**
 * Static catalog: products and rate tables from data/canonical.
 * Server code and tests import this synchronously; the Stage 3 UI loads it
 * through a dynamic import so the 250 KB rate grid stays out of the first load.
 */
import productsJson from "./canonical/products.json";
import ratesJson from "./canonical/rate-tables.json";
import type { Product, RateTable } from "@/engine/types";

export interface Catalog {
  products: Product[];
  rateTables: RateTable[];
  isSample: boolean;
  version: string;
}

export const CATALOG: Catalog = {
  products: productsJson.products as Product[],
  rateTables: ratesJson.tables as RateTable[],
  isSample: productsJson.isSample,
  version: productsJson.version,
};
