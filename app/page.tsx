"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  getModelDisplayName,
} from "./catalog";
import { useCatalog } from "./catalog-client";
import { laptops as fallbackLaptops, type Laptop } from "./laptop-data";

type SortMode = "match" | "price" | "saving" | "performance" | "value";
type MobileGpuMode = "all" | "igpu" | "dgpu";
type MobileBudgetMode = "all" | "under-30000" | "30000-40000" | "40000-50000" | "50000-plus";

const sortOptions = [
  { value: "match", label: "最符合" },
  { value: "price", label: "價格最低" },
  { value: "saving", label: "折扣最多" },
  { value: "performance", label: "效能優先" },
  { value: "value", label: "CP 值" },
] as const;

function EducationPrice({ showEducationPrice, price }: { showEducationPrice: boolean; price: number }) {
  return showEducationPrice ? (
    formatMoney(price)
  ) : (
    <Link className="quote-link" href="https://lin.ee/Y9sCx0K" rel="noreferrer" target="_blank">
      報價請洽服務人員
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

function getMobileGpuMode(laptop: Laptop): "igpu" | "dgpu" {
  const text = `${laptop.gpu} ${laptop.title} ${laptop.model}`.toLowerCase();
  if (text.includes("rtx")) {
    return "dgpu";
  }
  return "igpu";
}

function getMobileBudgetMode(price: number): Exclude<MobileBudgetMode, "all"> {
  if (price <= 30000) return "under-30000";
  if (price <= 40000) return "30000-40000";
  if (price <= 50000) return "40000-50000";
  return "50000-plus";
}

function matchesSearchTokens(laptop: Laptop, tokens: string[]) {
  if (!tokens.length) return true;

  const haystack = buildSearchText(laptop);
  const ramCategory = getRamCategory(laptop);
  const storageCategory = getStorageCategory(laptop);
  const gpuCategory = getGpuCategory(laptop);
  const screenCategory = getScreenCategory(laptop);

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;

    if (["8g", "8gb"].includes(token)) return ramCategory === "8g";
    if (["16g", "16gb"].includes(token)) return ramCategory === "16g";
    if (["16g2", "16g*2", "16gx2"].includes(token)) return ramCategory === "16g-2";
    if (["32g", "32gb"].includes(token)) return ramCategory === "32g";
    if (["32g2", "32g*2", "32gx2"].includes(token)) return ramCategory === "32g-2";
    if (["64g", "64gb"].includes(token)) return ramCategory === "64g";
    if (["128g", "128gb"].includes(token)) return ramCategory === "128g";

    if (["512g", "512gb", "512ssd"].includes(token)) return storageCategory === "512";
    if (["1t", "1tb", "1024gb"].includes(token)) return storageCategory === "1024";
    if (["2t", "2tb", "2048gb"].includes(token)) return storageCategory === "2048";
    if (["4t", "4tb", "4096gb"].includes(token)) return storageCategory === "4096";

    if (["igpu", "內顯", "內建顯卡"].includes(token)) return gpuCategory === "igpu";
    if (["dgpu", "獨顯", "獨立顯卡"].includes(token)) return gpuCategory !== "igpu";
    if (["rtx4050", "rtx-4050"].includes(token)) return gpuCategory === "rtx-4050";
    if (["rtx4060", "rtx-4060"].includes(token)) return gpuCategory === "rtx-4060";
    if (["rtx4070", "rtx-4070"].includes(token)) return gpuCategory === "rtx-4070";
    if (["rtx5060", "rtx-5060"].includes(token)) return gpuCategory === "rtx-5060";
    if (["rtx5070", "rtx-5070"].includes(token)) return gpuCategory === "rtx-5070";

    if (["13吋", "13", "13inch"].includes(token)) return screenCategory === "13";
    if (["14吋", "14", "14inch"].includes(token)) return screenCategory === "14";
    if (["15吋", "15", "15inch"].includes(token)) return screenCategory === "15";
    if (["16吋", "16", "16inch"].includes(token)) return screenCategory === "16";

    return false;
  });
}

