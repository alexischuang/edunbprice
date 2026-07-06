"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  compareFields,
  formatMoney,
  formatDiscountFold,
  getGalleryCandidates,
  splitList,
} from "../catalog";
import { laptops, type Laptop } from "../laptop-data";

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

function EducationPrice({ showEducationPrice, price }: { showEducationPrice: boolean; price: number }) {
  return showEducationPrice ? (
    formatMoney(price)
  ) : (
    <Link className="quote-link" href="https://lin.ee/Y9sCx0K" rel="noreferrer" target="_blank">
      ?勗隢晾??鈭箏
    </Link>
  );
}

function findLaptop(id: string) {
  return laptops.find((item) => item.id === id) ?? null;
}

function formatField(
  laptop: Laptop,
  key: (typeof compareFields)[number]["key"],
  showEducationPrice: boolean,
) {
  if (key === "eduPrice") return <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />;
  if (key === "marketPrice") return formatMoney(laptop.marketPrice);
  if (key === "discount") return formatMoney(laptop.discount);
  return String(laptop[key as keyof Laptop] ?? "");
}

export default function CompareClient() {
  const params = useSearchParams();
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
  }, [params]);

  const compareCount = Math.max(1, selected.length);

  return (
    <main className="compare-shell">
      <div className="page-frame" style={{ ["--compare-count" as string]: compareCount }}>
        <div className="topbar">
          <button
            className="excel-toggle"
            onClick={() => setShowEducationPrice((current) => !current)}
            type="button"
            aria-label="????寥＊蝷?"
          >
            <span className="signal" aria-hidden="true" />
            <strong>EXCEL</strong>
          </button>

          <div className="topbar-links">
            <Link className="link-pill" href="/">
              ????
            </Link>
            <Link className="link-pill" href="/update">
              ?湔敺
            </Link>
          </div>
        </div>

        <section className="compare-header">
          <div className="compare-title">
            <p className="eyebrow">comparison</p>
            <h1>憭?瘥?</h1>
            <p className="compare-lead">
              ???銝嚗??瘥? CPU?AM?SD?CD?＊蝷箏???脣???嫘??????靽??
            </p>
          </div>

          <div className="compare-chip-row">
            <span className="compare-chip">{selected.length} ?唳???</span>
            <span className="compare-chip">{showEducationPrice ? "??寥＊蝷?" : "??寥??"}</span>
          </div>
        </section>

        {selected.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <strong>瘝??舀?頛?璈?</strong>
              <span>?擐????2 ?唬誑銝???瘥???</span>
              <Link className="button-primary" href="/">
                ??????
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
                        <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
                      </strong>
                      <span className="market">撣 {formatMoney(laptop.marketPrice)}</span>
                      <span className="market">
                        ?桀??擃???{formatMoney(laptop.discount)}
                        {laptop.discountRate ? ` 繚 ${formatDiscountFold(laptop.discountRate)}` : ""}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="compare-mobile-note notice">
              ????靽?摰瘥??批捆嚗??恍??瘀??嫣噶銝頝臬?銝???
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
                <header>?券?</header>
                {selected.map((laptop) => (
                  <div key={`${laptop.id}-purposes`}>
                    {splitList(laptop.purposes).join("、")}
                  </div>
                ))}
              </div>

              <div className="compare-row-grid" style={{ ["--compare-count" as string]: compareCount }}>
                <header>???寡</header>
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
          <strong>??敺?</strong>
          <span>{laptop.model}</span>
        </div>
      )}
    </div>
  );
}
