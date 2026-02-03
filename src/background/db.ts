import { DB_NAME, DB_VERSION, STORES } from "../shared/constants";
import type {
  Category,
  CollectionLogEntry,
  Listing,
  PriceRecord,
} from "../shared/types";

let dbInstance: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // listings store — keyPath: token
      if (!db.objectStoreNames.contains(STORES.LISTINGS)) {
        const listings = db.createObjectStore(STORES.LISTINGS, {
          keyPath: "token",
        });
        listings.createIndex("category", "category", { unique: false });
        listings.createIndex("lastSeenAt", "lastSeenAt", { unique: false });
        listings.createIndex("currentPrice", "currentPrice", { unique: false });
        listings.createIndex("category_lastSeenAt", ["category", "lastSeenAt"], {
          unique: false,
        });
      }

      // price_history store — autoIncrement
      if (!db.objectStoreNames.contains(STORES.PRICE_HISTORY)) {
        const priceHistory = db.createObjectStore(STORES.PRICE_HISTORY, {
          keyPath: "id",
          autoIncrement: true,
        });
        priceHistory.createIndex("token", "token", { unique: false });
        priceHistory.createIndex("token_recordedAt", ["token", "recordedAt"], {
          unique: false,
        });
      }

      // collection_log store — autoIncrement
      if (!db.objectStoreNames.contains(STORES.COLLECTION_LOG)) {
        const log = db.createObjectStore(STORES.COLLECTION_LOG, {
          keyPath: "id",
          autoIncrement: true,
        });
        log.createIndex("collectedAt", "collectedAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export interface UpsertResult {
  newListings: number;
  priceChanges: number;
}

export async function upsertListings(
  listings: Listing[],
): Promise<UpsertResult> {
  const db = await openDB();
  const now = new Date().toISOString();
  let newListings = 0;
  let priceChanges = 0;

  const tx = db.transaction(
    [STORES.LISTINGS, STORES.PRICE_HISTORY],
    "readwrite",
  );
  const listingsStore = tx.objectStore(STORES.LISTINGS);
  const priceStore = tx.objectStore(STORES.PRICE_HISTORY);

  const results = await Promise.allSettled(
    listings.map(
      (listing) =>
        new Promise<void>((resolve, reject) => {
          const getReq = listingsStore.get(listing.token);

          getReq.onsuccess = () => {
            const existing = getReq.result as Listing | undefined;

            if (!existing) {
              // New listing
              const record: Listing = {
                ...listing,
                firstPrice: listing.currentPrice,
                firstSeenAt: now,
                lastSeenAt: now,
                priceChangeCount: 0,
              };
              listingsStore.put(record);

              if (record.currentPrice !== null) {
                const priceRecord: Omit<PriceRecord, "id"> = {
                  token: record.token,
                  price: record.currentPrice,
                  recordedAt: now,
                };
                priceStore.add(priceRecord);
              }

              newListings++;
              resolve();
            } else {
              // Existing listing — update lastSeenAt, check price change
              const updated: Listing = {
                ...existing,
                lastSeenAt: now,
                // Preserve feed data but allow detail enrichment
                pageType: listing.pageType,
                rawData: { ...existing.rawData, ...listing.rawData },
              };

              if (
                listing.currentPrice !== null &&
                listing.currentPrice !== existing.currentPrice
              ) {
                updated.currentPrice = listing.currentPrice;
                updated.priceChangeCount = existing.priceChangeCount + 1;

                const priceRecord: Omit<PriceRecord, "id"> = {
                  token: listing.token,
                  price: listing.currentPrice,
                  recordedAt: now,
                };
                priceStore.add(priceRecord);

                priceChanges++;
              }

              listingsStore.put(updated);
              resolve();
            }
          };

          getReq.onerror = () => reject(getReq.error);
        }),
    ),
  );

  // Wait for the transaction to complete
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[yad2-collector] upsert error:", r.reason);
    }
  }

  return { newListings, priceChanges };
}

