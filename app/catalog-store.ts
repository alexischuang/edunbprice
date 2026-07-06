"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import type { Laptop } from "./laptop-data";

const HIDDEN_MODELS_ENDPOINT = "/api/hidden-models";

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function useHiddenModels() {
  const [hiddenModels, setHiddenModels] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHiddenModels() {
      try {
        const response = await fetch(HIDDEN_MODELS_ENDPOINT, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load hidden models.");
        const payload = (await response.json()) as { models?: unknown };
        const models = Array.isArray(payload.models)
          ? payload.models.map((item) => String(item)).filter(Boolean)
          : [];
        if (!cancelled) setHiddenModels(models);
      } catch {
        if (!cancelled) setHiddenModels([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void loadHiddenModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateHiddenModels = useCallback((value: SetStateAction<string[]>) => {
    setHiddenModels((current) => {
      const next = typeof value === "function" ? value(current) : value;

      void fetch(HIDDEN_MODELS_ENDPOINT, {
        body: JSON.stringify({ models: next }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }).catch(() => {
        // Ignore network/storage errors and keep the optimistic UI state.
      });

      return next;
    });
  }, []);

  return { hiddenModels, setHiddenModels: updateHiddenModels, ready } as const;
}

export function filterVisibleLaptops<T extends Laptop>(items: T[], hiddenModels: string[]) {
  const hiddenSet = new Set(hiddenModels.map(normalize));
  return items.filter((item) => !hiddenSet.has(normalize(item.model)));
}
