"use client";

import { useCallback, useEffect, useState } from "react";
import { laptops as fallbackLaptops, type Laptop } from "./laptop-data";

const CATALOG_ENDPOINT = "/api/catalog";

export type CatalogResponse = {
  status?: "default" | "custom" | "cleared";
  storageStatus?: "connected" | "local" | "missing";
  sourceFile?: string | null;
  updatedAt?: string | null;
  laptops?: Laptop[];
  missingImages?: string[];
  matchedImageModels?: number;
  totalImageModels?: number;
  currentCount?: number;
  nextCount?: number;
  newCount?: number;
  retainedCount?: number;
  removedCount?: number;
};

export function useCatalog(initialCatalog: Laptop[] = fallbackLaptops) {
  const [catalog, setCatalog] = useState<Laptop[]>(initialCatalog);
  const [meta, setMeta] = useState<CatalogResponse>({
    status: "default",
    storageStatus: "local",
    sourceFile: null,
    updatedAt: null,
    laptops: initialCatalog,
    missingImages: [],
    matchedImageModels: initialCatalog.length,
    totalImageModels: initialCatalog.length,
  });
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const response = await fetch(CATALOG_ENDPOINT, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load catalog.");
      const payload = (await response.json()) as CatalogResponse;
      const laptops = Array.isArray(payload.laptops) ? payload.laptops : initialCatalog;
      setCatalog(laptops);
      setMeta({ ...payload, laptops });
    } catch {
      setCatalog(initialCatalog);
      setMeta({
        status: "default",
        storageStatus: "local",
        sourceFile: null,
        updatedAt: null,
        laptops: initialCatalog,
        missingImages: [],
        matchedImageModels: initialCatalog.length,
        totalImageModels: initialCatalog.length,
      });
    } finally {
      setReady(true);
    }
  }, [initialCatalog]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { catalog, meta, ready, reload, setCatalog } as const;
}
