"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { laptops } from "../laptop-data";
import modelGalleryReport from "../model-gallery-report.json";
import { formatMoney, splitList } from "../catalog";

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
const UPDATE_PASSWORD = "CavesBooks";
const UPDATE_AUTH_KEY = "education-update-auth";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function splitModels(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\n,，；;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function UpdatePage() {
  const [authReady, setAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [stagedModelsText, setStagedModelsText] = useState(laptops.map((item) => item.model).join("\n"));
  const [archiveModelsText, setArchiveModelsText] = useState("");

  useEffect(() => {
    try {
      setIsUnlocked(window.sessionStorage.getItem(UPDATE_AUTH_KEY) === "1");
    } catch {
      setIsUnlocked(false);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const stagedModels = useMemo(() => splitModels(stagedModelsText), [stagedModelsText]);
  const archiveModels = useMemo(() => splitModels(archiveModelsText), [archiveModelsText]);
  const stagedSet = useMemo(() => new Set(stagedModels.map(normalize)), [stagedModels]);
  const archiveSet = useMemo(() => new Set(archiveModels.map(normalize)), [archiveModels]);

  const publishedModelSet = useMemo(
    () => new Set(laptops.map((item) => normalize(item.model))),
    [],
  );

  const imageMap = useMemo(() => {
    const map = new Map<string, File[]>();

    for (const file of imageFiles) {
      const path =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const normalizedPath = normalize(path);
      const matchedModel = stagedModels.find((model) => normalizedPath.includes(normalize(model)));
      if (!matchedModel) continue;

      const list = map.get(matchedModel) ?? [];
      list.push(file);
      map.set(matchedModel, list);
    }

    return map;
  }, [imageFiles, stagedModels]);

  const currentCount = laptops.length;
  const newModels = stagedModels.filter((model) => !publishedModelSet.has(normalize(model)));
  const retainedModels = stagedModels.filter((model) => publishedModelSet.has(normalize(model)));
  const removedModels = laptops
    .map((item) => item.model)
    .filter((model) => !stagedSet.has(normalize(model)) || archiveSet.has(normalize(model)));
  const missingImages = stagedModels.filter((model) => !imageMap.has(model));
  const extraImages = [...imageMap.keys()].filter((model) => !stagedSet.has(normalize(model)));

  const summary = useMemo(() => {
    const bestDiscount = laptops.reduce((best, item) => (item.discount > best.discount ? item : best), laptops[0]);
    return {
      generatedAt: new Date().toISOString(),
      sourceExcel: excelFile?.name ?? null,
      stagedModels,
      archiveModels,
      counts: {
        current: currentCount,
        staged: stagedModels.length,
        retained: retainedModels.length,
        new: newModels.length,
        removed: removedModels.length,
        missingImages: missingImages.length,
        extraImages: extraImages.length,
      },
      finance: {
        bestDiscountModel: bestDiscount.model,
        bestDiscountValue: bestDiscount.discount,
        totalMarketPrice: stagedModels.reduce(
          (sum, model) => sum + (laptops.find((item) => item.model === model)?.marketPrice ?? 0),
          0,
        ),
        totalEducationPrice: stagedModels.reduce(
          (sum, model) => sum + (laptops.find((item) => item.model === model)?.eduPrice ?? 0),
          0,
        ),
      },
      files: {
        imageCount: imageFiles.length,
        imageBytes: imageFiles.reduce((sum, file) => sum + file.size, 0),
      },
      missingImages,
      extraImages,
    };
  }, [archiveModels, currentCount, excelFile?.name, extraImages, imageFiles, missingImages, newModels.length, retainedModels.length, removedModels.length, stagedModels]);

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

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === UPDATE_PASSWORD) {
      try {
        window.sessionStorage.setItem(UPDATE_AUTH_KEY, "1");
      } catch {
        // Ignore storage errors and keep the page unlocked in memory.
      }

      setPasswordError("");
      setIsUnlocked(true);
      setPassword("");
      return;
    }

    setPasswordError("密碼不正確");
  }

  return (
    <main className="update-shell">
      <div className={`page-frame ${authReady && isUnlocked ? "" : "update-locked"}`}>
        <div className="topbar">
          <Link className="excel-toggle" href="/">
            <span className="signal" aria-hidden="true" />
            <strong>EDUCATION</strong>
          </Link>

          <div className="topbar-links">
            <Link className="link-pill" href="/">
              回到首頁
            </Link>
            <Link className="link-pill" href="/compare">
              多機比較
            </Link>
          </div>
        </div>

        <section className={`update-auth ${authReady && isUnlocked ? "update-auth-hidden" : ""}`}>
          <article className="update-card update-auth-card">
            <p className="eyebrow">admin access</p>
            <h1>更新後台</h1>
            <p className="update-lead">
              請先輸入密碼進入更新頁面。通過後，才可以看到資料整理、圖片對照與匯出工具。
            </p>

            <form className="auth-form" onSubmit={handlePasswordSubmit}>
              <label className="search-field">
                <span>密碼</span>
                <input
                  className="auth-input"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                  autoComplete="current-password"
                />
              </label>

              {passwordError ? <p className="auth-error">{passwordError}</p> : null}

              <div className="update-actions">
                <button className="button-primary" type="submit">
                  進入後台
                </button>
              </div>
            </form>
          </article>
        </section>

        <div className={`update-content ${authReady && isUnlocked ? "" : "update-content--locked"}`}>
        <section className="update-hero">
          <article className="update-card">
            <p className="eyebrow">admin workflow</p>
            <h1>更新後台</h1>
            <p className="update-lead">
              這一頁是給你更新 Excel 與圖片時用的控制台。重點是先確認 Excel 機型清單，再看圖片對照是否完整，
              最後把摘要匯出，方便重新產生資料與重新部署。
            </p>

            <div className="update-actions">
              <button className="button-primary" onClick={downloadSummary} type="button">
                匯出更新摘要
              </button>
              <Link className="button-soft" href="/compare">
                先看比較頁
              </Link>
            </div>

            <div className="update-note">
              更新時的標準流程：
              1. 置換 Excel。
              2. 放入機型圖片。
              3. 重新跑圖片對照。
              4. 匯出摘要後再部署。
            </div>
          </article>

          <aside className="update-card">
            <p className="eyebrow">資料概況</p>
            <h2>目前 Excel / 圖片對照</h2>

            <div className="update-meta">
              <div className="update-meta-card">
                <span>目前機型數</span>
                <strong>{currentCount}</strong>
              </div>
              <div className="update-meta-card">
                <span>圖庫命中</span>
                <strong>{galleryData.matchedModels}</strong>
              </div>
              <div className="update-meta-card">
                <span>缺圖機型</span>
                <strong>{missingImages.length}</strong>
              </div>
              <div className="update-meta-card">
                <span>最高折扣</span>
                <strong>{formatMoney(summary.finance.bestDiscountValue)}</strong>
              </div>
            </div>

            <div className="notice">
              更新腳本：<code>scripts/update-model-gallery.mjs</code>
              <br />
              圖片會依 <code>model</code> 自動對應，不需要一台一台手動寫死。
            </div>
          </aside>
        </section>

        <section className="update-grid">
          <article className="update-card">
            <p className="eyebrow">匯入資料</p>
            <h2>Excel 與圖片資料夾</h2>

            <div className="update-file-grid">
              <label className="update-file-box">
                <span>Excel 檔案</span>
                <strong>{excelFile ? excelFile.name : "請選擇新的 Excel"}</strong>
                <input
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <span className="muted-note">
                  只要 Excel 裡的機型才會保留，外部機種不會被加入。
                </span>
              </label>

              <label className="update-file-box">
                <span>圖片資料夾</span>
                <strong>{imageFiles.length ? `${imageFiles.length} 張圖片` : "請選擇圖片資料夾"}</strong>
                <input
                  accept="image/*"
                  multiple
                  // @ts-expect-error Chromium 支援整個資料夾挑選。
                  webkitdirectory=""
                  onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
                  type="file"
                />
                <span className="muted-note">
                  圖片會依 model 名稱自動配對，多張圖片會成為輪播來源。
                </span>
              </label>
            </div>
          </article>

          <article className="update-card">
            <p className="eyebrow">機型清單</p>
            <h2>Excel 機型與歸檔機型</h2>

            <label className="search-field">
              <span>Excel 機型</span>
              <textarea
                className="update-textarea"
                value={stagedModelsText}
                onChange={(event) => setStagedModelsText(event.target.value)}
                spellCheck={false}
              />
            </label>

            <label className="search-field">
              <span>歸檔 / 移除機型</span>
              <textarea
                className="update-textarea"
                value={archiveModelsText}
                onChange={(event) => setArchiveModelsText(event.target.value)}
                placeholder="例如：FA401EA-0041A392H"
                spellCheck={false}
              />
            </label>
          </article>
        </section>

        <section className="update-stats">
          <div className="update-stat">
            <span>新機型</span>
            <strong>{newModels.length}</strong>
          </div>
          <div className="update-stat">
            <span>保留機型</span>
            <strong>{retainedModels.length}</strong>
          </div>
          <div className="update-stat">
            <span>移除機型</span>
            <strong>{removedModels.length}</strong>
          </div>
          <div className="update-stat">
            <span>缺圖機型</span>
            <strong>{missingImages.length}</strong>
          </div>
          <div className="update-stat">
            <span>市價總和</span>
            <strong>{formatMoney(summary.finance.totalMarketPrice)}</strong>
          </div>
          <div className="update-stat">
            <span>教育價總和</span>
            <strong>{formatMoney(summary.finance.totalEducationPrice)}</strong>
          </div>
        </section>

        <section className="update-grid">
          <article className="update-card">
            <p className="eyebrow">圖片對照</p>
            <h2>目前已配對的機型</h2>

            {imageFiles.length === 0 ? (
              <div className="empty-state">
                <strong>尚未選擇圖片</strong>
                <span>選完圖片資料夾後，這裡會列出能成功配對到 model 的機型。</span>
              </div>
            ) : (
              <div className="update-list">
                {Array.from(imageMap.entries()).slice(0, 12).map(([model, files]) => (
                  <div key={model} className="update-row">
                    <strong>{model}</strong>
                    <span>{files.length} 張</span>
                  </div>
                ))}
              </div>
            )}

            {extraImages.length > 0 && (
              <div className="notice">
                有 {extraImages.length} 個圖片對應不到目前 Excel 機型，請先確認檔名或 model 是否一致。
              </div>
            )}
          </article>

          <article className="update-card">
            <p className="eyebrow">更新摘要</p>
            <h2>匯出前最後檢查</h2>

            <div className="compact-list">
              <div className="compact-row">
                <strong>目前資料列</strong>
                <span>{currentCount}</span>
              </div>
              <div className="compact-row">
                <strong>Excel 內新機型</strong>
                <span>{newModels.length}</span>
              </div>
              <div className="compact-row">
                <strong>找不到圖片</strong>
                <span>{missingImages.length}</span>
              </div>
              <div className="compact-row">
                <strong>已配對圖片群組</strong>
                <span>{imageMap.size}</span>
              </div>
            </div>

            <div className="update-actions">
              <button className="button-primary" onClick={downloadSummary} type="button">
                下載 JSON 摘要
              </button>
              <Link className="button-soft" href="/">
                回首頁檢視
              </Link>
            </div>

            <label className="search-field">
              <span>摘要預覽</span>
              <textarea
                className="update-textarea large"
                readOnly
                value={JSON.stringify(summary, null, 2)}
                spellCheck={false}
              />
            </label>
          </article>
        </section>

        <section className="update-card">
          <p className="eyebrow">缺圖與移除</p>
          <h2>要回頭處理的項目</h2>

          <div className="update-columns">
            <div>
              <h3>缺圖機型</h3>
              <div className="update-list">
                {missingImages.length === 0 ? (
                  <div className="empty-state">
                    <strong>沒有缺圖</strong>
                    <span>目前 Excel 中的機型都有對應圖片。</span>
                  </div>
                ) : (
                  missingImages.map((model) => (
                    <div key={model} className="update-row">
                      <strong>{model}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3>移除機型</h3>
              <div className="update-list">
                {removedModels.length === 0 ? (
                  <div className="empty-state">
                    <strong>沒有移除項目</strong>
                    <span>目前沒有要從清單中拿掉的機型。</span>
                  </div>
                ) : (
                  removedModels.map((model) => (
                    <div key={model} className="update-row">
                      <strong>{model}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>
    </main>
  );
}
