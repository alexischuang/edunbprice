import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const root = process.cwd().replaceAll("\\", "/");
const updateHtmlPath = `${root}/update.html`;
const updateApiPath = `${root}/netlify/functions/update.mjs`;
const authJsPath = `${root}/update-auth.js`;

function patchHtml(html) {
  if (!html.includes('update-auth.js')) {
    html = html.replace(
      '<script type="module">',
      '<script src="update-auth.js"></script>\n    <script type="module">',
    );
  }
  return html;
}

function patchApi(source) {
  if (!source.includes("function isAllowedAdminEmail")) {
    source = source.replace(
      `function decodeXml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
`,
      `function decodeXml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function isAllowedAdminEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.endsWith("@caves.com.tw") || email.endsWith("@cavesbooks.com.tw");
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

  source = source.replace(
    "export async function handler(event) {",
    "export async function handler(event, context = {}) {",
  );

  source = source.replace(
    "  try {\n",
    "  try {\n    const authUser = requireAuthorizedUser(context);\n",
  );

  const oldBlock = `    const updatedRecords = sourceRecords.map((record) => {
      const current = laptops.find((item) => item.model === record.model);
      const imageCount = modelMap.get(record.model)?.length ?? 0;
      return {
        ...record,
        imageCount,
        currentMarketPrice: current?.marketPrice ?? null,
        currentEduPrice: current?.eduPrice ?? null,
        currentDiscount: current?.discount ?? null,
        status: current ? "retained" : "new",
        savingDelta:
          current && record.eduPrice
            ? {
                market: record.marketPrice - current.marketPrice,
                edu: record.eduPrice - current.eduPrice,
              }
            : null,
      };
    });
`;

  const newBlock = `    const updatedRecords = sourceRecords.map((record) => {
      const current = laptops.find((item) => item.model === record.model);
      const imageCount = modelMap.get(record.model)?.length ?? 0;
      const changes = [];
      if (current) {
        for (const key of [
          "country",
          "title",
          "cpu",
          "memory",
          "storage",
          "gpu",
          "display",
          "marketPrice",
          "eduPrice",
          "featureIntro",
        ]) {
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
        changeSummary: changes.length ? \`\${changes.length} ???潔??` : "",
        changes,
        savingDelta:
          current && record.eduPrice
            ? {
                market: record.marketPrice - current.marketPrice,
                edu: record.eduPrice - current.eduPrice,
              }
            : null,
      };
    });
`;

  source = source.replace(oldBlock, newBlock);

  source = source.replace(
    `      sourceCount: sourceModels.length,
      currentCount: currentModels.length,
      newCount: newModels.length,
      retainedCount: retainedModels.length,
      removedCount: removedModels.length,
      missingImageCount: missingImages.length,
      unmatchedImageCount: unmatched.length,
`,
    `      sourceCount: sourceModels.length,
      currentCount: currentModels.length,
      newCount: newModels.length,
      retainedCount: retainedModels.length,
      changedCount: updatedRecords.filter((item) => item.status === "changed").length,
      removedCount: removedModels.length,
      missingImageCount: missingImages.length,
      unmatchedImageCount: unmatched.length,
`,
  );

  source = source.replace(
    `        sourceCount: sourceModels.length,
        currentCount: currentModels.length,
        newCount: newModels.length,
        retainedCount: retainedModels.length,
        removedCount: removedModels.length,
        missingImageCount: missingImages.length,
        unmatchedImageCount: unmatched.length,
        archiveModels,
`,
    `        sourceCount: sourceModels.length,
        currentCount: currentModels.length,
        newCount: newModels.length,
        retainedCount: retainedModels.length,
        changedCount: updatedRecords.filter((item) => item.status === "changed").length,
        removedCount: removedModels.length,
        missingImageCount: missingImages.length,
        unmatchedImageCount: unmatched.length,
        archiveModels,
        requestedBy: authUser.email,
`,
  );

  return source;
}

writeFileSync(updateHtmlPath, patchHtml(readFileSync(updateHtmlPath, "utf8")), "utf8");
writeFileSync(updateApiPath, patchApi(readFileSync(updateApiPath, "utf8")), "utf8");
copyFileSync(updateApiPath, `${root}/.deploy-github/netlify/functions/update.mjs`);
copyFileSync(updateHtmlPath, `${root}/.deploy-github/update.html`);
copyFileSync(authJsPath, `${root}/.deploy-github/update-auth.js`);
