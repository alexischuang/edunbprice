import { readFile, writeFile } from "node:fs/promises";
import { copyFile } from "node:fs/promises";

const root = "D:/Documents/大專教育價筆電挑選器";
const files = [
  `${root}/update.html`,
  `${root}/.deploy-github/update.html`,
];

const releaseReplacement = `
            <div class="release-stack">
              <button class="button ghost" id="save-draft" type="button">儲存草稿摘要</button>
              <button class="button primary" id="apply-update" type="button">套用更新</button>
              <button class="button" type="button" disabled>回復上一版</button>
            </div>
            <div class="subnote" id="api-status">尚未啟動更新。</div>
            <div class="compact-list" id="api-result"></div>
            <div class="release-notes" style="margin-top: 12px">
              <div class="metric">
                <span>上架規則</span>
                <strong>Excel 未出現的機型會被判定為下架。</strong>
              </div>
              <div class="metric">
                <span>圖片規則</span>
                <strong>照片依機型名稱配對，未配對會保留待查。</strong>
              </div>
              <div class="metric">
                <span>刪除規則</span>
                <strong>預設先保留備份，確認後才做永久刪除。</strong>
              </div>
            </div>
          </article>`;

for (const file of files) {
  let html = await readFile(file, "utf8");

  html = html.replace(
    /<div class="release-stack">[\s\S]*?<\/article>/,
    releaseReplacement,
  );

  html = html.replace(
    '        extraImageNote: document.getElementById("extra-image-note"),\n        galleryMissingPill: document.getElementById("gallery-unmatched-pill"),\n        galleryMissing: document.getElementById("gallery-missing"),\n        saveDraft: document.getElementById("save-draft"),\n        downloadSummary: document.getElementById("download-summary"),',
    '        extraImageNote: document.getElementById("extra-image-note"),\n        apiStatus: document.getElementById("api-status"),\n        apiResult: document.getElementById("api-result"),\n        galleryMissingPill: document.getElementById("gallery-unmatched-pill"),\n        galleryMissing: document.getElementById("gallery-missing"),\n        saveDraft: document.getElementById("save-draft"),\n        applyUpdate: document.getElementById("apply-update"),\n        downloadSummary: document.getElementById("download-summary"),',
  );

  html = html.replace(
    /      function downloadSummary\(\) \{[\s\S]*?\n      \}\n\n      els\.excelInput\.addEventListener\("change",/,
    `      function downloadSummary() {
        const payload = els.downloadSummary.dataset.summary || "{}";
        const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = \`laptop-update-summary-\${new Date().toISOString().slice(0, 10)}.json\`;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error || new Error("無法讀取 Excel 檔案"));
          reader.readAsDataURL(file);
        });
      }

      function renderApiResult(data) {
        const rows = Array.isArray(data.rows) ? data.rows.slice(0, 8) : [];
        els.apiResult.innerHTML = rows.length
          ? rows
              .map(
                (row) => \`
                  <div class="compact-row">
                    <strong>\${escapeHtml(row.model || row.title || "未命名機型")}</strong>
                    <span>\${escapeHtml(row.status || "unknown")} · 圖 \${row.imageCount ?? 0}</span>
                  </div>
                \`,
              )
              .join("")
          : \`<div class="empty small">API 已回傳結果，但沒有可顯示的明細。</div>\`;
      }

      async function applyUpdate() {
        try {
          els.apiStatus.textContent = "正在送出更新資料...";
          els.apiStatus.className = "subnote";
          els.applyUpdate.disabled = true;

          const excel = state.excelFile;
          const excelBase64 = excel ? String(await readFileAsDataURL(excel)).split(",")[1] || "" : "";
          const payload = {
            mode: "apply",
            excelName: excel?.name || "",
            excelBase64,
            modelsText: els.modelsText.value,
            archiveModelsText: els.archiveText.value,
            imageFiles: state.imageFiles.map((file) => ({
              name: file.name,
              path: (file.webkitRelativePath || file.name || "").replaceAll("\\\\", "/"),
              size: file.size,
            })),
          };

          const response = await fetch("/.netlify/functions/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error || \`API 回應 \${response.status}\`);
          }

          els.apiStatus.textContent = \`更新完成：解析 \${data.sourceCount} 台，新增 \${data.newCount} 台，下架 \${data.removedCount} 台。\`;
          els.apiStatus.className = "subnote";
          renderApiResult(data);
          els.downloadSummary.dataset.summary = JSON.stringify(data.summary || data, null, 2);
        } catch (error) {
          els.apiStatus.textContent = \`更新失敗：\${error.message}\`;
          els.apiStatus.className = "subnote warn";
        } finally {
          els.applyUpdate.disabled = false;
        }
      }

      els.excelInput.addEventListener("change",`,
  );

  html = html.replace(
    '      els.saveDraft.addEventListener("click", downloadSummary);\n      els.downloadSummary.addEventListener("click", downloadSummary);',
    '      els.saveDraft.addEventListener("click", downloadSummary);\n      els.applyUpdate.addEventListener("click", applyUpdate);\n      els.downloadSummary.addEventListener("click", downloadSummary);',
  );

  await writeFile(file, html, "utf8");
}

await copyFile(`${root}/netlify/functions/update.mjs`, `${root}/.deploy-github/netlify/functions/update.mjs`);
