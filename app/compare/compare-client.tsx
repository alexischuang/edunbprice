"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  compareFields,
  formatMoney,
  getEducationPriceText,
  getGalleryCandidates,
  splitList,
} from "../catalog";
import { filterVisibleLaptops, useHiddenModels } from "../catalog-store";
import { EducationPriceLink } from "../education-price-link";
import { laptops as baseLaptops, type Laptop } from "../laptop-data";

function usePersistentBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(stored === "1");
    } catch {
      // Ignore storage errors.
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // Ignore storage errors.
    }
  }, [key, ready, value]);

  return [value, setValue] as const;
}

function findLaptop(id: string) {
  return baseLaptops.find((item) => item.id === id) ?? null;
}

function formatField(laptop: Laptop, key: (typeof compareFields)[number]["key"], showEducationPrice: boolean) {
  if (key === "eduPrice") {
    return (
      <EducationPriceLink
        priceText={getEducationPriceText(showEducationPrice, laptop.eduPrice)}
        showEducationPrice={showEducationPrice}
      />
    );
  }
  if (key === "marketPrice") return formatMoney(laptop.marketPrice);
  if (key === "discount") return formatMoney(laptop.discount);
  return String(laptop[key as keyof Laptop] ?? "");
}

export default function CompareClient() {
  const params = useSearchParams();
  const { hiddenModels, ready: hiddenReady } = useHiddenModels();
  const laptops = useMemo(
    () => filterVisibleLaptops(baseLaptops, hiddenModels),
    [hiddenModels],
  );
  const [showEducationPrice, setShowEducationPrice] = usePersistentBoolean(
    "edu-price-visible",
    false,
  );

  const selected = useMemo(() => {
    const ids = params
      .get("ids")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    const resolved = ids.map(findLaptop).filter(Boolean) as Laptop[];
    if (resolved.length > 0) return resolved;
    return laptops.slice(0, Math.min(3, laptops.length));
  }, [laptops, params]);

  const compareCount = Math.max(1, selected.length);

  if (!hiddenReady) {
    return (
      <main className="compare-shell">
        <div className="page-frame">
          <div className="loading-stage">
            <strong>載入共享資料中</strong>
            <span>正在從 Vercel KV 讀取已隱藏機型，請稍候。</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="compare-shell">
      <div className="page-frame" style={{ ["--compare-count" as string]: compareCount }}>
        <div className="topbar">
          <button
            className="excel-toggle"
            onClick={() => setShowEducationPrice((current) => !current)}
            type="button"
            aria-label="切換教育價顯示"
          >
            <span className="signal" aria-hidden="true" />
            <strong>EXCEL</strong>
          </button>

          <div className="topbar-links">
            <Link className="link-pill" href="/">
              回到挑選器
            </Link>
            <Link className="link-pill" href="/update">
              更新後台
            </Link>
          </div>
        </div>

        <section className="compare-header">
          <div className="compare-title">
            <p className="eyebrow">comparison</p>
            <h1>多機比較</h1>
            <p className="compare-lead">
              圖片先放上方，接著逐欄比較 CPU、RAM、SSD、LCD、顯示卡、教育價、市價、折扣、重量與保固。
            </p>
          </div>

          <div className="compare-chip-row">
            <span className="compare-chip">{selected.length} 台機型</span>
            <span className="compare-chip">{showEducationPrice ? "教育價顯示" : "教育價隱藏"}</span>
          </div>
        </section>

        {selected.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <strong>沒有可比較的機型</strong>
              <span>回到首頁先勾選 2 台以上，再按比較。</span>
              <Link className="button-primary" href="/">
                回首頁挑選
              </Link>
            </div>
          </section>
        ) : (
          <section className="compare-panel">
            <div className="compare-strip">
              {selected.map((laptop) => (
                <article key={laptop.id} className="compare-column">
                  <CompareMedia laptop={laptop} />
                  <div className="compare-column-body">
                    <p className="family">{laptop.family}</p>
                    <h3>{laptop.model}</h3>
                    <div className="compare-price">
                      <strong className="edu">
                        <EducationPriceLink
                          priceText={getEducationPriceText(showEducationPrice, laptop.eduPrice)}
                          showEducationPrice={showEducationPrice}
                        />
                      </strong>
                      <span className="market">市價 {formatMoney(laptop.marketPrice)}</span>
                      <span className="market">目前最高折扣 {formatMoney(laptop.discount)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="compare-mobile-note notice">
              手機版也保留完整比較內容，但畫面會更長，方便一路往下看。
            </div>

            <div className="compare-table">
              {compareFields.map((field) => (
                <div
                  key={field.key}
                  className="compare-row-grid"
                  style={{ ["--compare-count" as string]: compareCount }}
                >
                  <header>{field.label}</header>
                  {selected.map((laptop) => (
                    <div key={`${laptop.id}-${field.key}`}>
                      {formatField(laptop, field.key, showEducationPrice)}
                    </div>
                  ))}
                </div>
              ))}

              <div className="compare-row-grid" style={{ ["--compare-count" as string]: compareCount }}>
                <header>用途</header>
                {selected.map((laptop) => (
                  <div key={`${laptop.id}-purposes`}>
                    {splitList(laptop.purposes).join("、")}
                  </div>
                ))}
              </div>

              <div className="compare-row-grid" style={{ ["--compare-count" as string]: compareCount }}>
                <header>重點特色</header>
                {selected.map((laptop) => (
                  <div key={`${laptop.id}-highlights`}>
                    {splitList(laptop.highlights).slice(0, 4).join("、")}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function CompareMedia({ laptop }: { laptop: Laptop }) {
  const candidates = useMemo(() => getGalleryCandidates(laptop), [laptop]);
  const [activeSource, setActiveSource] = useState<string | null>(candidates[0] ?? null);

  useEffect(() => {
    setActiveSource(candidates[0] ?? null);
  }, [candidates]);

  return (
    <div className="compare-thumb">
      {activeSource ? (
        <Image
          alt={laptop.title}
          className="machine-image"
          fill
          onError={() => {
            const nextSource = candidates.find((item) => item !== activeSource) ?? null;
            setActiveSource(nextSource);
          }}
          sizes="(max-width: 760px) 100vw, 33vw"
          src={activeSource}
        />
      ) : (
        <div className="fallback-visual">
          <strong>圖片待補</strong>
          <span>{laptop.model}</span>
        </div>
      )}
    </div>
  );
}
