"use client";

import { useEffect, useState } from "react";
import type { Laptop } from "./laptop-data";

export const HIDDEN_MODELS_KEY = "education-hidden-models";

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function readHiddenModels() {
  try {
    const raw = window.localStorage.getItem(HIDDEN_MODELS_KEY);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [] as string[];
  }
}

function writeHiddenModels(models: string[]) {
  try {
    window.localStorage.setItem(HIDDEN_MODELS_KEY, JSON.stringify(models));
  } catch {
    // Ignore storage errors.
  }
}

export function useHiddenModels() {
  const [hiddenModels, setHiddenModels] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setHiddenModels(readHiddenModels());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeHiddenModels(hiddenModels);
  }, [hiddenModels, ready]);

  return { hiddenModels, setHiddenModels, ready } as const;
}

export function filterVisibleLaptops<T extends Laptop>(items: T[], hiddenModels: string[]) {
  const hiddenSet = new Set(hiddenModels.map(normalize));
  return items.filter((item) => !hiddenSet.has(normalize(item.model)));
}
