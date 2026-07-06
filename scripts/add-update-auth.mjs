import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const root = process.cwd().replaceAll("\\", "/");
const htmlFiles = [
  `${root}/update.html`,
  `${root}/.deploy-github/update.html`,
];
const apiFiles = [
  `${root}/netlify/functions/update.mjs`,
  `${root}/.deploy-github/netlify/functions/update.mjs`,
];

const allowedDomains = ["caves.com.tw", "cavesbooks.com.tw"];

function patchHtml(html) {
  const authStyles = `
      .is-auth-locked .shell {
        filter: blur(6px);
        pointer-events: none;
        user-select: none;
      }

      .auth-overlay {
        align-items: center;
        background: rgba(17, 20, 24, 0.66);
        inset: 0;
        display: flex;
        justify-content: center;
        padding: 18px;
        position: fixed;
        z-index: 50;
      }

      .auth-overlay[hidden] {
        display: none;
      }

      .auth-panel {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 10px;
        box-shadow: 0 24px 70px rgba(18, 20, 24, 0.24);
        max-width: 520px;
        padding: 24px;
        width: min(100%, 520px);
      }

      .auth-title {
        font-size: 28px;
        line-height: 1.15;
        margin: 0 0 10px;
      }

      .auth-text {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
        margin: 0 0 14px;
      }

      .auth-chip-row,
      .auth-tabs,
      .auth-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .auth-chip {
        align-items: center;
        background: #f7f2e9;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--accent-dark);
        display: inline-flex;
        font-size: 12px;
        font-weight: 800;
        min-height: 30px;
        padding: 4px 10px;
      }

      .auth-tabs {
        margin: 18px 0 14px;
      }

      .auth-tab {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--ink);
        flex: 1 1 0;
        font-size: 14px;
        font-weight: 800;
        min-height: 42px;
      }

      .auth-tab.is-active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .auth-form {
        display: grid;
        gap: 10px;
      }

      .auth-field {
        display: grid;
        gap: 6px;
      }

      .auth-field span {
        color: var(--muted);
        font-size: 12px;
        font-weight: 800;
      }

      .auth-field input {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 6px;
        color: var(--ink);
        min-height: 44px;
        padding: 0 12px;
      }

      .auth-status {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
        margin-top: 10px;
        min-height: 22px;
      }

      .auth-status.warn {
        color: var(--danger);
      }

      .auth-status.good {
        color: var(--accent-dark);
      }

      .auth-subnote {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
        margin-top: 14px;
      }

      .auth-logout {
        position: fixed;
        right: 18px;
        top: 18px;
        z-index: 51;
      }

      body:not(.is-authenticated) .auth-logout {
        display: none;
      }
    `;

  html = html.replace("</style>", `${authStyles}\n    </style>`);

  html = html.replace(
    "<body>",
    `<body>
    <button class="button ghost auth-logout" id="auth-logout" type="button">?餃</button>
    <div class="auth-overlay" id="auth-overlay">
      <section class="auth-panel" aria-labelledby="auth-title">
        <p class="eyebrow">?湔?亙</p>
        <h1 class="auth-title" id="auth-title">隢??餃</h1>
        <p class="auth-text">
          ???` +
      allowedDomains.map((item) => `@${item}`).join("??) +
      ` ?董??亙???脣?湔????Excel ???        </p>
        <div class="auth-chip-row">
          <span class="auth-chip">撣唾??唾?</span>
          <span class="auth-chip">撖Ⅳ?餃</span>
          <span class="auth-chip">敹?撖Ⅳ</span>
        </div>
        <div class="auth-tabs" role="tablist" aria-label="?餃???">
          <button class="auth-tab is-active" id="auth-tab-login" type="button">?餃</button>
          <button class="auth-tab" id="auth-tab-signup" type="button">撱箇?撣唾?</button>
          <button class="auth-tab" id="auth-tab-reset" type="button">敹?撖Ⅳ</button>
        </div>
        <form class="auth-form" id="auth-login-form">
          <label class="auth-field">
            <span>靽∠拳</span>
            <input autocomplete="email" id="auth-login-email" type="email" />
          </label>
          <label class="auth-field">
            <span>撖Ⅳ</span>
            <input autocomplete="current-password" id="auth-login-password" type="password" />
          </label>
          <button class="button primary" type="submit">?餃</button>
        </form>
        <form class="auth-form" id="auth-signup-form" hidden>
          <label class="auth-field">
            <span>靽∠拳</span>
            <input autocomplete="email" id="auth-signup-email" type="email" />
          </label>
          <label class="auth-field">
            <span>撖Ⅳ</span>
            <input autocomplete="new-password" id="auth-signup-password" type="password" />
          </label>
          <label class="auth-field">
            <span>蝣箄?撖Ⅳ</span>
            <input autocomplete="new-password" id="auth-signup-password2" type="password" />
          </label>
          <button class="button primary" type="submit">撱箇?撣唾?</button>
        </form>
        <form class="auth-form" id="auth-reset-form" hidden>
          <label class="auth-field">
            <span>靽∠拳</span>
            <input autocomplete="email" id="auth-reset-email" type="email" />
          </label>
          <button class="button primary" type="submit">撖?閮剝??</button>
        </form>
        <div class="auth-status" id="auth-status">隢蝙?典?訾縑蝞梁?乓?/div>
        <div class="auth-subnote">
          撣唾??唾???閮剖?蝣潮?芣??摰雯?蝟餌絞撠? Netlify Identity嚗?Ｘ????函?亦???        </div>
      </section>
    </div>`,
  );

  html = html.replace(
    "<script type=\"module\">",
    `<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
    <script type="module">`,
  );

  html = html.replace(
    /downloadSummary: document\.getElementById\("download-summary"\),\s*};/,
    `downloadSummary: document.getElementById("download-summary"),
        authOverlay: document.getElementById("auth-overlay"),
        authStatus: document.getElementById("auth-status"),
        authLogout: document.getElementById("auth-logout"),
        authTabLogin: document.getElementById("auth-tab-login"),
        authTabSignup: document.getElementById("auth-tab-signup"),
        authTabReset: document.getElementById("auth-tab-reset"),
        authLoginForm: document.getElementById("auth-login-form"),
        authSignupForm: document.getElementById("auth-signup-form"),
        authResetForm: document.getElementById("auth-reset-form"),
        authLoginEmail: document.getElementById("auth-login-email"),
        authLoginPassword: document.getElementById("auth-login-password"),
        authSignupEmail: document.getElementById("auth-signup-email"),
        authSignupPassword: document.getElementById("auth-signup-password"),
        authSignupPassword2: document.getElementById("auth-signup-password2"),
        authResetEmail: document.getElementById("auth-reset-email"),
      };`,
  );

  const authBlock = `
      const allowedEmailDomains = ["caves.com.tw", "cavesbooks.com.tw"];

      function normalizeEmail(value) {
        return String(value || "").trim().toLowerCase();
      }

      function isAllowedEmail(value) {
        const email = normalizeEmail(value);
        return allowedEmailDomains.some((domain) => email.endsWith(\`@\${domain}\`));
      }

      function setAuthStatus(message, kind = "") {
        els.authStatus.textContent = message;
        els.authStatus.className = kind ? \`auth-status \${kind}\` : "auth-status";
      }

      function setAuthMode(mode) {
        const isLogin = mode === "login";
        const isSignup = mode === "signup";
        const isReset = mode === "reset";
        els.authLoginForm.hidden = !isLogin;
        els.authSignupForm.hidden = !isSignup;
        els.authResetForm.hidden = !isReset;
        els.authTabLogin.className = isLogin ? "auth-tab is-active" : "auth-tab";
        els.authTabSignup.className = isSignup ? "auth-tab is-active" : "auth-tab";
        els.authTabReset.className = isReset ? "auth-tab is-active" : "auth-tab";
      }

      function setAuthenticated(user) {
        const loggedIn = Boolean(user);
        document.body.classList.toggle("is-authenticated", loggedIn);
        document.body.classList.toggle("is-auth-locked", !loggedIn);
        els.authOverlay.hidden = loggedIn;
        if (loggedIn) {
          setAuthStatus(\`撌脩?伐?\${user.email}\`, "good");
        } else {
          setAuthStatus("隢蝙?典?訾縑蝞梁?乓?);
        }
      }

      function getIdentity() {
        const identity = window.netlifyIdentity;
        if (!identity) {
          throw new Error("登入元件尚未載入，請先確認 Netlify Identity 已啟用。");
        }
        return identity;
      }

      async function loginUser(email, password) {
        const identity = getIdentity();
        if (!isAllowedEmail(email)) {
          throw new Error("登入信箱只接受 @caves.com.tw 或 @cavesbooks.com.tw。");
        }
        return identity.login(email, password);
      }

      async function signupUser(email, password) {
        const identity = getIdentity();
        if (!isAllowedEmail(email)) {
          throw new Error("申請帳號只接受 @caves.com.tw 或 @cavesbooks.com.tw。");
        }
        return identity.signup(email, password);
      }

      async function resetPassword(email) {
        const identity = getIdentity();
        if (!isAllowedEmail(email)) {
          throw new Error("重設密碼只接受 @caves.com.tw 或 @cavesbooks.com.tw。");
        }
        const method =
          identity.requestPasswordRecovery ||
          identity.recover ||
          identity.requestRecoveryEmail ||
          identity.sendPasswordRecoveryEmail;
        if (typeof method !== "function") {
          throw new Error("目前登入元件不支援重設密碼。");
        }
        return method.call(identity, email);
      }

      async function withAuthHeaders(headers = {}) {
        const identity = getIdentity();
        const user = identity.currentUser?.();
        if (!user) {
          throw new Error("請先登入。");
        }
        const jwt = await user.jwt();
        return {
          ...headers,
          Authorization: \`Bearer \${jwt}\`,
        };
      }

      if (window.netlifyIdentity) {
        window.netlifyIdentity.on("init", (user) => {
          setAuthenticated(user);
        });
        window.netlifyIdentity.on("login", (user) => {
          setAuthenticated(user);
          setAuthStatus(\`撌脩?伐?\${user.email}\`, "good");
        });
        window.netlifyIdentity.on("logout", () => {
          setAuthenticated(null);
          setAuthMode("login");
        });
        window.netlifyIdentity.init();
        setAuthenticated(window.netlifyIdentity.currentUser?.() || null);
      } else {
        setAuthenticated(null);
      }

      els.authTabLogin.addEventListener("click", () => setAuthMode("login"));
      els.authTabSignup.addEventListener("click", () => setAuthMode("signup"));
      els.authTabReset.addEventListener("click", () => setAuthMode("reset"));
      els.authLogout.addEventListener("click", () => {
        const identity = getIdentity();
        identity.logout();
      });

      els.authLoginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          setAuthStatus("?餃銝?..");
          await loginUser(els.authLoginEmail.value, els.authLoginPassword.value);
        } catch (error) {
          setAuthStatus(error instanceof Error ? error.message : String(error), "warn");
        }
      });

      els.authSignupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          if (els.authSignupPassword.value !== els.authSignupPassword2.value) {
            throw new Error("兩次輸入的密碼不一致。");
          }
          setAuthStatus("撱箇?撣唾?銝?..");
          await signupUser(els.authSignupEmail.value, els.authSignupPassword.value);
          setAuthStatus("撣唾?撌脤?唾?嚗??唬縑蝞勗??Ⅱ隤?, "good");
          setAuthMode("login");
        } catch (error) {
          setAuthStatus(error instanceof Error ? error.message : String(error), "warn");
        }
      });

      els.authResetForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          setAuthStatus("撖?閮剝??銝?..");
          await resetPassword(els.authResetEmail.value);
          setAuthStatus("?身撖Ⅳ???撌脣??綽?隢?砍靽∠拳?嗡縑??, "good");
          setAuthMode("login");
        } catch (error) {
          setAuthStatus(error instanceof Error ? error.message : String(error), "warn");
        }
      });

      setAuthMode("login");
    `;

  html = html.replace(
    /      function renderApiResult\(data\) \{[\s\S]*?      async function submitUpdate\(mode\) \{/s,
    `      function renderApiResult(data) {
        const rows = Array.isArray(data.rows) ? data.rows.slice(0, 8) : [];
        els.apiResult.innerHTML = rows.length
          ? rows
              .map((row) => {
                const summary = row.changeSummary ? ` 繚 ${escapeHtml(row.changeSummary)}` : "";
                return \`
                  <div class="compact-row">
                    <strong>\${escapeHtml(row.model || row.title || "?芸??)}</strong>
                    <span>\${escapeHtml(row.status || "unknown")} 繚 ?? \${row.imageCount ?? 0}\${summary}</span>
                  </div>
                \`;
              })
              .join("")
          : \`<div class="empty small">API 撠?蝯???/div>\`;
      }

${authBlock}

      async function submitUpdate(mode) {`,
  );

  html = html.replace(
    /      async function submitUpdate\(mode\) \{[\s\S]*?      Promise\.all\(\[loadLaptopData\(\), loadReport\(\)\]\)/s,
    `      async function submitUpdate(mode) {
        try {
          const identity = getIdentity();
          const user = identity.currentUser?.();
          if (!user) {
            throw new Error("請先登入。");
          }

          const isPublish = mode === "publish";
          els.apiStatus.textContent = isPublish ? "甇???澆?..." : "甇???湔鞈?...";
          els.apiStatus.className = "subnote";
          els.applyUpdate.disabled = true;
          els.publishUpdate.disabled = true;

          const excel = state.excelFile;
          const excelBase64 = excel ? String(await readFileAsDataURL(excel)).split(",")[1] || "" : "";
          const payload = {
            mode,
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
            headers: await withAuthHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(payload),
          });

          const data = await response.json();
          if (!response.ok || !data.ok) {
            throw new Error(data.error || \`API 憭望?嚗${response.status}\`);
          }

          els.apiStatus.textContent = isPublish
            ? \`?澆?摰?嚗圾??\${data.sourceCount} ?堆??啣? \${data.newCount} ?堆?銝 \${data.removedCount} ?啜`
            : \`?湔摰?嚗圾??\${data.sourceCount} ?堆??啣? \${data.newCount} ?堆?銝 \${data.removedCount} ?啜`;
          els.apiStatus.className = "subnote";
          renderApiResult(data);
          els.downloadSummary.dataset.summary = JSON.stringify(data.summary || data, null, 2);

          if (isPublish && data.publish?.triggered) {
            const status = document.createElement("div");
            status.className = "compact-row";
            status.innerHTML = "<strong>?澆???撌脤</strong><span>Netlify ??憪??圈蝵?/span>";
            els.apiResult.prepend(status);
          }
        } catch (error) {
          els.apiStatus.textContent = \`?憭望?嚗${error.message}\`;
          els.apiStatus.className = "subnote warn";
        } finally {
          els.applyUpdate.disabled = false;
          els.publishUpdate.disabled = false;
        }
      }

      async function applyUpdate() {
        await submitUpdate("apply");
      }

      async function publishUpdate() {
        await submitUpdate("publish");
      }

      els.excelInput.addEventListener("change", (event) => {
        state.excelFile = event.target.files?.[0] ?? null;
        render();
      });

      Promise.all([loadLaptopData(), loadReport()])`,
  );

  return html;
}

function patchApi(apiSource) {
  if (!apiSource.includes("function isAllowedAdminEmail")) {
    apiSource = apiSource.replace(
      /function decodeXml\(value\) \{[\s\S]*?return String\(value \?\? ""\)\n\s+    \.replaceAll\("&amp;", "&"\)\n\s+    \.replaceAll\("&lt;", "<"\)\n\s+    \.replaceAll\("&gt;", ">"\)\n\s+    \.replaceAll\("&quot;", '"'\)\n\s+    \.replaceAll\("&apos;", "'"\);\n\}\n/,
      (match) =>
        `${match}
function isAllowedAdminEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return ${JSON.stringify(allowedDomains)}.some((domain) => email.endsWith(\`@\${domain}\`));
}

function requireAuthorizedUser(context) {
  const user = context?.clientContext?.user ?? null;
  const email = String(user?.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("請先登入。");
  }
  if (!isAllowedAdminEmail(email)) {
    throw new Error("甇日??芸?閮?@caves.com.tw ??@cavesbooks.com.tw ?董??乓?);
  }
  return user;
}

function normalizeSpecValue(key, value) {
  if (key === "marketPrice" || key === "eduPrice") {
    const digits = String(value ?? "").replace(/[^0-9.-]/g, "");
    return digits ? Number(digits) : 0;
  }
  return String(value ?? "").trim();
}
`,
    );
  }

  apiSource = apiSource.replace(
    /export async function handler\(event\) \{/,
    "export async function handler(event, context = {}) {",
  );

  apiSource = apiSource.replace(
    /  try \{\n/,
    `  try {
    requireAuthorizedUser(context);
`,
  );

  apiSource = apiSource.replace(
    /    const updatedRecords = sourceRecords.map\(\(record\) => \{\n      const current = laptops.find\(\(item\) => item\.model === record\.model\);\n      const imageCount = modelMap.get\(record\.model\)\?\.\length ?? 0;\n      return \{\n        \.\.\.record,\n        imageCount,\n        currentMarketPrice: current\?\.\marketPrice ?? null,\n        currentEduPrice: current\?\.\eduPrice ?? null,\n        currentDiscount: current\?\.\discount ?? null,\n        status: current \? "retained" : "new",\n        savingDelta:\n          current && record\.eduPrice\n            \? \{\n                market: record\.marketPrice - current\.marketPrice,\n                edu: record\.eduPrice - current\.eduPrice,\n              \}\n            : null,\n      \};\n    \}\);/,
    `    const updatedRecords = sourceRecords.map((record) => {
      const current = laptops.find((item) => item.model === record.model);
      const imageCount = modelMap.get(record.model)?.length ?? 0;
      const changes = [];
      if (current) {
        for (const key of ["country", "title", "cpu", "memory", "storage", "gpu", "display", "marketPrice", "eduPrice", "featureIntro"]) {
          const currentValue = normalizeSpecValue(key, current[key]);
          const sourceValue = normalizeSpecValue(key, record[key]);
          if (currentValue !== sourceValue) {
            changes.push({
              field: key,
              current: currentValue,
              source: sourceValue,
            });
          }
        }
      }
      return {
        ...record,
        imageCount,
        currentMarketPrice: current?.marketPrice ?? null,
        currentEduPrice: current?.eduPrice ?? null,
        currentDiscount: current?.discount ?? null,
        status: current ? (changes.length ? "changed" : "retained") : "new",
        changeSummary: changes.length ? `${changes.length} 項規格不同` : "",
        changes,
        savingDelta:
          current && record.eduPrice
            ? {
                market: record.marketPrice - current.marketPrice,
                edu: record.eduPrice - current.eduPrice,
              }
            : null,
      };
    });`,
  );

  apiSource = apiSource.replace(
    /      newCount: newModels\.length,\n      retainedCount: retainedModels\.length,\n      removedCount: removedModels\.length,\n      missingImageCount: missingImages\.length,\n      unmatchedImageCount: unmatched\.length,/, 
    `      newCount: newModels.length,
      retainedCount: retainedModels.length,
      changedCount: updatedRecords.filter((item) => item.status === "changed").length,
      removedCount: removedModels.length,
      missingImageCount: missingImages.length,
      unmatchedImageCount: unmatched.length,`,
  );

  apiSource = apiSource.replace(
    /        newCount: newModels\.length,\n        retainedCount: retainedModels\.length,\n        removedCount: removedModels\.length,\n        missingImageCount: missingImages\.length,\n        unmatchedImageCount: unmatched\.length,\n        archiveModels,/, 
    `        newCount: newModels.length,
        retainedCount: retainedModels.length,
        changedCount: updatedRecords.filter((item) => item.status === "changed").length,
        removedCount: removedModels.length,
        missingImageCount: missingImages.length,
        unmatchedImageCount: unmatched.length,
        archiveModels,`,
  );

  apiSource = apiSource.replace(
    /    if \(String\(body\.mode \|\| "preview"\) === "publish"\) \{\n      const publish = await triggerPublish\(response\.summary\);\n      return json\(200, \{\n        \.\.\.response,\n        publish,\n      \}\);\n    \}/,
    `    if (String(body.mode || "preview") === "publish") {
      const publish = await triggerPublish(response.summary);
      return json(200, {
        ...response,
        publish,
      });
    }`,
  );

  return apiSource;
}

for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  writeFileSync(file, patchHtml(source), "utf8");
}

for (const file of apiFiles) {
  const source = readFileSync(file, "utf8");
  writeFileSync(file, patchApi(source), "utf8");
}

copyFileSync(apiFiles[0], apiFiles[1]);
