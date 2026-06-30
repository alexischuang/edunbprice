"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { filterVisibleLaptops, useHiddenModels } from "../catalog-store";
import { laptops as baseLaptops } from "../laptop-data";
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
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function UpdatePage() {
  const { hiddenModels, setHiddenModels, ready: hiddenReady } = useHiddenModels();
  const laptops = useMemo(
    () => filterVisibleLaptops(baseLaptops, hiddenModels),
    [hiddenModels],
  );
  const [authReady, setAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageDraftFiles, setImageDraftFiles] = useState<File[]>([]);
  const [appliedImageFiles, setAppliedImageFiles] = useState<File[]>([]);
  const [stagedModelsText, setStagedModelsText] = useState(
    baseLaptops.map((item) => item.model).join("\n"),
  );
  const [appliedModelsText, setAppliedModelsText] = useState(
    baseLaptops.map((item) => item.model).join("\n"),
  );
  const [archiveDraftText, setArchiveDraftText] = useState("");
  const [appliedArchiveText, setAppliedArchiveText] = useState("");
  const [executeCounts, setExecuteCounts] = useState({
    models: 0,
    images: 0,
    archive: 0,
  });

  useEffect(() => {
    try {
      setIsUnlocked(window.sessionStorage.getItem(UPDATE_AUTH_KEY) === "1");
    } catch {
      setIsUnlocked(false);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    if (!hiddenReady) return;
    setAppliedModelsText(laptops.map((item) => item.model).join("\n"));
  }, [hiddenReady, laptops]);

  const stagedModels = useMemo(() => splitModels(appliedModelsText), [appliedModelsText]);
  const stagedDraftModels = useMemo(() => splitModels(stagedModelsText), [stagedModelsText]);
  const archiveDraftModels = useMemo(() => splitModels(archiveDraftText), [archiveDraftText]);
  const archiveModels = useMemo(() => splitModels(appliedArchiveText), [appliedArchiveText]);
  const stagedSet = useMemo(() => new Set(stagedModels.map(normalize)), [stagedModels]);
  const archiveSet = useMemo(() => new Set(archiveModels.map(normalize)), [archiveModels]);

  const publishedModelSet = useMemo(
    () => new Set(laptops.map((item) => normalize(item.model))),
    [],
  );

  const imageMap = useMemo(() => {
    const map = new Map<string, File[]>();

    for (const file of appliedImageFiles) {
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
  }, [appliedImageFiles, stagedModels]);

  const currentCount = laptops.length;
  const newModels = stagedModels.filter((model) => !publishedModelSet.has(normalize(model)));
  const retainedModels = stagedModels.filter((model) => publishedModelSet.has(normalize(model)));
  const removedModels = laptops
    .map((item) => item.model)
    .filter((model) => !stagedSet.has(normalize(model)) || archiveSet.has(normalize(model)));
  const missingImages = stagedModels.filter((model) => !imageMap.has(model));
  const extraImages = [...imageMap.keys()].filter((model) => !stagedSet.has(normalize(model)));

  const summary = useMemo(() => {
    const bestDiscount = laptops.reduce(
      (best, item) => (item.discount > best.discount ? item : best),
      laptops[0],
    );

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
        imageCount: appliedImageFiles.length,
        imageBytes: appliedImageFiles.reduce((sum, file) => sum + file.size, 0),
      },
      missingImages,
      extraImages,
    };
  }, [
    appliedImageFiles,
    archiveModels,
    currentCount,
    excelFile?.name,
    extraImages,
    missingImages,
    newModels.length,
    retainedModels.length,
    removedModels.length,
    stagedModels,
  ]);

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

  function handleExecuteModels() {
    setAppliedModelsText(stagedModelsText);
    setExecuteCounts((current) => ({ ...current, models: current.models + 1 }));
  }

  function handleExecuteImages() {
    setAppliedImageFiles(imageDraftFiles);
    setExecuteCounts((current) => ({ ...current, images: current.images + 1 }));
  }

  function handleExecuteArchive() {
    setAppliedArchiveText(archiveDraftText);
    setHiddenModels((current) =>
      Array.from(
        new Set([...current, ...archiveDraftModels].map((model) => model.trim()).filter(Boolean)),
      ),
    );
    setExecuteCounts((current) => ({ ...current, archive: current.archive + 1 }));
  }

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
      <div className={`page-frame ${authReady && isUnlocked ? "" : "update-locked"}`}>
        <div className="topbar">
          <Link className="excel-toggle" href="/">
            <span className="signal" aria-hidden="true" />
            <strong>EDUCATION</strong>
          </Link>

          <div className="topbar-links">
            <Link className="link-pill" href="/">
              回首頁
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
                這裡可以整理 Excel 機型、比對圖片、輸出更新摘要。三個主要動作都各自有按鈕：
                更新機型、更新圖片、移除機型。
              </p>

              <div className="update-actions">
                <button className="button-primary" onClick={downloadSummary} type="button">
                  下載 JSON 摘要
                </button>
                <Link className="button-soft" href="/">
                  回首頁
                </Link>
              </div>

              <div className="update-note">
                更新流程：
                <br />
                1. 置換 Excel
                <br />
                2. 先按「執行更新機型」
                <br />
                3. 再按「執行更新圖片」
                <br />
                4. 若有要移除的機型，按「執行移除」
              </div>
            </article>

            <aside className="update-card">
              <p className="eyebrow">資料概況</p>
              <h2>Excel / 圖片配對</h2>

              <div className="update-meta">
                <div className="update-meta-card">
                  <span>目前機型</span>
                  <strong>{currentCount}</strong>
                </div>
                <div className="update-meta-card">
                  <span>已配對圖片</span>
                  <strong>{galleryData.matchedModels}</strong>
                </div>
                <div className="update-meta-card">
                  <span>缺圖機型</span>
                  <strong>{missingImages.length}</strong>
                </div>
                <div className="update-meta-card">
                  <span>最佳折扣</span>
                  <strong>{formatMoney(summary.finance.bestDiscountValue)}</strong>
                </div>
              </div>

              <div className="notice">
                目前會依 <code>model</code> 自動對圖，若找不到圖片會保留預設圖。
                <br />
                圖片總數：{galleryData.maxImages} 張
              </div>
            </aside>
          </section>

          <section className="update-grid">
            <article className="update-card">
              <p className="eyebrow">輸入資料</p>
              <h2>Excel 機型清單</h2>

              <div className="update-file-grid">
                <label className="update-file-box">
                  <span>Excel 檔案</span>
                  <strong>{excelFile ? excelFile.name : "尚未選擇 Excel"}</strong>
                  <input
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <span className="muted-note">用來更新機型與價格資料。</span>
                </label>

                <label className="update-file-box">
                  <span>圖片資料夾</span>
                  <strong>{imageDraftFiles.length ? `${imageDraftFiles.length} 個檔案` : "尚未選擇圖片"}</strong>
                  <input
                    accept="image/*"
                    multiple
                    // @ts-expect-error Chromium 支援資料夾選取
                    webkitdirectory=""
                    onChange={(event) => setImageDraftFiles(Array.from(event.target.files ?? []))}
                    type="file"
                  />
                  <span className="muted-note">可直接整個資料夾選入，依檔名配對機型。</span>
                </label>
              </div>

              <div className="update-actions">
                <button className="button-primary" onClick={handleExecuteModels} type="button">
                  執行更新機型
                </button>
                <button className="button-soft" onClick={handleExecuteImages} type="button">
                  執行更新圖片
                </button>
              </div>

              <div className="compact-list">
                <div className="compact-row">
                  <strong>待更新機型</strong>
                  <span>{stagedDraftModels.length}</span>
                </div>
                <div className="compact-row">
                  <strong>已更新機型</strong>
                  <span>{stagedModels.length}</span>
                </div>
                <div className="compact-row">
                  <strong>待更新圖片</strong>
                  <span>{imageDraftFiles.length}</span>
                </div>
                <div className="compact-row">
                  <strong>已更新圖片</strong>
                  <span>{appliedImageFiles.length}</span>
                </div>
              </div>
            </article>

            <article className="update-card">
              <p className="eyebrow">機型維護</p>
              <h2>移除機型清單</h2>

              <label className="search-field">
                <span>要移除的機型</span>
                <textarea
                  className="update-textarea"
                  value={archiveDraftText}
                  onChange={(event) => setArchiveDraftText(event.target.value)}
                  placeholder="例如：A315-59、FX507ZU、X1504VA"
                  spellCheck={false}
                />
              </label>

              <div className="update-actions">
                <button className="button-primary" onClick={handleExecuteArchive} type="button">
                  執行移除
                </button>
                <span className="update-pill">已執行 {executeCounts.archive} 次</span>
              </div>

              <div className="compact-list">
                <div className="compact-row">
                  <strong>待移除</strong>
                  <span>{archiveDraftModels.length}</span>
                </div>
                <div className="compact-row">
                  <strong>已套用移除</strong>
                  <span>{archiveModels.length}</span>
                </div>
              </div>
            </article>
          </section>

          <section className="update-stats">
            <div className="update-stat">
              <span>新增機型</span>
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
              <p className="eyebrow">圖片配對</p>
              <h2>前 12 筆檢視</h2>

              {appliedImageFiles.length === 0 ? (
                <div className="empty-state">
                  <strong>尚未套用圖片</strong>
                  <span>選入資料夾後，按「執行更新圖片」才會顯示可配對的機型清單。</span>
                </div>
              ) : (
                <div className="update-list">
                  {Array.from(imageMap.entries())
                    .slice(0, 12)
                    .map(([model, files]) => (
                      <div key={model} className="update-row">
                        <strong>{model}</strong>
                        <span>{files.length} 張</span>
                      </div>
                    ))}
                </div>
              )}
            </article>

            <article className="update-card">
              <p className="eyebrow">摘要</p>
              <h2>更新摘要預覽</h2>

              <div className="update-actions">
                <button className="button-primary" onClick={downloadSummary} type="button">
                  下載 JSON 摘要
                </button>
                <Link className="button-soft" href="/compare">
                  先看比較頁
                </Link>
              </div>

              <label className="search-field">
                <span>JSON 預覽</span>
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
            <p className="eyebrow">檢查結果</p>
            <h2>缺圖與移除清單</h2>

            <div className="update-columns">
              <div>
                <h3>缺圖機型</h3>
                <div className="update-list">
                  {missingImages.length === 0 ? (
                    <div className="empty-state">
                      <strong>沒有缺圖</strong>
                      <span>目前 Excel 內的機型都能找到圖片。</span>
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
                      <span>按下「執行移除」後，會依清單更新這裡的結果。</span>
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

          <section className="update-card">
            <p className="eyebrow">配對檢核</p>
            <h2>圖片與機型統計</h2>

            <div className="compact-list">
              <div className="compact-row">
                <strong>總機型數</strong>
                <span>{currentCount}</span>
              </div>
              <div className="compact-row">
                <strong>待處理機型</strong>
                <span>{stagedModels.length}</span>
              </div>
              <div className="compact-row">
                <strong>已配對圖片群</strong>
                <span>{imageMap.size}</span>
              </div>
              <div className="compact-row">
                <strong>圖片總容量</strong>
                <span>{formatBytes(summary.files.imageBytes)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
