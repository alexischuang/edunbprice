import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const root = process.cwd().replaceAll('\\', '/');
const targets = [
  `${root}/update.html`,
  `${root}/.deploy-github/update.html`,
];

const updateApiPath = `${root}/netlify/functions/update.mjs`;
const deployUpdateApiPath = `${root}/.deploy-github/netlify/functions/update.mjs`;

function patchHtml(html) {
  const releaseBlock = [
    '            <div class="release-stack">',
    '              <button class="button ghost" id="save-draft" type="button">?脣??阮??</button>',
    '              <button class="button primary" id="apply-update" type="button">憟?湔</button>',
    '              <button class="button primary" id="publish-update" type="button">一鍵發布</button>',
    '              <button class="button" type="button" disabled>?儔銝???/button>',
    '            </div>',
    '            <div class="subnote" id="api-status">撠???湔??/div>',
    '            <div class="compact-list" id="api-result"></div>',
  ].join('\n');

  html = html.replace(
    /<div class="release-stack">[\s\S]*?<div class="compact-list" id="api-result"><\/div>/s,
    releaseBlock,
  );

  html = html.replace(
    /saveDraft: document\.getElementById\("save-draft"\),\s*applyUpdate: document\.getElementById\("apply-update"\),\s*downloadSummary: document\.getElementById\("download-summary"\),/s,
    [
      '        saveDraft: document.getElementById("save-draft"),',
      '        applyUpdate: document.getElementById("apply-update"),',
      '        publishUpdate: document.getElementById("publish-update"),',
      '        downloadSummary: document.getElementById("download-summary"),',
    ].join('\n'),
  );

  const updateBlock = [
    '      async function submitUpdate(mode) {',
    '        try {',
    '          const isPublish = mode === "publish";',
    '          els.apiStatus.textContent = isPublish ? "正在送出發布..." : "正在送出更新資料...";',
    '          els.apiStatus.className = "subnote";',
    '          els.applyUpdate.disabled = true;',
    '          els.publishUpdate.disabled = true;',
    '',
    '          const excel = state.excelFile;',
    '          const excelBase64 = excel ? String(await readFileAsDataURL(excel)).split(",")[1] || "" : "";',
    '          const payload = {',
    '            mode,',
    '            excelName: excel?.name || "",',
    '            excelBase64,',
    '            modelsText: els.modelsText.value,',
    '            archiveModelsText: els.archiveText.value,',
    '            imageFiles: state.imageFiles.map((file) => ({',
    '              name: file.name,',
    '              path: (file.webkitRelativePath || file.name || "").replaceAll("\\\\", "/"),',
    '              size: file.size,',
    '            })),',
    '          };',
    '',
    '          const response = await fetch("/.netlify/functions/update", {',
    '            method: "POST",',
    '            headers: {',
    '              "Content-Type": "application/json",',
    '            },',
    '            body: JSON.stringify(payload),',
    '          });',
    '',
    '          const data = await response.json();',
    '          if (!response.ok || !data.ok) {',
    '            throw new Error(data.error || `API ?? ${response.status}`);',
    '          }',
    '',
    '          els.apiStatus.textContent = isPublish',
    '            ? `發布完成：解析 ${data.sourceCount} 台，新增 ${data.newCount} 台，下架 ${data.removedCount} 台。`',
    '            : `更新完成：解析 ${data.sourceCount} 台，新增 ${data.newCount} 台，下架 ${data.removedCount} 台。`;',
    '          els.apiStatus.className = "subnote";',
    '          renderApiResult(data);',
    '          els.downloadSummary.dataset.summary = JSON.stringify(data.summary || data, null, 2);',
    '',
    '          if (isPublish && data.publish?.triggered) {',
    '            const status = document.createElement("div");',
    '            status.className = "compact-row";',
    '            status.innerHTML = "<strong>發布排程已送出</strong><span>Netlify 會開始重新部署</span>";',
    '            els.apiResult.prepend(status);',
    '          }',
    '        } catch (error) {',
    '          els.apiStatus.textContent = `送出失敗：${error.message}`;',
    '          els.apiStatus.className = "subnote warn";',
    '        } finally {',
    '          els.applyUpdate.disabled = false;',
    '          els.publishUpdate.disabled = false;',
    '        }',
    '      }',
    '',
    '      async function applyUpdate() {',
    '        await submitUpdate("apply");',
    '      }',
    '',
    '      async function publishUpdate() {',
    '        await submitUpdate("publish");',
    '      }',
    '',
    '      els.excelInput.addEventListener("change",',
  ].join('\n');

  html = html.replace(
    /      async function applyUpdate\(\) \{[\s\S]*?      els\.excelInput\.addEventListener\("change",/s,
    updateBlock,
  );

  html = html.replace(
    /      els\.saveDraft\.addEventListener\("click", downloadSummary\);\s*      els\.applyUpdate\.addEventListener\("click", applyUpdate\);\s*      els\.downloadSummary\.addEventListener\("click", downloadSummary\);/s,
    [
      '      els.saveDraft.addEventListener("click", downloadSummary);',
      '      els.applyUpdate.addEventListener("click", applyUpdate);',
      '      els.publishUpdate.addEventListener("click", publishUpdate);',
      '      els.downloadSummary.addEventListener("click", downloadSummary);',
    ].join('\n'),
  );

  return html;
}

for (const file of targets) {
  const html = readFileSync(file, "utf8");
  writeFileSync(file, patchHtml(html), "utf8");
}

copyFileSync(updateApiPath, deployUpdateApiPath);