export async function upsertDetailListing(listing: Listing): Promise<void> {
  const db = await openDB();
  const now = new Date().toISOString();

  const tx = db.transaction(
    [STORES.LISTINGS, STORES.PRICE_HISTORY],
    "readwrite",
  );
  const listingsStore = tx.objectStore(STORES.LISTINGS);
  const priceStore = tx.objectStore(STORES.PRICE_HISTORY);

  await new Promise<void>((resolve, reject) => {
    const getReq = listingsStore.get(listing.token);

    getReq.onsuccess = () => {
      const existing = getReq.result as Listing | undefined;

      if (existing) {
        // Merge detail fields into existing record
        const updated: Listing = {
          ...existing,
          lastSeenAt: now,
          detailFields: listing.detailFields,
          rawData: { ...existing.rawData, ...listing.rawData },
        };

        if (
          listing.currentPrice !== null &&
          listing.currentPrice !== existing.currentPrice
        ) {
          updated.currentPrice = listing.currentPrice;
          updated.priceChangeCount = existing.priceChangeCount + 1;

          const priceRecord: Omit<PriceRecord, "id"> = {
            token: listing.token,
            price: listing.currentPrice,
            recordedAt: now,
          };
          priceStore.add(priceRecord);
        }

        listingsStore.put(updated);
      } else {
        // No existing record — create from detail data
        const record: Listing = {
          ...listing,
          firstPrice: listing.currentPrice,
          firstSeenAt: now,
          lastSeenAt: now,
          priceChangeCount: 0,
        };
        listingsStore.put(record);

        if (record.currentPrice !== null) {
          const priceRecord: Omit<PriceRecord, "id"> = {
            token: record.token,
            price: record.currentPrice,
            recordedAt: now,
          };
          priceStore.add(priceRecord);
        }
      }

      resolve();
    };

    getReq.onerror = () => reject(getReq.error);
  });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function writeCollectionLog(
  entry: Omit<CollectionLogEntry, "id">,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.COLLECTION_LOG, "readwrite");
  const store = tx.objectStore(STORES.COLLECTION_LOG);
  store.add(entry);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface CollectionStats {
  vehicles: number;
  realestate: number;
  total: number;
  priceChanges: number;
  lastCollectedAt: string | null;
}

export async function getStats(): Promise<CollectionStats> {
  const db = await openDB();

  const countByCategory = (category: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LISTINGS, "readonly");
      const store = tx.objectStore(STORES.LISTINGS);
      const index = store.index("category");
      const req = index.count(IDBKeyRange.only(category));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  const getTotalPriceChanges = (): Promise<number> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.LISTINGS, "readonly");
      const store = tx.objectStore(STORES.LISTINGS);
      let total = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          total += (cursor.value as Listing).priceChangeCount;
          cursor.continue();
        } else {
          resolve(total);
        }
      };
      req.onerror = () => reject(req.error);
    });
  };

  const getLastCollected = (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.COLLECTION_LOG, "readonly");
      const store = tx.objectStore(STORES.COLLECTION_LOG);
      const index = store.index("collectedAt");
      const req = index.openCursor(null, "prev");
      req.onsuccess = () => {
        const cursor = req.result;
        resolve(
          cursor
            ? (cursor.value as CollectionLogEntry).collectedAt
            : null,
        );
      };
      req.onerror = () => reject(req.error);
    });
  };

  const [vehicles, realestate, priceChanges, lastCollectedAt] =
    await Promise.all([
      countByCategory("vehicles"),
      countByCategory("realestate"),
      getTotalPriceChanges(),
      getLastCollected(),
    ]);

  return {
    vehicles,
    realestate,
    total: vehicles + realestate,
    priceChanges,
    lastCollectedAt,
  };
}

export async function clearDatabase(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(
    [STORES.LISTINGS, STORES.PRICE_HISTORY, STORES.COLLECTION_LOG],
    "readwrite",
  );
  tx.objectStore(STORES.LISTINGS).clear();
  tx.objectStore(STORES.PRICE_HISTORY).clear();
  tx.objectStore(STORES.COLLECTION_LOG).clear();

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getListings(category?: Category): Promise<Listing[]> {
  const db = await openDB();
  const tx = db.transaction(STORES.LISTINGS, "readonly");
  const store = tx.objectStore(STORES.LISTINGS);

  const request = category
    ? store.index("category").getAll(IDBKeyRange.only(category))
    : store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
