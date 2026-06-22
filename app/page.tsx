"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { laptops, type Laptop } from "./laptop-data";

type Intent = "all" | "study" | "portable" | "gaming" | "creator" | "large";
type SortMode = "match" | "price" | "saving" | "performance";

type RankedLaptop = {
  laptop: Laptop;
  score: number;
};

const intentOptions: Array<{ id: Intent; label: string }> = [
  { id: "all", label: "全部" },
  { id: "study", label: "上課 / 文書" },
  { id: "portable", label: "輕薄便攜" },
  { id: "gaming", label: "電競效能" },
  { id: "creator", label: "創作 / AI" },
  { id: "large", label: "大螢幕" },
];

const sortOptions: Array<{ id: SortMode; label: string }> = [
  { id: "match", label: "最符合需求" },
  { id: "price", label: "價格由低到高" },
  { id: "saving", label: "省最多優先" },
  { id: "performance", label: "效能由高到低" },
];

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

const maxBudget = Math.ceil(
  Math.max(...laptops.map((laptop) => laptop.eduPrice)) / 1000,
) * 1000;
const minBudget = Math.floor(
  Math.min(...laptops.map((laptop) => laptop.eduPrice)) / 1000,
) * 1000;
const families = Array.from(new Set(laptops.map((laptop) => laptop.family))).sort(
  (a, b) => a.localeCompare(b, "zh-Hant"),
);

function asList(value: string[] | string) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function formatPrice(value: number) {
  return currency.format(value);
}

function formatWeight(value: number | null) {
  return value ? `${value.toFixed(2)} kg` : "-";
}

function scoreLaptop(laptop: Laptop, intent: Intent) {
  let score = laptop.valueScore + laptop.discountRate * 1.7;

  if (intent === "gaming") {
    score += laptop.performance * 1.6 + (laptop.rtx ? 42 : 0) + laptop.gpuTier / 30;
  }

  if (intent === "creator") {
    score += laptop.performance * 1.2 + (laptop.ai ? 22 : 0);
    score += laptop.ramGB && laptop.ramGB >= 32 ? 14 : 0;
    score += laptop.oled ? 10 : 0;
  }

  if (intent === "portable") {
    score += laptop.weightKg ? Math.max(0, 1.95 - laptop.weightKg) * 48 : 0;
    score += laptop.screenSize && laptop.screenSize <= 14.5 ? 10 : 0;
  }

  if (intent === "large") {
    score += laptop.screenSize ? laptop.screenSize * 4.5 : 0;
  }

  if (intent === "study") {
    score += laptop.eduPrice <= 35000 ? 30 : 0;
    score += laptop.weightKg && laptop.weightKg <= 1.7 ? 14 : 0;
  }

  return score;
}

function scoreLabel(score: number) {
  return `${Math.min(99, Math.max(72, Math.round(score / 2.4)))}%`;
}

