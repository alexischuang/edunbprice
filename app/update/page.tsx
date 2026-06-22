"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { laptops } from "../laptop-data";
import modelGalleryReport from "../model-gallery-report.json";

type GalleryReport = {
  generatedAt: string;
  totalModels: number;
  matchedModels: number;
  maxImages: number;
  report: Array<{
    model: string;
    matched: number;
    exported: number;
    sources: string[];
  }>;
};

const galleryData = modelGalleryReport as GalleryReport;
const publishedModels = laptops.map((item) => item.model);
const publishedModelSet = new Set(publishedModels.map(normalize));
const publishedModelRank = [...publishedModels].sort((a, b) => b.length - a.length);
const unmatchedGalleryModels = galleryData.report
  .filter((item) => item.matched === 0)
  .map((item) => item.model);

const money = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function splitModels(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,\t]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function inferModelName(path: string) {
  const normalized = normalize(path);
  return (
    publishedModelRank.find((model) => normalized.includes(normalize(model))) ?? null
  );
}

function formatMoney(value: number) {
  return money.format(value);
}

function pillClass(kind: "good" | "warn" | "muted" | "danger") {
  return `update-pill ${kind}`;
}

export default function UpdatePage() {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [excelModelsText, setExcelModelsText] = useState(publishedModels.join("\n"));
  const [archiveModelsText, setArchiveModelsText] = useState("");

  const stagedModels = useMemo(() => splitModels(excelModelsText), [excelModelsText]);
  const archiveModels = useMemo(() => splitModels(archiveModelsText), [archiveModelsText]);
  const stagedSet = useMemo(
    () => new Set(stagedModels.map((model) => normalize(model))),
    [stagedModels],
  );
  const archiveSet = useMemo(
    () => new Set(archiveModels.map((model) => normalize(model))),
    [archiveModels],
  );

  const imageMatches = useMemo(() => {
    const map = new Map<string, File[]>();

    for (const file of imageFiles) {
      const path =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const matchedModel = inferModelName(path);

      if (!matchedModel) continue;

      const list = map.get(matchedModel) ?? [];
      list.push(file);
      map.set(matchedModel, list);
    }

    return map;
  }, [imageFiles]);

  const currentCount = laptops.length;
  const matchedGalleryCount = galleryData.matchedModels;
  const unmatchedGalleryCount = galleryData.totalModels - galleryData.matchedModels;
  const newModels = stagedModels.filter((model) => !publishedModelSet.has(normalize(model)));
  const retainedModels = stagedModels.filter((model) =>
    publishedModelSet.has(normalize(model)),
  );
  const removedModels = publishedModels.filter(
    (model) => !stagedSet.has(normalize(model)) || archiveSet.has(normalize(model)),
  );
  const missingImages = stagedModels.filter((model) => !imageMatches.has(model));
  const extraImages = [...imageMatches.keys()].filter(
    (model) => !stagedSet.has(normalize(model)),
  );

  const stagedMarketValue = stagedModels
    .map((model) => laptops.find((item) => item.model === model)?.marketPrice ?? 0)
    .reduce((sum, value) => sum + value, 0);
  const stagedEduValue = stagedModels
    .map((model) => laptops.find((item) => item.model === model)?.eduPrice ?? 0)
    .reduce((sum, value) => sum + value, 0);

  const summary = useMemo(
    () => ({
      generatedAt: new Date().toISOString(),
      sourceExcel: excelFile?.name ?? null,
      currentCount,
      stagedCount: stagedModels.length,
      retainedCount: retainedModels.length,
      newCount: newModels.length,
      removedCount: removedModels.length,
      missingImageCount: missingImages.length,
      extraImageCount: extraImages.length,
      stagedModels,
      newModels,
      removedModels,
      missingImages,
      extraImages,
      imageFiles: imageFiles.map((file) => ({
        name: file.name,
        path:
          (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        size: file.size,
      })),
    }),
    [
      currentCount,
      excelFile?.name,
      extraImages,
      imageFiles,
      missingImages,
      newModels,
      removedModels,
      retainedModels.length,
      stagedModels,
    ],
  );

  function downloadSummary() {
    const blob = new Blob([JSON.stringify(summary, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `laptop-update-summary-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="update-shell">
      <section className="update-hero">
        <div className="update-hero-copy">
          <p className="update-eyebrow">管理頁 / 上架更新</p>
          <h1>更新上架中心</h1>
          <p className="update-lead">
            上傳 Excel 與圖片資料夾後，先比對新增、下架、缺圖與多圖，再決定要儲存草稿、套用更新或直接發佈。
          </p>
          <div className="update-hero-actions">
            <Link className="update-link" href="/">
              回到前台
            </Link>
            <button className="update-button primary" onClick={downloadSummary} type="button">
              下載更新摘要
            </button>
          </div>
        </div>

        <aside className="update-hero-panel">
          <div className="update-hero-panel-head">
            <span className={pillClass("good")}>草稿模式</span>
            <span className={pillClass("warn")}>可下架</span>
            <span className={pillClass("muted")}>保留備份</span>
          </div>

          <dl className="update-hero-stats">
            <div>
              <dt>目前上架</dt>
              <dd>{currentCount}</dd>
            </div>
            <div>
              <dt>圖片已配對</dt>
              <dd>{matchedGalleryCount}</dd>
            </div>
            <div>
              <dt>圖片待配對</dt>
              <dd>{unmatchedGalleryCount}</dd>
            </div>
            <div>
              <dt>本次缺圖</dt>
              <dd>{missingImages.length}</dd>
            </div>
          </dl>

          <div className="update-hero-note">
            <span>目前最高折扣</span>
            <strong>
              {formatMoney(
                laptops.reduce(
                  (best, item) => (item.discount > best.discount ? item : best),
                  laptops[0],
                ).discount,
              )}
            </strong>
          </div>
        </aside>
      </section>

      <section className="update-grid">
        <article className="update-panel">
          <div className="panel-heading">
            <div>
              <p className="update-eyebrow">來源檔案</p>
              <h2>Excel 與圖片上傳</h2>
            </div>
            <span className={pillClass(excelFile ? "good" : "muted")}>
              {excelFile ? excelFile.name : "尚未選擇 Excel"}
            </span>
          </div>

          <div className="upload-grid">
            <label className="upload-card">
              <span>Excel 檔案</span>
              <strong>上傳限定機型資料</strong>
              <input
                accept=".xlsx,.xls,.csv"
                onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <p>會先顯示檔名與狀態，方便確認本次是否讀到正確版本。</p>
            </label>

            <label className="upload-card">
              <span>圖片資料夾</span>
              <strong>選取各機型照片</strong>
              <input
                accept="image/*"
                multiple
                // @ts-expect-error Chromium supports this folder picker attribute.
                webkitdirectory=""
                onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
                type="file"
              />
              <p>可直接選整個資料夾，系統會用檔名與資料夾名稱配對機型。</p>
            </label>
          </div>

          <div className="file-summary">
            <div>
              <span>Excel</span>
              <strong>
                {excelFile ? `${excelFile.name} / ${formatBytes(excelFile.size)}` : "未上傳"}
              </strong>
            </div>
            <div>
              <span>圖片</span>
              <strong>
                {imageFiles.length
                  ? `${imageFiles.length} 檔 / ${formatBytes(
                      imageFiles.reduce((sum, file) => sum + file.size, 0),
                    )}`
                  : "未選擇"}
              </strong>
            </div>
            <div>
              <span>已配對機型</span>
              <strong>
                {imageMatches.size ? `${imageMatches.size} 個機型` : "尚未配對任何圖片"}
              </strong>
            </div>
          </div>
        </article>

        <article className="update-panel">
          <div className="panel-heading">
            <div>
              <p className="update-eyebrow">比對輸入</p>
              <h2>本次 Excel 機型清單</h2>
            </div>
            <button
              className="update-button ghost"
              onClick={() => setExcelModelsText(publishedModels.join("\n"))}
              type="button"
            >
              載入目前 88 筆
            </button>
          </div>

          <textarea
            className="update-textarea"
            value={excelModelsText}
            onChange={(event) => setExcelModelsText(event.target.value)}
            spellCheck={false}
          />

          <div className="panel-heading compact">
            <div>
              <p className="update-eyebrow">下架清單</p>
              <h3>要強制刪除的舊資料</h3>
            </div>
            <span className={pillClass(archiveModels.length ? "danger" : "muted")}>
              {archiveModels.length ? `${archiveModels.length} 筆` : "可留空"}
            </span>
          </div>

          <textarea
            className="update-textarea small"
            value={archiveModelsText}
            onChange={(event) => setArchiveModelsText(event.target.value)}
            placeholder="每行一個型號，例如：OLD-MODEL-001"
            spellCheck={false}
          />
        </article>
      </section>

      <section className="update-stats">
        <div className="update-stat-card">
          <span>新增模型</span>
          <strong>{newModels.length}</strong>
        </div>
        <div className="update-stat-card">
          <span>保留模型</span>
          <strong>{retainedModels.length}</strong>
        </div>
        <div className="update-stat-card">
          <span>下架模型</span>
          <strong>{removedModels.length}</strong>
        </div>
        <div className="update-stat-card">
          <span>缺圖模型</span>
          <strong>{missingImages.length}</strong>
        </div>
        <div className="update-stat-card">
          <span>市價總和</span>
          <strong>{formatMoney(stagedMarketValue)}</strong>
        </div>
        <div className="update-stat-card">
          <span>教育價總和</span>
          <strong>{formatMoney(stagedEduValue)}</strong>
        </div>
      </section>

      <section className="update-panel">
        <div className="panel-heading">
          <div>
            <p className="update-eyebrow">差異預覽</p>
            <h2>本次更新會發生的事</h2>
          </div>
          <span className={pillClass("warn")}>先比對，再發布</span>
        </div>

        <div className="diff-grid">
          <DiffColumn title="新增模型" tone="good" items={newModels} />
          <DiffColumn title="保留模型" tone="muted" items={retainedModels} />
          <DiffColumn title="下架模型" tone="danger" items={removedModels} />
          <DiffColumn title="缺圖模型" tone="warn" items={missingImages} />
        </div>
      </section>

      <section className="update-grid">
        <article className="update-panel">
          <div className="panel-heading">
            <div>
              <p className="update-eyebrow">圖片配對</p>
              <h2>檔名與機型對應</h2>
            </div>
            <span className={pillClass(imageFiles.length ? "good" : "muted")}>
              {imageFiles.length ? `${imageMatches.size} 組配對` : "尚未上傳圖片"}
            </span>
          </div>

          {imageFiles.length === 0 ? (
            <div className="empty-block">
              請先上傳圖片資料夾，系統就會根據檔名自動整理出對應的機型。
            </div>
          ) : (
            <div className="match-list">
              {Array.from(imageMatches.entries())
                .slice(0, 12)
                .map(([model, files]) => (
                  <div key={model} className="match-row">
                    <strong>{model}</strong>
                    <span>{files.length} 張</span>
                  </div>
                ))}
            </div>
          )}

          {extraImages.length > 0 && (
            <div className="subnote warn">
              還有 {extraImages.length} 個機型在圖片資料夾裡找不到對應的 Excel 資料。
            </div>
          )}
        </article>

        <article className="update-panel">
          <div className="panel-heading">
            <div>
              <p className="update-eyebrow">發布流程</p>
              <h2>更新前的最後檢查</h2>
            </div>
            <span className={pillClass("good")}>準備完成</span>
          </div>

          <div className="release-stack">
            <button className="update-button primary" onClick={downloadSummary} type="button">
              下載核對摘要
            </button>
            <button className="update-button" type="button" disabled>
              套用更新
            </button>
            <button className="update-button" type="button" disabled>
              下架舊機型
            </button>
            <button className="update-button" type="button" disabled>
              清除快取
            </button>
            <button className="update-button ghost" type="button" disabled>
              預覽發佈頁
            </button>
          </div>

          <div className="release-notes">
            <div>
              <span>推薦流程</span>
              <strong>先核對 Excel 與圖片，再決定是否發佈。</strong>
            </div>
            <div>
              <span>缺圖處理</span>
              <strong>若圖片沒配齊，先保留舊資料比較安全。</strong>
            </div>
            <div>
              <span>發布提醒</span>
              <strong>正式上線前，請先在 Vercel 預覽部署確認畫面。</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="update-panel">
        <div className="panel-heading">
          <div>
            <p className="update-eyebrow">未配對資料</p>
            <h2>圖片庫中尚未對應的模型</h2>
          </div>
          <span className={pillClass("muted")}>{unmatchedGalleryModels.length} 筆</span>
        </div>

        <div className="compact-list">
          {unmatchedGalleryModels.map((model) => (
            <div key={model} className="compact-row">
              <strong>{model}</strong>
              <span>圖片未配對</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function DiffColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "good" | "warn" | "muted" | "danger";
  items: string[];
}) {
  return (
    <article className={`diff-column ${tone}`}>
      <div className="panel-heading compact">
        <h3>{title}</h3>
        <span className={pillClass(tone)}>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-block small">沒有項目。</div>
      ) : (
        <div className="compact-list">
          {items.slice(0, 8).map((item) => (
            <div key={item} className="compact-row">
              <strong>{item}</strong>
            </div>
          ))}
          {items.length > 8 && <div className="subnote">還有 {items.length - 8} 筆未顯示。</div>}
        </div>
      )}
    </article>
  );
}