const mobileGpuCards: Array<{ value: Exclude<MobileGpuMode, "all">; label: string; accent: string; note: string }> = [
  { value: "igpu", label: "內建顯卡", accent: "mobile-card--red", note: "輕便 / 文書 / 日常" },
  { value: "dgpu", label: "獨立顯卡", accent: "mobile-card--blue", note: "遊戲 / 創作 / 效能" },
];

const mobileBudgetCards: Array<{
  value: Exclude<MobileBudgetMode, "all">;
  label: string;
  accent: string;
  note: string;
}> = [
  { value: "under-30000", label: "30000元以下", accent: "mobile-card--yellow", note: "入門預算" },
  { value: "30000-40000", label: "30000~40000元", accent: "mobile-card--green", note: "主流選擇" },
  { value: "40000-50000", label: "40000~50000元", accent: "mobile-card--purple", note: "升級效能" },
  { value: "50000-plus", label: "50000元以上", accent: "mobile-card--teal", note: "高階旗艦" },
];

export default function HomePage() {
  const { catalog: laptops } = useCatalog(fallbackLaptops);
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
  const [mobileGpu, setMobileGpu] = useState<MobileGpuMode>("all");
  const [mobileBudget, setMobileBudget] = useState<MobileBudgetMode>("all");
  const [mobileExpandedId, setMobileExpandedId] = useState<string | null>(null);
  const mobileResultsRef = useRef<HTMLDivElement | null>(null);
  const bestDiscount = useMemo(() => getBestDiscount(laptops), []);
  const recommendedLaptops = useMemo(() => selectRecommended(laptops, 6), []);
  const normalizedSearch = normalizeText(search);
  const searchTokens = useMemo(() => normalizedSearch.split(/\s+/).filter(Boolean), [normalizedSearch]);
  const desktopSearchActive = searchTokens.length > 0;
  const desktopFiltersActive =
    desktopSearchActive ||
    budget !== "all" ||
    purpose !== "all" ||
    cpu !== "all" ||
    ram !== "all" ||
    storage !== "all" ||
    screen !== "all" ||
    gpu !== "all";

  const filtered = useMemo(() => {
    const budgetRange = getBudgetRange(budget);

    return laptops
      .map((laptop) => ({ laptop }))
      .filter(({ laptop }) => laptop.eduPrice >= budgetRange.min && laptop.eduPrice <= budgetRange.max)
      .filter(({ laptop }) => purpose === "all" || laptop.purposes.includes(purpose))
      .filter(({ laptop }) => cpu === "all" || getCpuCategory(laptop.cpu) === cpu)
      .filter(({ laptop }) => ram === "all" || getRamCategory(laptop) === ram)
      .filter(({ laptop }) => storage === "all" || getStorageCategory(laptop) === storage)
      .filter(({ laptop }) => screen === "all" || getScreenCategory(laptop) === screen)
      .filter(({ laptop }) => gpu === "all" || getGpuCategory(laptop) === gpu)
      .filter(({ laptop }) => matchesSearchTokens(laptop, searchTokens))
      .sort((a, b) => scoreLaptop(b.laptop, sortMode) - scoreLaptop(a.laptop, sortMode));
  }, [budget, cpu, gpu, purpose, ram, screen, searchTokens, sortMode, storage]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => laptops.some((laptop) => laptop.id === id)),
    );
  }, []);

  const selectedLaptops = useMemo(
    () => selectedIds.map((id) => laptops.find((laptop) => laptop.id === id)).filter(Boolean) as Laptop[],
    [selectedIds],
  );

  const mobileFiltered = useMemo(
    () =>
      [...laptops]
        .filter((laptop) => mobileGpu === "all" || getMobileGpuMode(laptop) === mobileGpu)
        .filter((laptop) => mobileBudget === "all" || getMobileBudgetMode(laptop.eduPrice) === mobileBudget)
        .sort((a, b) => a.eduPrice - b.eduPrice || b.valueScore - a.valueScore),
    [laptops, mobileBudget, mobileGpu],
  );

  const mobileHasSelection = mobileGpu !== "all" && mobileBudget !== "all";

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

  function resetMobileFilters() {
    setMobileGpu("all");
    setMobileBudget("all");
    setMobileExpandedId(null);
  }

  useEffect(() => {
    if (!mobileHasSelection) return;
    mobileResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mobileBudget, mobileGpu, mobileHasSelection]);

  return (
    <main className="site-shell">
      <div className="page-frame">
        <div className="topbar">
          <div className="topbar-links desktop-only">
            <Link className="link-pill" href="/compare">
              多機比較
            </Link>          </div>
        </div>

        <section className="mobile-launch mobile-only">
          <div className="mobile-launch-copy">
            <p className="eyebrow">
              <button
                className="excel-toggle"
                onClick={() => setShowEducationPrice((current) => !current)}
                type="button"
                aria-label="切換手機版教育價顯示"
                title="MOBILE"
              >
                MOBILE
              </button>
              <span> QUICK PICK</span>
            </p>
            <h1>手機快速選機</h1>
            <p>先點顯卡，再點預算，直接進到對應清單。</p>
          </div>

          <div className="mobile-card-group">
            <div className="mobile-card-group-head">
              <strong>顯卡類型</strong>
              <span>先選這一組</span>
            </div>
            <div className="mobile-card-grid mobile-card-grid--two">
              {mobileGpuCards.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  className={`mobile-choice-card ${card.accent} ${mobileGpu === card.value ? "is-active" : ""}`}
                  onClick={() => setMobileGpu(card.value)}
                >
                  <span className="mobile-choice-kicker">GPU</span>
                  <strong>{card.label}</strong>
                  <span>{card.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mobile-card-group">
            <div className="mobile-card-group-head">
              <strong>教育價範圍</strong>
              <span>再選這一組</span>
            </div>
            <div className="mobile-card-grid mobile-card-grid--four">
              {mobileBudgetCards.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  className={`mobile-choice-card ${card.accent} ${mobileBudget === card.value ? "is-active" : ""}`}
                  onClick={() => setMobileBudget(card.value)}
                >
                  <span className="mobile-choice-kicker">PRICE</span>
                  <strong>{card.label}</strong>
                  <span>{card.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mobile-launch-actions">
            <button className="button-soft mobile-reset" onClick={resetMobileFilters} type="button">
              重設選擇
            </button>
            <span className="mobile-launch-tip">
              已選 {mobileGpu === "all" ? "顯卡" : mobileGpu === "igpu" ? "內建顯卡" : "獨立顯卡"}
              {mobileBudget === "all" ? " + 預算" : ` + ${mobileBudgetCards.find((item) => item.value === mobileBudget)?.label ?? ""}`}
            </span>
          </div>
        </section>

        <section className="hero section desktop-only">
          <div className="hero-copy">
            <p className="eyebrow hero-strap">
              <button
                className="excel-toggle"
                onClick={() => setShowEducationPrice((current) => !current)}
                type="button"
                aria-label="切換教育價顯示"
                title="EDUCATION"
              >
                EDUCATION
              </button>
              <span> LAPTOP SELECTOR</span>
            </p>
            <h1>大專教育價筆電挑選器</h1>
            <p>
              依 Excel 內的限定機型，快速用預算、用途、CPU、RAM、SSD、螢幕與顯示卡縮小範圍。
            </p>
            <div className="hero-metrics">
              <span className="metric">{laptops.length} 台機型</span>
              <span className="metric">{purposeOptions.length - 1} 種用途</span>
              <span className="metric">最佳折扣 {formatMoney(bestDiscount.discount)}</span>
            </div>
          </div>

          {!desktopSearchActive && (
            <aside className="hero-card carousel-recommend" aria-label="23000 到 30000 推薦機型">
              <div className="hero-card-head">
                <strong>23000 ~ 30000</strong>
              </div>

              <div className="carousel-shell">
                <div className="carousel">
                  {recommendedLaptops.map((laptop) => (
                    <article className="mini-card" key={laptop.id}>
                      <LaptopMedia laptop={laptop} />
                      <div className="mini-card-body">
                        <p className="family">{laptop.family}</p>
                        <h3>{getModelDisplayName(laptop)}</h3>
                        <div className="price-stack">
                          <strong className="edu">
                            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
                          </strong>
                          <span className="market">市價 {formatMoney(laptop.marketPrice)}</span>
                        </div>
                        <div className="discount-line">
                          目前最高折扣 {formatMoney(laptop.discount)}
                          {laptop.discountRate ? ` · ${formatDiscountFold(laptop.discountRate)}` : ""}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </section>

        <section className="panel section desktop-only">
          <div className="toolbar">
            <div className="search-field" style={{ flex: "1 1 280px" }}>
              <label htmlFor="search">搜尋機型、CPU、用途</label>
              <input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="輸入機型代號、CPU、用途關鍵字"
              />
            </div>

            <div className="field" style={{ flex: "0 0 200px" }}>
              <label htmlFor="budget">預算</label>
              <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                {budgetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ flex: "0 0 180px" }}>
              <label htmlFor="sort">排序</label>
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
              清除條件
            </button>
          </div>

          <div className="filter-row">
            <FieldSelect label="用途" value={purpose} onChange={setPurpose} options={purposeOptions} />
            <FieldSelect label="CPU" value={cpu} onChange={setCpu} options={cpuOptions} />
            <FieldSelect label="RAM" value={ram} onChange={setRam} options={ramOptions} />
            <FieldSelect label="SSD" value={storage} onChange={setStorage} options={storageOptions} />
            <FieldSelect label="LCD" value={screen} onChange={setScreen} options={screenOptions} />
            <FieldSelect label="顯示卡" value={gpu} onChange={setGpu} options={gpuOptions} />
          </div>

          <div className="summary-strip">
            <div className="summary-stat">
              <span>目前顯示</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="summary-stat">
              <span>已選比較</span>
              <strong>{selectedIds.length}</strong>
            </div>
            <div className="summary-stat">
              <span>{desktopSearchActive ? "搜尋命中" : "所有機型"}</span>
              <strong>{desktopSearchActive ? filtered.length : laptops.length}</strong>
            </div>
            <div className="summary-stat">
              <span>價格切換</span>
              <strong>{showEducationPrice ? "顯示" : "隱藏"}</strong>
            </div>
          </div>
        </section>

        {desktopFiltersActive && (
          <section className="panel section desktop-only">
            <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p className="eyebrow">搜尋結果</p>
                <h2>符合條件的機種</h2>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <strong>沒有符合的機型</strong>
                <span>請放寬預算或取消部分下拉條件，Excel 外的機型不會被加入。</span>
              </div>
            ) : (
              <div className="results-grid">
                {filtered.map(({ laptop }) => (
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
        )}
      </div>

      <section className="mobile-results mobile-only" ref={mobileResultsRef}>
        <div className="mobile-results-head">
          <div>
            <p className="eyebrow">matching list</p>
            <h2>對應機種清單</h2>
          </div>
        </div>

        {!mobileHasSelection ? (
          <div className="mobile-empty">
            <strong>先選顯卡，再選預算</strong>
            <span>手機版會直接把清單縮到你要看的範圍。</span>
          </div>
        ) : mobileFiltered.length === 0 ? (
          <div className="mobile-empty">
            <strong>沒有符合條件的機種</strong>
            <span>可以換另一個顯卡或價位組合試試。</span>
          </div>
        ) : (
          <div className="mobile-results-list">
            {mobileFiltered.map((laptop) => (
              <MobileLaptopCard
                key={laptop.id}
                laptop={laptop}
                onToggleExpanded={() =>
                  setMobileExpandedId((current) => (current === laptop.id ? null : laptop.id))
                }
                selected={mobileExpandedId === laptop.id}
                showEducationPrice={showEducationPrice}
              />
            ))}
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <div className="compare-bar">
          <div className="summary">
            <strong>{selectedIds.length} 台已勾選</strong>
            <span>{selectedLaptops.map((item) => getModelDisplayName(item)).join("、")}</span>
          </div>
          <div className="topbar-links">
            <button
              className="button-ghost"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              清空
            </button>
            <Link className="button-action" href={compareUrl}>
              前往比較
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
            <h3>{getModelDisplayName(laptop)}</h3>
          </div>
        </div>

        <p className="model-title">{laptop.title}</p>

        <div className="price-row">
          <strong className="edu">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </strong>
          <span className="market">市價 {formatMoney(laptop.marketPrice)}</span>
        </div>

        <div className="discount-line">
          目前最高折扣 {formatMoney(laptop.discount)}
          {laptop.discountRate ? ` · ${formatDiscountFold(laptop.discountRate)}` : ""}
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
            <dt>顯示卡</dt>
            <dd>{laptop.gpu}</dd>
          </div>
          <div>
            <dt>重量 / 保固</dt>
            <dd>
              {laptop.weight} · {laptop.warranty}
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
            勾選比較
          </label>
          <Link className="link-pill" href={`/compare?ids=${laptop.id}`}>
            單機檢視
          </Link>
        </div>
      </div>
    </article>
  );
}

function MobileLaptopCard({
  laptop,
  onToggleExpanded,
  selected,
  showEducationPrice,
}: {
  laptop: Laptop;
  onToggleExpanded: () => void;
  selected: boolean;
  showEducationPrice: boolean;
}) {
  const highlightItems = splitList(laptop.highlights);
  const purposeItems = splitList(laptop.purposes).slice(0, 4);

  return (
    <article
      className={`mobile-result-card ${selected ? "is-expanded" : ""}`}
      onClick={onToggleExpanded}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onToggleExpanded();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="mobile-result-media">
        <LaptopMedia laptop={laptop} />
      </div>
      <div className="mobile-result-body">
        <div className="mobile-result-top">
          <div>
            <p className="family">{laptop.family}</p>
            <h3>{getModelDisplayName(laptop)}</h3>
          </div>
        </div>

        <div className="mobile-result-tags">
          <span className="mobile-chip mobile-chip--red">{getMobileGpuMode(laptop) === "igpu" ? "內建顯卡" : "獨立顯卡"}</span>
          <span className="mobile-chip mobile-chip--yellow mobile-chip--price">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </span>
          <span className="mobile-chip mobile-chip--green">{laptop.screenSize ? `${laptop.screenSize} 吋` : "其他尺寸"}</span>
        </div>

        <div className="mobile-result-prices">
          <strong className="edu">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </strong>
          <span className="market">市價 {formatMoney(laptop.marketPrice)}</span>
          <span className="discount-line">
            省下 {formatMoney(laptop.discount)}
            {laptop.discountRate ? `，${formatDiscountFold(laptop.discountRate)}` : ""}
          </span>
        </div>
        <div className="mobile-result-detail">
          <strong>{selected ? "點擊收合詳細規格" : "點選查看詳細規格"}</strong>
          <span>{selected ? "已展開完整資訊" : "包含 CPU、RAM、SSD、LCD、顯示卡、重量與保固"}</span>
        </div>

        {selected && (
          <div className="mobile-result-detail-panel">
            <dl className="mobile-spec-list">
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
                <dt>顯示卡</dt>
                <dd>{laptop.gpu}</dd>
              </div>
              <div>
                <dt>重量</dt>
                <dd>{laptop.weight}</dd>
              </div>
              <div>
                <dt>保固</dt>
                <dd>{laptop.warranty}</dd>
              </div>
              <div>
                <dt>配件</dt>
                <dd>{laptop.bundle}</dd>
              </div>
            </dl>

            {purposeItems.length > 0 && (
              <div className="mobile-detail-chips">
                {purposeItems.map((item) => (
                  <span className="mobile-chip mobile-chip--green" key={item}>
                    {getPurposeLabel(item)}
                  </span>
                ))}
              </div>
            )}

            {highlightItems.length > 0 && (
              <div className="mobile-detail-highlights">
                {highlightItems.map((item) => (
                  <span className="filter-chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
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
          <strong>圖片待補</strong>
          <span>{getModelDisplayName(laptop)}</span>
        </div>
      )}
    </div>
  );
}