function compareRanked(a: RankedLaptop, b: RankedLaptop, sortMode: SortMode) {
  if (sortMode === "price") {
    return a.laptop.eduPrice - b.laptop.eduPrice;
  }

  if (sortMode === "saving") {
    return b.laptop.discount - a.laptop.discount;
  }

  if (sortMode === "performance") {
    return b.laptop.performance - a.laptop.performance;
  }

  return b.score - a.score;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [budget, setBudget] = useState(maxBudget);
  const [intent, setIntent] = useState<Intent>("all");
  const [family, setFamily] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("match");
  const [onlyRtx, setOnlyRtx] = useState(false);
  const [onlyAi, setOnlyAi] = useState(false);
  const [onlyOled, setOnlyOled] = useState(false);
  const [onlyOneTb, setOnlyOneTb] = useState(false);

  const filtered = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return laptops
      .filter((laptop) => laptop.eduPrice <= budget)
      .filter((laptop) => family === "all" || laptop.family === family)
      .filter((laptop) => intent === "all" || asList(laptop.purposes).includes(intent))
      .filter((laptop) => !onlyRtx || laptop.rtx)
      .filter((laptop) => !onlyAi || laptop.ai)
      .filter((laptop) => !onlyOled || laptop.oled)
      .filter((laptop) => !onlyOneTb || (laptop.storageGB ?? 0) >= 1000)
      .filter((laptop) => terms.every((term) => laptop.searchText.includes(term)))
      .map((laptop) => ({
        laptop,
        score: scoreLaptop(laptop, intent),
      }))
      .sort((a, b) => compareRanked(a, b, sortMode));
  }, [budget, family, intent, onlyAi, onlyOled, onlyOneTb, onlyRtx, query, sortMode]);

  const topPicks = filtered.slice(0, 3);
  const featured = topPicks[0]?.laptop ?? laptops[0];
  const featuredScore = topPicks[0]?.score ?? scoreLaptop(featured, intent);
  const bestSaving = laptops.reduce(
    (best, laptop) => (laptop.discount > best.discount ? laptop : best),
    laptops[0],
  );
  const lightest = laptops.reduce(
    (best, laptop) => {
      if (!laptop.weightKg) return best;
      if (!best.weightKg) return laptop;
      return laptop.weightKg < best.weightKg ? laptop : best;
    },
    laptops[0],
  );
  const fastest = laptops.reduce(
    (best, laptop) => (laptop.performance > best.performance ? laptop : best),
    laptops[0],
  );
  const underBudget = laptops.filter((laptop) => laptop.eduPrice <= budget).length;
  const activeFilters = [query, family !== "all", intent !== "all", onlyRtx, onlyAi, onlyOled, onlyOneTb].filter(Boolean).length;

  return (
    <main className="site-shell">
      <section className="hero-band">
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Excel 限定機型</p>
            <h1>教育價筆電挑選器</h1>
            <p className="hero-text">
              把 88 台 ASUS 教育價筆電整理成可直接比較的清單。先選用途，再縮預算，最後看 CPU、RAM、SSD、顯卡與重量，幫你快速收斂到真正適合上課、創作或遊戲的機型。
            </p>

            <div className="hero-metrics" aria-label="網站重點數據">
              <span>{laptops.length} 款機型</span>
              <span>{families.length} 個系列</span>
              <span>最高折扣 {formatPrice(bestSaving.discount)}</span>
            </div>

            <div className="hero-metrics" aria-label="推薦提示">
              <span>先看用途</span>
              <span>再看預算</span>
              <span>最後比規格</span>
            </div>
          </div>

          <article className="featured-machine">
            <div className="featured-image">
              {featured.image ? (
                <Image
                  alt={featured.title}
                  className="machine-image"
                  fill
                  priority
                  sizes="(max-width: 1100px) 100vw, 520px"
                  src={featured.image}
                />
              ) : (
                <div className="image-fallback">ASUS</div>
              )}
            </div>

            <div className="featured-body">
              <div>
                <p className="muted-label">目前推薦</p>
                <h2>{featured.model}</h2>
                <p>{featured.title}</p>
              </div>
              <div className="price-block">
                <span>教育價 / 市價</span>
                <strong>{formatPrice(featured.eduPrice)}</strong>
                <del>{formatPrice(featured.marketPrice)}</del>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="controls-band" aria-label="篩選條件">
        <div className="controls-grid">
          <label className="search-field">
            <span>關鍵字搜尋</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：RTX、OLED、AI、1TB"
            />
          </label>

          <label className="budget-field">
            <span>預算上限 {formatPrice(budget)}</span>
            <input
              type="range"
              min={minBudget}
              max={maxBudget}
              step={1000}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
            />
          </label>

          <label className="select-field">
            <span>系列</span>
            <select value={family} onChange={(event) => setFamily(event.target.value)}>
              <option value="all">全部系列</option>
              {families.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <span>排序</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              {sortOptions.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="intent-row" role="group" aria-label="用途篩選">
          {intentOptions.map((item) => (
            <button
              className={intent === item.id ? "intent is-active" : "intent"}
              key={item.id}
              onClick={() => setIntent(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="toggle-row" aria-label="條件切換">
          <Toggle checked={onlyRtx} label="只看 RTX" onChange={setOnlyRtx} />
          <Toggle checked={onlyAi} label="只看 AI" onChange={setOnlyAi} />
          <Toggle checked={onlyOled} label="只看 OLED" onChange={setOnlyOled} />
          <Toggle checked={onlyOneTb} label="只看 1TB" onChange={setOnlyOneTb} />
        </div>
      </section>

      <section className="summary-band" aria-label="摘要資訊">
        <div>
          <span>目前符合</span>
          <strong>{filtered.length}</strong>
        </div>
        <div>
          <span>預算內機型</span>
          <strong>{underBudget}</strong>
        </div>
        <div>
          <span>已啟用條件</span>
          <strong>{activeFilters}</strong>
        </div>
      </section>

      <section className="picks-band" aria-label="推薦清單">
        <div className="section-heading">
          <p className="eyebrow">Best matches</p>
          <h2>這一輪最值得看的 3 台</h2>
        </div>
        <div className="pick-grid">
          {topPicks.length > 0 ? (
            topPicks.map(({ laptop, score }, index) => (
              <ProductCard
                key={laptop.id}
                laptop={laptop}
                rank={index + 1}
                score={score}
              />
            ))
          ) : (
            <div className="empty-state">
              <strong>目前沒有符合條件的機型</strong>
              <span>可以先放寬預算，或取消某些篩選條件再試一次。</span>
            </div>
          )}
        </div>
      </section>

      <section className="results-band" id="catalog" aria-label="完整清單">
        <div className="section-heading">
          <p className="eyebrow">Catalog</p>
          <h2>全部機型清單</h2>
        </div>

        <div className="summary-band" style={{ padding: 0, marginBottom: 16 }}>
          <div>
            <span>最高評分機型</span>
            <strong>{scoreLabel(featuredScore)}</strong>
          </div>
          <div>
            <span>最強效能</span>
            <strong>{fastest.model}</strong>
          </div>
          <div>
            <span>最輕便</span>
            <strong>{lightest.model}</strong>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <strong>沒有找到符合條件的筆電</strong>
            <span>試著降低條件，或改成「全部」用途後再重新比對。</span>
          </div>
        ) : (
          <div className="catalog-grid">
            {filtered.map(({ laptop, score }) => (
              <ProductCard key={laptop.id} laptop={laptop} score={score} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" />
      {label}
    </label>
  );
}

function ProductCard({
  laptop,
  rank,
  score,
}: {
  laptop: Laptop;
  rank?: number;
  score: number;
}) {
  const tags = asList(laptop.tags);
  const highlights = asList(laptop.highlights);

  return (
    <article className={rank ? "product-card ranked" : "product-card"}>
      <div className="card-media">
        {rank && <span className="rank-badge">Top {rank}</span>}
        {laptop.imageKind && <span className="image-kind">{laptop.imageKind}</span>}
        {laptop.image ? (
          <Image
            alt={laptop.title}
            className="machine-image"
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) 220px, 210px"
            src={laptop.image}
          />
        ) : (
          <div className="image-fallback">ASUS</div>
        )}
      </div>

      <div className="card-body">
        <div className="card-title-row">
          <div>
            <p className="family">{laptop.family}</p>
            <h3>{laptop.model}</h3>
          </div>
          <span className="match-score">{scoreLabel(score)}</span>
        </div>

        <p className="model-title">{laptop.title}</p>

        <div className="price-row">
          <div>
            <span>教育價 / 市價</span>
            <strong>{formatPrice(laptop.eduPrice)}</strong>
          </div>
          <div>
            <span>原價</span>
            <del>{formatPrice(laptop.marketPrice)}</del>
          </div>
        </div>

        <div className="saving-line">
          省下 {formatPrice(laptop.discount)}
          {laptop.discountRate > 0 ? `，折扣 ${laptop.discountRate}%` : ""}
        </div>

        <div className="tag-row">
          {tags.slice(0, 5).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <dl className="spec-grid">
          <div>
            <dt>CPU</dt>
            <dd>{laptop.cpu}</dd>
          </div>
          <div>
            <dt>GPU</dt>
            <dd>{laptop.gpu}</dd>
          </div>
          <div>
            <dt>記憶體</dt>
            <dd>{laptop.memory}</dd>
          </div>
          <div>
            <dt>儲存</dt>
            <dd>{laptop.storage}</dd>
          </div>
          <div>
            <dt>螢幕</dt>
            <dd>{laptop.display}</dd>
          </div>
          <div>
            <dt>重量</dt>
            <dd>{formatWeight(laptop.weightKg)}</dd>
          </div>
        </dl>

        <details className="details-panel">
          <summary>更多資訊</summary>
          <div className="detail-copy">
            <p>保固：{laptop.warranty || "兩年保固"}</p>
            <p>配件：{laptop.bundle || "依實際出貨內容為準"}</p>
            <p>條碼：{laptop.barcode}</p>
            {highlights.length > 0 && (
              <ul>
                {highlights.map((item, index) => (
                  <li key={`${laptop.id}-highlight-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}
