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
  { value: "match", label: "?ÄÁ¨¶Â?" },
  { value: "price", label: "?πÊ†º?Ä‰Ω? },
  { value: "saving", label: "?òÊâ£?ÄÂ§? },
  { value: "performance", label: "?àËÉΩ?™Â?" },
  { value: "value", label: "CP ?? },
] as const;

function EducationPrice({ showEducationPrice, price }: { showEducationPrice: boolean; price: number }) {
  return showEducationPrice ? (
    formatMoney(price)
  ) : (
    <Link className="quote-link" href="https://lin.ee/Y9sCx0K" rel="noreferrer" target="_blank">
      ?±ÂÉπË´ãÊ¥Ω?çÂ?‰∫∫Âì°
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
  if (
    text.includes("rtx") ||
    text.includes("geforce") ||
    text.includes("radeon") ||
    text.includes("arc") ||
    text.includes("iris") ||
    text.includes("geforce rtx")
  ) {
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

const mobileGpuCards: Array<{ value: Exclude<MobileGpuMode, "all">; label: string; accent: string; note: string }> = [
  { value: "igpu", label: "?ßÂª∫È°ØÂç°", accent: "mobile-card--red", note: "Ëºï‰æø / ?áÊõ∏ / ?•Â∏∏" },
  { value: "dgpu", label: "?®Á?È°ØÂç°", accent: "mobile-card--blue", note: "?äÊà≤ / ?µ‰? / ?àËÉΩ" },
];

const mobileBudgetCards: Array<{
  value: Exclude<MobileBudgetMode, "all">;
  label: string;
  accent: string;
  note: string;
}> = [
  { value: "under-30000", label: "30000?É‰ª•‰∏?, accent: "mobile-card--yellow", note: "?•È??êÁ?" },
  { value: "30000-40000", label: "30000~40000??, accent: "mobile-card--green", note: "‰∏ªÊ??∏Ê?" },
  { value: "40000-50000", label: "40000~50000??, accent: "mobile-card--purple", note: "?áÁ??àËÉΩ" },
  { value: "50000-plus", label: "50000?É‰ª•‰∏?, accent: "mobile-card--teal", note: "È´òÈ??óËâ¶" },
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
  const mobileResultsRef = useRef<HTMLDivElement | null>(null);
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

  const mobileFiltered = useMemo(() => {
    return [...laptops]
      .filter((laptop) => mobileGpu === "all" || getMobileGpuMode(laptop) === mobileGpu)
      .filter((laptop) => mobileBudget === "all" || getMobileBudgetMode(laptop.eduPrice) === mobileBudget)
      .sort((a, b) => a.eduPrice - b.eduPrice || b.valueScore - a.valueScore);
  }, [laptops, mobileBudget, mobileGpu]);

  const mobileHasSelection = mobileGpu !== "all" || mobileBudget !== "all";

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
  }

  useEffect(() => {
    if (!mobileHasSelection) return;
    mobileResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [mobileBudget, mobileGpu, mobileHasSelection]);

  return (
    <main className="site-shell">
      <div className="page-frame">
        <div className="topbar">
          <div className="topbar-links">
            <Link className="link-pill" href="/compare">
              Â§öÊ?ÊØîË?
            </Link>
            <Link className="link-pill" href="/update">
              ?¥Êñ∞ÂæåÂè∞
            </Link>
          </div>
        </div>

        <section className="mobile-launch mobile-only">
          <div className="mobile-launch-copy">
            <p className="eyebrow">mobile quick pick</p>
            <h1>?ãÊ?Âø´ÈÄüÈÅ∏Ê©?/h1>
            <p>?àÈ?È°ØÂç°ÔºåÂ?ÈªûÈ?ÁÆóÔ??¥Êé•?≤Âà∞Â∞çÊ?Ê∏ÖÂñÆ??/p>
          </div>

          <div className="mobile-card-group">
            <div className="mobile-card-group-head">
              <strong>È°ØÂç°È°ûÂ?</strong>
              <span>?àÈÅ∏?ô‰?Áµ?/span>
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
              <strong>?ôËÇ≤?πÁ???/strong>
              <span>?çÈÅ∏?ô‰?Áµ?/span>
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
              ?çË®≠?∏Ê?
            </button>
            <span className="mobile-launch-tip">
              Â∑≤ÈÅ∏ {mobileGpu === "all" ? "È°ØÂç°" : mobileGpu === "igpu" ? "?ßÂª∫È°ØÂç°" : "?®Á?È°ØÂç°"}
              {mobileBudget === "all" ? " + ?êÁ?" : ` + ${mobileBudgetCards.find((item) => item.value === mobileBudget)?.label ?? ""}`}
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
                aria-label="?áÊ??ôËÇ≤?πÈ°ØÁ§?
                title="EDUCATION"
              >
                EDUCATION
              </button>
              <span> LAPTOP SELECTOR</span>
            </p>
            <h1>Â§ßÂ??ôËÇ≤?πÁ??ªÊ??∏Âô®</h1>
            <p>
              ‰æ?Excel ?ßÁ??êÂ?Ê©üÂ?ÔºåÂø´?üÁî®?êÁ??ÅÁî®?î„ÄÅCPU?ÅRAM?ÅSSD?ÅËû¢ÂπïË?È°ØÁ§∫?°Á∏ÆÂ∞èÁ??ç„Ä?
              ?êË®≠?±Ë??ôËÇ≤?πÔ??™Ê?ÈªûÊ?È°åÂ??¢Á? `EDUCATION` ?çÊ??áÊ?È°ØÁ§∫ÔºåÂ??πË??òÊâ£‰ªçÊ?‰øùÁ???
            </p>
            <div className="hero-metrics">
              <span className="metric">{laptops.length} ?∞Ê???/span>
              <span className="metric">{purposeOptions.length - 1} Á®ÆÁî®??/span>
              <span className="metric">?Ä‰Ω≥Ê???{formatMoney(bestDiscount.discount)}</span>
            </div>
          </div>

          <aside className="hero-card carousel-recommend" aria-label="23000 ??30000 ?®Ëñ¶Ê©üÂ?">
            <div className="hero-card-head">
              <strong>23000 ~ 30000</strong>
              <span className="toggle-pill">{recommendedLaptops.length} ?∞Êé®??/span>
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
                        <span className="market">Â∏ÇÂÉπ {formatMoney(laptop.marketPrice)}</span>
                      </div>
                      <div className="discount-line">
                        ?ÆÂ??ÄÈ´òÊ???{formatMoney(laptop.discount)}
                        {laptop.discountRate ? ` ¬∑ ${formatDiscountFold(laptop.discountRate)}` : ""}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="panel section desktop-only">
          <div className="toolbar">
            <div className="search-field" style={{ flex: "1 1 280px" }}>
              <label htmlFor="search">?úÂ?Ê©üÂ??ÅCPU?ÅÁî®??/label>
              <input
                id="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ëº∏ÂÖ•Ê©üÂ?‰ª???ÅCPU?ÅÁî®?îÈ??µÂ?"
              />
            </div>

            <div className="field" style={{ flex: "0 0 200px" }}>
              <label htmlFor="budget">?êÁ?</label>
              <select id="budget" value={budget} onChange={(event) => setBudget(event.target.value)}>
                {budgetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field" style={{ flex: "0 0 180px" }}>
              <label htmlFor="sort">?íÂ?</label>
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
              Ê∏ÖÈô§Ê¢ù‰ª∂
            </button>
          </div>

          <div className="filter-row">
            <FieldSelect label="?®ÈÄ? value={purpose} onChange={setPurpose} options={purposeOptions} />
            <FieldSelect label="CPU" value={cpu} onChange={setCpu} options={cpuOptions} />
            <FieldSelect label="RAM" value={ram} onChange={setRam} options={ramOptions} />
            <FieldSelect label="SSD" value={storage} onChange={setStorage} options={storageOptions} />
            <FieldSelect label="LCD" value={screen} onChange={setScreen} options={screenOptions} />
            <FieldSelect label="È°ØÁ§∫?? value={gpu} onChange={setGpu} options={gpuOptions} />
          </div>

          <div className="summary-strip">
            <div className="summary-stat">
              <span>?ÆÂ?È°ØÁ§∫</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="summary-stat">
              <span>Â∑≤ÈÅ∏ÊØîË?</span>
              <strong>{selectedIds.length}</strong>
            </div>
            <div className="summary-stat">
              <span>?Ä?âÊ???/span>
              <strong>{laptops.length}</strong>
            </div>
            <div className="summary-stat">
              <span>?πÊ†º?áÊ?</span>
              <strong>{showEducationPrice ? "È°ØÁ§∫" : "?±Ë?"}</strong>
            </div>
          </div>
        </section>

        <section className="panel section desktop-only">
          <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">?®ÈÉ®ÁµêÊ?</p>
              <h2>‰æ?Excel Ê©üÂ?ÁØ©ÈÅ∏ÂæåÁ?Ê∏ÖÂñÆ</h2>
            </div>
            <span className="toggle-pill">{filtered.length} Á≠?/span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <strong>Ê≤íÊ?Á¨¶Â??ÑÊ???/strong>
              <span>Ë´ãÊîæÂØ¨È?ÁÆóÊ??ñÊ??®Â?‰∏ãÊ?Ê¢ù‰ª∂ÔºåExcel Â§ñÁ?Ê©üÂ?‰∏çÊ?Ë¢´Â??•„Ä?/span>
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

      <section className="mobile-results mobile-only" ref={mobileResultsRef}>
        <div className="mobile-results-head">
          <div>
            <p className="eyebrow">matching list</p>
            <h2>Â∞çÊ?Ê©üÁ®ÆÊ∏ÖÂñÆ</h2>
          </div>
          <span className="toggle-pill">{mobileHasSelection ? `${mobileFiltered.length} ?∞` : "Ë´ãÂ??∏Ê?"}</span>
        </div>

        {!mobileHasSelection ? (
          <div className="mobile-empty">
            <strong>?àÈÅ∏È°ØÂç°ÔºåÂ??∏È?ÁÆ?/strong>
            <span>?ãÊ??àÊ??¥Êé•?äÊ??ÆÁ∏Æ?∞‰?Ë¶ÅÁ??ÑÁ??ç„Ä?/span>
          </div>
        ) : mobileFiltered.length === 0 ? (
          <div className="mobile-empty">
            <strong>Ê≤íÊ?Á¨¶Â?Ê¢ù‰ª∂?ÑÊ?Á®?/strong>
            <span>?Ø‰ª•?õÂè¶‰∏Ä?ãÈ°Ø?°Ê??π‰?ÁµÑÂ?Ë©¶Ë©¶??/span>
          </div>
        ) : (
          <div className="mobile-results-list">
            {mobileFiltered.map((laptop) => (
              <MobileLaptopCard key={laptop.id} laptop={laptop} showEducationPrice={showEducationPrice} />
            ))}
          </div>
        )}
      </section>

      {selectedIds.length > 0 && (
        <div className="compare-bar">
          <div className="summary">
            <strong>{selectedIds.length} ?∞Â∑≤?æÈÅ∏</strong>
            <span>{selectedLaptops.map((item) => getModelDisplayName(item)).join("??)}</span>
          </div>
          <div className="topbar-links">
            <button
              className="button-ghost"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              Ê∏ÖÁ©∫
            </button>
            <Link className="button-action" href={compareUrl}>
              ?çÂ?ÊØîË?
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
          <span className="toggle-pill">??{Math.round(laptop.valueScore)}</span>
        </div>

        <p className="model-title">{laptop.title}</p>

        <div className="price-row">
          <strong className="edu">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </strong>
          <span className="market">Â∏ÇÂÉπ {formatMoney(laptop.marketPrice)}</span>
        </div>

        <div className="discount-line">
          ?ÆÂ??ÄÈ´òÊ???{formatMoney(laptop.discount)}
          {laptop.discountRate ? ` ¬∑ ${formatDiscountFold(laptop.discountRate)}` : ""}
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
            <dt>È°ØÁ§∫??/dt>
            <dd>{laptop.gpu}</dd>
          </div>
          <div>
            <dt>?çÈ? / ‰øùÂõ∫</dt>
            <dd>
              {laptop.weight} ¬∑ {laptop.warranty}
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
            ?æÈÅ∏ÊØîË?
          </label>
          <Link className="link-pill" href={`/compare?ids=${laptop.id}`}>
            ?ÆÊ?Ê™¢Ë?
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
          <strong>?ñÁ?ÂæÖË?</strong>
          <span>{getModelDisplayName(laptop)}</span>
        </div>
      )}
    </div>
  );
}

function MobileLaptopCard({
  laptop,
  showEducationPrice,
}: {
  laptop: Laptop;
  showEducationPrice: boolean;
}) {
  return (
    <article className="mobile-result-card">
      <div className="mobile-result-media">
        <LaptopMedia laptop={laptop} />
      </div>
      <div className="mobile-result-body">
        <div className="mobile-result-top">
          <div>
            <p className="family">{laptop.family}</p>
            <h3>{getModelDisplayName(laptop)}</h3>
          </div>
          <span className="mobile-score">??{Math.round(laptop.valueScore)}</span>
        </div>

        <div className="mobile-result-tags">
          <span className="mobile-chip mobile-chip--red">{getMobileGpuMode(laptop) === "igpu" ? "?ßÂª∫È°ØÂç°" : "?®Á?È°ØÂç°"}</span>
          <span className="mobile-chip mobile-chip--yellow">{formatMoney(laptop.eduPrice)}</span>
          <span className="mobile-chip mobile-chip--green">{laptop.screenSize ? `${laptop.screenSize} ?ã` : "?∂‰?Â∞∫ÂØ∏"}</span>
        </div>

        <div className="mobile-result-prices">
          <strong className="edu">
            <EducationPrice showEducationPrice={showEducationPrice} price={laptop.eduPrice} />
          </strong>
          <span className="market">Â∏ÇÂÉπ {formatMoney(laptop.marketPrice)}</span>
          <span className="discount-line">
            ?Å‰? {formatMoney(laptop.discount)}
            {laptop.discountRate ? `Ôº?{formatDiscountFold(laptop.discountRate)}` : ""}
          </span>
        </div>
      </div>
    </article>
  );
}
