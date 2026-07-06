"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  budgetOptions,
  buildSearchText,
  cpuOptions,
  formatMoney,
  getBudgetLimit,
  getCpuCategory,
  getEducationPriceText,
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
  splitList,
  storageOptions,
  gpuOptions,
  getBestDiscount,
  getBudgetRange,
} from "./catalog";
import { laptops, type Laptop } from "./laptop-data";

type SortMode = "match" | "price" | "saving" | "performance" | "value";

const sortOptions = [
  { value: "match", label: "最符合" },
  { value: "price", label: "價格最低" },
  { value: "saving", label: "折扣最多" },
  { value: "performance", label: "效能優先" },
  { value: "value", label: "CP 值" },
] as const;

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
          <button
            className="excel-toggle"
            onClick={() => setShowEducationPrice((current) => !current)}
            type="button"
            aria-label="切換教育價顯示"
            title="EDUCATION"
          >
            <span className="signal" aria-hidden="true" />
            <strong>EDUCATION</strong>
          </button>

          <div className="topbar-links">
            <Link className="link-pill" href="/compare">
              多機比較
            </Link>
            <Link className="link-pill" href="/update">
              更新後台
            </Link>
          </div>
        </div>

        <section className="hero section">
          <div className="hero-copy">
            <p className="eyebrow">education laptop selector</p>
            <h1>大專教育價筆電挑選器</h1>
            <p>
              依 Excel 內的限定機型，快速用預算、用途、CPU、RAM、SSD、螢幕與顯示卡縮小範圍。
              預設隱藏教育價，只有點左上角的 `EDUCATION` 才會切換顯示，市價與折扣仍會保留。
            </p>
          <div className="hero-metrics">
              <span className="metric">{laptops.length} 台機型</span>
              <span className="metric">{purposeOptions.length - 1} 種用途</span>
              <span className="metric">最佳折扣 {formatMoney(bestDiscount.discount)}</span>
            </div>
          </div>
        </section>

        <section className="panel section">
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
              <span>所有機型</span>
              <strong>{laptops.length}</strong>
            </div>
            <div className="summary-stat">
              <span>價格切換</span>
              <strong>{showEducationPrice ? "顯示" : "隱藏"}</strong>
            </div>
          </div>
        </section>

        <section className="panel section">
          <div className="toolbar" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">全部結果</p>
              <h2>依 Excel 機型篩選後的清單</h2>
            </div>
            <span className="toggle-pill">{filtered.length} 筆</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <strong>沒有符合的機型</strong>
              <span>請放寬預算或取消部分下拉條件，Excel 外的機型不會被加入。</span>
            </div>
          ) : (
            <div className="results-grid">
              {filtered.map(({ laptop }, index) => (
                <LaptopCard
                  key={laptop.id}
                  laptop={laptop}
                  rank={index + 1}
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
            <strong>{selectedIds.length} 台已勾選</strong>
            <span>{selectedLaptops.map((item) => item.model).join("、")}</span>
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
  rank,
  selected,
  onToggleSelected,
  showEducationPrice,
}: {
  laptop: Laptop;
  rank?: number;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  showEducationPrice: boolean;
}) {
  const purposes = splitList(laptop.purposes).slice(0, 4);
  const highlights = splitList(laptop.highlights).slice(0, 4);

  return (
    <article className="laptop-card">
      <LaptopMedia laptop={laptop} badge={rank ? `#${rank}` : undefined} />

      <div className="card-body">
        <div className="card-topline">
          <div>
            <p className="family">{laptop.family}</p>
            <h3>{laptop.model}</h3>
          </div>
          <span className="toggle-pill">值 {Math.round(laptop.valueScore)}</span>
        </div>

        <p className="model-title">{laptop.title}</p>

        <div className="price-row">
          <strong className="edu">{getEducationPriceText(showEducationPrice, laptop.eduPrice)}</strong>
          <span className="market">市價 {formatMoney(laptop.marketPrice)}</span>
        </div>

        <div className="discount-line">
          目前最高折扣 {formatMoney(laptop.discount)}
          {laptop.discountRate ? ` · ${laptop.discountRate}%` : ""}
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

function LaptopMedia({ laptop, badge }: { laptop: Laptop; badge?: string }) {
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
      <div className="card-badges">
        {badge && <span className="badge">{badge}</span>}
        {laptop.imageKind && <span className="badge">{laptop.imageKind}</span>}
      </div>

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
          <span>{laptop.model}</span>
        </div>
      )}
    </div>
  );
}
