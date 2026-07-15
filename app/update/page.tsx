"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCatalog } from "../catalog-client";
import { laptops as fallbackLaptops } from "../laptop-data";
import { formatMoney } from "../catalog";

const UPDATE_PASSWORD = "CavesBooks";
const UPDATE_AUTH_KEY = "education-update-auth";

export default function UpdatePage() {
  const { catalog, meta, ready, reload } = useCatalog(fallbackLaptops);
  const [authReady, setAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("請先輸入密碼。");

  useEffect(() => {
    try {
      setIsUnlocked(window.sessionStorage.getItem(UPDATE_AUTH_KEY) === "1");
    } catch {
      setIsUnlocked(false);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const missingImages = meta.missingImages ?? [];
  const sourceLabel = meta.sourceFile ?? (meta.status === "cleared" ? "已清空" : "目前使用預設資料");
  const updatedLabel = meta.updatedAt ? new Date(meta.updatedAt).toLocaleString("zh-TW") : "尚未更新";

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
      setNotice("已進入更新後台。");
      return;
    }

    setPasswordError("密碼不正確");
  }

  async function postCatalogAction(action: "clear" | "upload") {
    const formData = new FormData();
    formData.append("action", action);
    if (action === "upload") {
      if (!excelFile) {
        throw new Error("請先選擇 Excel 檔。");
      }
      formData.append("excel", excelFile);
    }

    const response = await fetch("/api/catalog", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "更新失敗");
    }

    await reload();
    return payload;
  }

  async function handleClearAll() {
    const confirmed = window.confirm("確定要清除所有機型嗎？這會先把目前資料清空。");
    if (!confirmed) return;

    try {
      setBusy(true);
      setNotice("正在清除所有機型...");
      await postCatalogAction("clear");
      setExcelFile(null);
      setNotice("已清除所有機型，現在可以上傳新的 Excel。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "清除失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadExcel() {
    try {
      setBusy(true);
      setNotice("正在上傳與解析 Excel...");
      const result = await postCatalogAction("upload");
      const state = result.state ?? {};
      const nextCount = Array.isArray(state.laptops) ? state.laptops.length : 0;
      const missingCount = Array.isArray(state.missingImages) ? state.missingImages.length : 0;
      setNotice(`上傳完成：${nextCount} 台機型，缺圖 ${missingCount} 台。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "上傳失敗");
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

        {!isUnlocked ? (
          <section className="update-auth">
            <article className="update-card update-auth-card">
              <p className="eyebrow">admin access</p>
              <h1>更新後台</h1>
              <p className="update-lead">
                請先輸入密碼進入更新頁面。通過後，可以清除所有機型、上傳新的 Excel，並檢查缺圖清單。
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
        ) : (
          <div className="update-content">
            <section className="update-grid">
              <article className="update-card">
                <p className="eyebrow">更新流程</p>
                <h1>清除與上傳</h1>
                <p className="update-lead">
                  先清空目前機型，再上傳新的 Excel。系統會自動保留原有圖片資料，若找不到圖片會列出缺圖機型。
                </p>

                <div className="update-actions">
                  <button className="button-primary" disabled={busy} onClick={handleClearAll} type="button">
                    清除所有機型
                  </button>
                  <button className="button-soft" disabled={busy || !excelFile} onClick={handleUploadExcel} type="button">
                    上傳新的 Excel 檔
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
                    onChange={(event) => {
                      setExcelFile(event.target.files?.[0] ?? null);
                    }}
                    type="file"
                  />
                </label>

                <div className="notice" style={{ marginTop: 16 }}>
                  目前檔案：{excelFile ? excelFile.name : "尚未選擇"}
                  <br />
                  狀態：{notice}
                </div>
              </article>

              <article className="update-card">
                <p className="eyebrow">目前資料</p>
                <h2>{catalog.length} 台機型</h2>

                <div className="compact-list">
                  <div className="compact-row">
                    <strong>資料來源</strong>
                    <span>{sourceLabel}</span>
                  </div>
                  <div className="compact-row">
                    <strong>最後更新</strong>
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

                <div className="notice" style={{ marginTop: 16 }}>
                  現在只會使用最新的資料來源，不會再把舊 Excel 一併混進來。
                </div>
              </article>
            </section>

            <section className="update-card" style={{ marginTop: 16 }}>
              <p className="eyebrow">缺圖清單</p>
              <h2>需要補照片的機型</h2>

              {ready && missingImages.length === 0 ? (
                <div className="empty-state">
                  <strong>沒有缺圖</strong>
                  <span>目前資料都能找到對應圖片。</span>
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

            <section className="update-card" style={{ marginTop: 16 }}>
              <p className="eyebrow">快速檢查</p>
              <h2>更新後概況</h2>

              <div className="compact-list">
                <div className="compact-row">
                  <strong>目前機型</strong>
                  <span>{catalog.length}</span>
                </div>
                <div className="compact-row">
                  <strong>教育價總和</strong>
                  <span>{formatMoney(catalog.reduce((sum, item) => sum + item.eduPrice, 0))}</span>
                </div>
                <div className="compact-row">
                  <strong>市價總和</strong>
                  <span>{formatMoney(catalog.reduce((sum, item) => sum + item.marketPrice, 0))}</span>
                </div>
                <div className="compact-row">
                  <strong>最高價差</strong>
                  <span>{formatMoney(catalog.length ? Math.max(...catalog.map((item) => item.discount)) : 0)}</span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}