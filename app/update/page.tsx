"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCatalog } from "../catalog-client";
import { laptops as fallbackLaptops } from "../laptop-data";

const UPDATE_PASSWORD = "CavesBooks";
const UPDATE_AUTH_KEY = "education-update-auth";

type UploadAction = "clear" | "upload" | "photos";

export default function UpdatePage() {
  const { catalog, meta, ready, reload } = useCatalog(fallbackLaptops);
  const [authReady, setAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("請先登入後台。");

  useEffect(() => {
    try {
      setIsUnlocked(window.sessionStorage.getItem(UPDATE_AUTH_KEY) === "1");
    } catch {
      setIsUnlocked(false);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const storageMissing = meta.storageStatus === "missing";
  const photoStorageMissing = meta.photoStorageStatus === "missing";
  const missingImages = meta.missingImages ?? [];
  const sourceLabel = meta.sourceFile ?? (meta.status === "cleared" ? "已清空" : "尚未上傳 Excel");
  const updatedLabel = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("zh-TW") : "尚未更新";
  const selectedPhotoCount = photoFiles.length;
  const selectedPhotoPreview = photoFiles.slice(0, 5).map((file) => file.name).join("、");

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password === UPDATE_PASSWORD) {
      try {
        window.sessionStorage.setItem(UPDATE_AUTH_KEY, "1");
      } catch {
        // Ignore storage issues and keep the local session unlocked.
      }

      setPasswordError("");
      setIsUnlocked(true);
      setPassword("");
      setNotice("已登入後台。");
      return;
    }

    setPasswordError("密碼錯誤，請再試一次。");
  }

  async function postCatalogAction(action: UploadAction) {
    const formData = new FormData();
    formData.append("action", action);

    if (action === "upload") {
      if (!excelFile) {
        throw new Error("請先選擇 Excel 檔案。");
      }
      formData.append("excel", excelFile);
    }

    if (action === "photos") {
      if (!photoFiles.length) {
        throw new Error("請先選擇照片。");
      }
      photoFiles.forEach((file) => formData.append("photos", file));
    }

    const response = await fetch("/api/catalog", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      state?: {
        laptops?: unknown[];
        missingImages?: string[];
        uploadedCount?: number;
        unmatchedFiles?: string[];
      };
      summary?: {
        nextCount?: number;
        missingImageCount?: number;
      };
    };

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "操作失敗。");
    }

    await reload();
    return payload;
  }

  async function handleClearAll() {
    const confirmed = window.confirm("確定要清空目前所有機型資料嗎？");
    if (!confirmed) return;

    try {
      setBusy(true);
      setNotice("正在清空資料...");
      await postCatalogAction("clear");
      setExcelFile(null);
      setPhotoFiles([]);
      setNotice("已清空，請重新上傳新的 Excel。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "清空失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadExcel() {
    try {
      setBusy(true);
      setNotice("正在匯入 Excel...");
      const result = await postCatalogAction("upload");
      const nextCount = result.summary?.nextCount ?? result.state?.laptops?.length ?? 0;
      const missingCount = result.summary?.missingImageCount ?? result.state?.missingImages?.length ?? 0;
      setNotice(`已匯入 ${nextCount} 台機型，缺圖 ${missingCount} 台。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "匯入失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadPhotos() {
    try {
      setBusy(true);
      setNotice("正在上傳照片...");
      const result = await postCatalogAction("photos");
      const uploadedCount = result.state?.uploadedCount ?? photoFiles.length;
      const unmatchedFiles = result.state?.unmatchedFiles ?? [];
      if (unmatchedFiles.length) {
        setNotice(`已上傳 ${uploadedCount} 張照片，${unmatchedFiles.length} 張未配對。請看缺圖清單補上。`);
      } else {
        setNotice(`已上傳 ${uploadedCount} 張照片，全部完成配對。`);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "照片上傳失敗。");
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <main className="update-shell" />;
  }

  return (
    <main className="update-shell">
      <div className="page-frame">
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

        {storageMissing || photoStorageMissing ? (
          <div className="notice" style={{ marginTop: 0, marginBottom: 16 }}>
            {storageMissing ? "Vercel KV 尚未連線，資料更新無法同步。" : null}
            {storageMissing && photoStorageMissing ? " " : null}
            {photoStorageMissing ? "Vercel Blob 尚未連線，照片無法永久儲存。" : null}
          </div>
        ) : null}

        {!isUnlocked ? (
          <section className="update-auth">
            <article className="update-card update-auth-card">
              <p className="eyebrow">admin access</p>
              <h1>更新後台</h1>
              <p className="update-lead">請先輸入密碼進入更新頁面。通過後，可以上傳 Excel、一次上傳多張照片，系統會自動配對並列出缺圖清單。</p>

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
        ) : (
          <div className="update-content">
            <section className="update-grid">
              <article className="update-card">
                <p className="eyebrow">資料更新</p>
                <h1>Excel 匯入</h1>
                <p className="update-lead">先清空舊資料，再上傳新的 Excel。圖片會沿用已比對成功的照片，缺圖會保留在下方清單。</p>

                <div className="update-actions">
                  <button className="button-primary" disabled={busy} onClick={handleClearAll} type="button">
                    清空所有機型
                  </button>
                  <button className="button-soft" disabled={busy || !excelFile} onClick={handleUploadExcel} type="button">
                    上傳新的 Excel
                  </button>
                  <button className="button-soft" disabled={busy} onClick={() => void reload()} type="button">
                    重新整理
                  </button>
                </div>

                <label className="search-field" style={{ marginTop: 16 }}>
                  <span>Excel 檔案</span>
                  <input
                    accept=".xlsx,.xls"
                    className="auth-input"
                    onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                    type="file"
                  />
                </label>

                <div className="notice" style={{ marginTop: 16 }}>
                  <strong>檔案：</strong>
                  {excelFile ? excelFile.name : "尚未選擇"}
                  <br />
                  <strong>狀態：</strong>
                  {notice}
                </div>
              </article>

              <article className="update-card">
                <p className="eyebrow">照片上傳</p>
                <h1>一次選很多張</h1>
                <p className="update-lead">檔名只要包含機型代號就能自動配對。已經配對過的照片會重複沿用，沒配到的會列在缺圖清單。</p>

                <div className="update-actions">
                  <button className="button-primary" disabled={busy || !photoFiles.length} onClick={handleUploadPhotos} type="button">
                    上傳照片
                  </button>
                  <button className="button-soft" disabled={busy} onClick={() => setPhotoFiles([])} type="button">
                    清除選取
                  </button>
                </div>

                <label className="search-field" style={{ marginTop: 16 }}>
                  <span>照片檔案</span>
                  <input
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    className="auth-input"
                    multiple
                    onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
                    type="file"
                  />
                </label>

                <div className="notice" style={{ marginTop: 16 }}>
                  <strong>已選：</strong>
                  {selectedPhotoCount} 張
                  <br />
                  <strong>前五張：</strong>
                  {selectedPhotoPreview || "尚未選擇照片"}
                </div>
              </article>
            </section>

            <section className="update-card" style={{ marginTop: 16 }}>
              <p className="eyebrow">目前狀態</p>
              <h2>{catalog.length} 台機型</h2>

              <div className="compact-list">
                <div className="compact-row">
                  <strong>來源檔</strong>
                  <span>{sourceLabel}</span>
                </div>
                <div className="compact-row">
                  <strong>更新時間</strong>
                  <span>{updatedLabel}</span>
                </div>
                <div className="compact-row">
                  <strong>缺圖機型</strong>
                  <span>{missingImages.length}</span>
                </div>
                <div className="compact-row">
                  <strong>已配對圖片</strong>
                  <span>{meta.matchedImageModels ?? 0}</span>
                </div>
              </div>
            </section>

            <section className="update-card" style={{ marginTop: 16 }}>
              <p className="eyebrow">缺圖清單</p>
              <h2>後續補圖用</h2>

              {ready && missingImages.length === 0 ? (
                <div className="empty-state">
                  <strong>沒有缺圖</strong>
                  <span>目前資料都已找到對應圖片。</span>
                </div>
              ) : (
                <div className="update-list">
                  {missingImages.slice(0, 80).map((model) => (
                    <div className="update-row" key={model}>
                      <strong>{model}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
