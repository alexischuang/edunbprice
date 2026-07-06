"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  budgetOptions,
  buildSearchText,
  cpuOptions,
  formatMoney,
  formatDiscountFold,
  getBudgetLimit,
  getCpuCategory,
  getGalleryCandidates,
  getGpuCategory,
  getPurposeLabel,
  getRamCategory,
  getScreenCategory,
  getStorageCategory,
  normalizeText,
  purposeOptions,
  ramOptions,
  screenOptions,
  selectRecommended,
  splitList,
  storageOptions,
  gpuOptions,
  getBestDiscount,
  getBudgetRange,
} from "./catalog";
import { laptops, type Laptop } from "./laptop-data";

type SortMode = "match" | "price" | "saving" | "performance" | "value";

const sortOptions = [
  { value: "match", label: "?蝚血?" },
  { value: "price", label: "?寞?雿?" },
  { value: "saving", label: "??憭?" },
  { value: "performance", label: "??芸?" },
  { value: "value", label: "CP ??" },
] as const;

function EducationPrice({ showEducationPrice, price }: { showEducationPrice: boolean; price: number }) {
  return showEducationPrice ? (
    formatMoney(price)
  ) : (
    <Link className="quote-link" href="https://lin.ee/Y9sCx0K" rel="noreferrer" target="_blank">
      ?勗隢晾??鈭箏
    </Link>
  );
}

function usePersistentBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(stored === "1");
    } catch {
      // Ignore storage errors and keep the default UI state.
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

function scoreLaptop(laptop: Laptop, sortMode: SortMode) {
  if (sortMode === "price") return -laptop.eduPrice;
  if (sortMode === "saving") return laptop.discount * 2 + laptop.discountRate;
  if (sortMode === "performance") return laptop.performance * 2 + laptop.valueScore * 0.1;
  if (sortMode === "value") return laptop.valueScore;

  const distance = Math.abs(laptop.eduPrice - 27500);
  const rangeBonus = laptop.eduPrice >= 25000 && laptop.eduPrice <= 30000 ? 3000 : 0;
  const purposeBonus = laptop.purposes.includes("study") ? 120 : 0;

  return laptop.valueScore + laptop.discountRate * 12 + purposeBonus + rangeBonus - distance * 0.05;
}

export default function HomePage() {
  const [showEducationPrice, setShowEducationPrice] = usePersistentBoolean(
    "edu-price-visible",
    false,
  );
  const [search, setSearch] = useState("");
  const [budget, setBudget] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [cpu, setCpu] = useState("all");
  const [ram, setRam] = useState("all");
  const [storage, setStorage] = useState("all");
  const [screen, setScreen] = useState("all");
  const [gpu, setGpu] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const bestDiscount = useMemo(() => getBestDiscount(laptops), []);
  const recommendedLaptops = useMemo(() => selectRecommended(laptops, 6), []);

  const filtered = useMemo(() => {
    const searchQuery = normalizeText(search);
    const budgetRange = getBudgetRange(budget);

    return laptops
      .map((laptop) => ({
        laptop,
        searchIndex: buildSearchText(laptop),
      }))
      .filter(({ laptop }) => laptop.eduPrice >= budgetRange.min && laptop.eduPrice <= budgetRange.max)
      .filter(({ laptop }) => purpose === "all" || laptop.purposes.includes(purpose))
      .filter(({ laptop }) => cpu === "all" || getCpuCategory(laptop.cpu) === cpu)
      .filter(({ laptop }) => ram === "all" || getRamCategory(laptop) === ram)
      .filter(({ laptop }) => storage === "all" || getStorageCategory(laptop) === storage)
      .filter(({ laptop }) => screen === "all" || getScreenCategory(laptop) === screen)
      .filter(({ laptop }) => gpu === "all" || getGpuCategory(laptop) === gpu)
      .filter(({ searchIndex }) => !searchQuery || searchIndex.includes(searchQuery))
      .sort((a, b) => scoreLaptop(b.laptop, sortMode) - scoreLaptop(a.laptop, sortMode));
  }, [budget, cpu, gpu, purpose, ram, screen, search, sortMode, storage]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => laptops.some((laptop) => laptop.id === id)),
    );
  }, []);

  const selectedLaptops = useMemo(
    () => selectedIds.map((id) => laptops.find((laptop) => laptop.id === id)).filter(Boolean) as Laptop[],
    [selectedIds],
  );

  const compareUrl = selectedIds.length ? `/compare?ids=${selectedIds.join(",")}` : "/compare";

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  }

  function clearFilters() {
    setSearch("");
    setBudget("all");
    setPurpose("all");
    setCpu("all");
    setRam("all");
    setStorage("all");
    setScreen("all");
    setGpu("all");
    setSortMode("match");
  }

  return (
    <main className="site-shell">
      <div className="page-frame">
        <div className="topbar">
          <div className="topbar-links">
            <Link className="link-pill" href="/compare">
              ??瘥?
            </Link>
            <Link className="link-pill" href="/update">
              ?湔敺
            </Link>
          </div>
        </div>

        <section className="hero section">
          <div className="hero-copy">
            <p className="eyebrow hero-strap">
              <button
                className="excel-toggle"
                onClick={() => setShowEducationPrice((current) => !current)}
                type="button"
                aria-label="????寥＊蝷?"
                title="EDUCATION"
              >
                EDUCATION
              </button>
              <span> LAPTOP SELECTOR</span>
            </p>
            <h1>憭批???寧??餅??詨</h1>
            <p>
              靘?Excel ?抒???璈?嚗翰?????PU?AM?SD?撟?憿舐內?∠葬撠???              ?身?梯???對??芣?暺?憿??Ｙ? `EDUCATION` ????憿舐內嚗??寡??隞?靽???
            </p>
            <div className="hero-metrics">
              <span className="metric">{laptops.length} ?唳???</span>
              <span className="metric">{purposeOptions.length - 1} 蝔桃??</span>
              <span className="metric">?雿單???{formatMoney(bestDiscount.discount)}</span>
            </div>
          </div>

          <aside className="hero-card carousel-recommend" aria-label="23000 ??30000 ?刻璈?">
            <div className="hero-card-head">
              <strong>23000 ~ 30000</strong>
              <span className="toggle-pill">{recommendedLaptops.length} ?唳??</span>
            </div>

            <div className="carousel-shell">
              <div className="carousel">
                {recommendedLaptops.map((laptop) => (
                  <article className="mini-card" key={laptop.id}>
                    <LaptopMedia laptop={laptop} />
                    <div className="mini-card-body">
                      <p className="family">{laptop.family}</p>
                      <h3>{laptop.model}</h3>
                      <div className="price-stack">
                        <strong className="edu">
                          <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
                        </strong>
                        <span className="market">撣 {formatMoney(laptop.marketPrice)}</span>
                      </div>
                      <div className="discount-line">
                        ?桀??擃???{formatMoney(laptop.discount)}
                        {laptop.discountRate ? ` 繚 ${formatDiscountFold(laptop.discountRate)}` : ""}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="panel section">
          <div className="toolbar">
            <div className="search-field" style={{ flex: "1 1 280px" }}>
              <label htmlFor="search">??璈??PU???</label>
              <input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="頛詨璈?隞???PU????萄?"
              />
            </div>

            <div className="field" style={{ flex: "0 0 200px" }}>
              <label htmlFor="budget">??</label>
              <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                {budgetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ flex: "0 0 180px" }}>
              <label htmlFor="sort">??</label>
              <select
                id="sort"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="button-soft" onClick={clearFilters} type="button">
              皜璇辣
            </button>
          </div>

          <div className="filter-row">
            <FieldSelect label="?券?" value={purpose} onChange={setPurpose} options={purposeOptions} />
            <FieldSelect label="CPU" value={cpu} onChange={setCpu} options={cpuOptions} />
            <FieldSelect label="RAM" value={ram} onChange={setRam} options={ramOptions} />
            <FieldSelect label="SSD" value={storage} onChange={setStorage} options={storageOptions} />
            <FieldSelect label="LCD" value={screen} onChange={setScreen} options={screenOptions} />
            <FieldSelect label="憿舐內?" value={gpu} onChange={setGpu} options={gpuOptions} />
          </div>

          <div className="summary-strip">
            <div className="summary-stat">
              <span>?桀?憿舐內</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="summary-stat">
              <span>撌脤瘥?</span>
              <strong>{selectedIds.length}</strong>
            </div>
            <div className="summary-stat">
              <span>???機型</span>
              <strong>{laptops.length}</strong>
            </div>
            <div className="summary-stat">
              <span>?寞??</span>
              <strong>{showEducationPrice ? "憿舐內" : "?梯?"}</strong>
            </div>
          </div>
        </section>

        <section className="panel section">
          <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">?券蝯?</p>
              <h2>靘?Excel 璈?蝭拚敺?皜</h2>
            </div>
            <span className="toggle-pill">{filtered.length} ?筆</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <strong>瘝?蝚血???</strong>
              <span>隢撖祇?蝞????典?銝?璇辣嚗xcel 憭?璈?銝?鋡怠??乓?</span>
            </div>
          ) : (
            <div className="results-grid">
              {filtered.map(({ laptop }, index) => (
                <LaptopCard
                  key={laptop.id}
                  laptop={laptop}
                  onToggleSelected={toggleSelected}
                  selected={selectedIds.includes(laptop.id)}
                  showEducationPrice={showEducationPrice}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedIds.length > 0 && (
        <div className="compare-bar">
          <div className="summary">
            <strong>{selectedIds.length} ?台已勾選</strong>
            <span>{selectedLaptops.map((item) => item.model).join("、")}</span>
          </div>
          <div className="topbar-links">
            <button
              className="button-ghost"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              皜征
            </button>
            <Link className="button-action" href={compareUrl}>
              ??瘥?
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="field" style={{ flex: "1 1 180px" }}>
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LaptopCard({
  laptop,
  selected,
  onToggleSelected,
  showEducationPrice,
}: {
  laptop: Laptop;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  showEducationPrice: boolean;
}) {
  const purposes = splitList(laptop.purposes).slice(0, 4);
  const highlights = splitList(laptop.highlights).slice(0, 4);

  return (
    <article className="laptop-card">
      <LaptopMedia laptop={laptop} />

      <div className="card-body">
        <div className="card-topline">
          <div>
            <p className="family">{laptop.family}</p>
            <h3>{laptop.model}</h3>
          </div>
          <span className="toggle-pill">??{Math.round(laptop.valueScore)}</span>
        </div>

        <p className="model-title">{laptop.title}</p>

        <div className="price-row">
          <strong className="edu">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </strong>
          <span className="market">撣 {formatMoney(laptop.marketPrice)}</span>
        </div>

        <div className="discount-line">
          ?桀??擃???{formatMoney(laptop.discount)}
          {laptop.discountRate ? ` 繚 ${formatDiscountFold(laptop.discountRate)}` : ""}
        </div>

        <div className="tag-row">
          {purposes.map((item) => (
            <span className="tag" key={item}>
              {getPurposeLabel(item)}
            </span>
          ))}
        </div>

        <dl className="info-grid">
          <div>
            <dt>CPU</dt>
            <dd>{laptop.cpu}</dd>
          </div>
          <div>
            <dt>RAM</dt>
            <dd>{laptop.memory}</dd>
          </div>
          <div>
            <dt>SSD</dt>
            <dd>{laptop.storage}</dd>
          </div>
          <div>
            <dt>LCD</dt>
            <dd>{laptop.display}</dd>
          </div>
          <div>
            <dt>憿舐內?</dt>
            <dd>{laptop.gpu}</dd>
          </div>
          <div>
            <dt>?? / 靽</dt>
            <dd>
              {laptop.weight} 繚 {laptop.warranty}
            </dd>
          </div>
        </dl>

        <div className="tag-row">
          {highlights.map((item) => (
            <span className="filter-chip" key={item}>
              {item}
            </span>
          ))}
        </div>

        <div className="compare-row">
          <label>
            <input
              checked={selected}
              onChange={() => onToggleSelected(laptop.id)}
              type="checkbox"
            />
            ?暸瘥?
          </label>
          <Link className="link-pill" href={`/compare?ids=${laptop.id}`}>
            ?格?瑼Ｚ?
          </Link>
        </div>
      </div>
    </article>
  );
}

function LaptopMedia({ laptop }: { laptop: Laptop }) {
  const sources = useMemo(() => getGalleryCandidates(laptop), [laptop]);
  const [visibleSources, setVisibleSources] = useState<string[]>(sources);
  const [index, setIndex] = useState(0);
  const activeSource = visibleSources[index] ?? visibleSources[0] ?? null;

  useEffect(() => {
    setVisibleSources(sources);
    setIndex(0);
  }, [sources]);

  useEffect(() => {
    if (visibleSources.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % visibleSources.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [visibleSources.length]);

  return (
    <div className="card-media">
      {activeSource ? (
        <Image
          alt={laptop.title}
          className="machine-image"
          fill
          onError={() => {
            setVisibleSources((current) => current.filter((item) => item !== activeSource));
            setIndex(0);
          }}
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw"
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
