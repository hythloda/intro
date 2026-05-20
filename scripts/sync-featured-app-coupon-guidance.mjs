import fs from "node:fs/promises";
import path from "node:path";

const DOC_ID = "1KJQ-T-HiO73nYMXTogGLVSu9lo9loMVgXNOosF74758";
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;
const EXPORT_URL =
  process.env.GOOGLE_DOC_EXPORT_URL ||
  `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;

const outputPath = path.join(process.cwd(), "featured-app-coupon-guidance.html");

const response = await fetch(EXPORT_URL, {
  headers: {
    "User-Agent": "canton-featured-app-guidance-sync/1.0",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch Google Doc export: ${response.status} ${response.statusText}`);
}

const sourceText = normalize(await response.text());
if (!sourceText.trim()) {
  throw new Error("Google Doc export returned empty content");
}

const bodyHtml = renderContent(sourceText);
const pageHtml = renderPage(bodyHtml);

await fs.writeFile(outputPath, pageHtml, "utf8");

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/\uEC02/g, "")
    .replace(/\uEC03/g, "")
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\bCIP-(\d{4})\b/g, '<a href="https://github.com/canton-foundation/cips/blob/main/cip-$1/cip-$1.md" target="_blank" rel="noopener">CIP-$1</a>');
}

function renderContent(text) {
  const lines = text.split("\n");
  const out = [];
  let paragraph = [];
  let listItems = [];
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${formatInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    out.push("<ul>");
    for (const item of listItems) {
      out.push(`<li>${formatInline(item)}</li>`);
    }
    out.push("</ul>");
    listItems = [];
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      if (inCode && codeLines.length) codeLines.push("");
      continue;
    }

    if (trimmed === "________________") {
      flushParagraph();
      flushList();
      flushCode();
      inCode = false;
      out.push("<hr>");
      continue;
    }

    if (!inCode && /^DECLARE\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      inCode = true;
      codeLines.push(rawLine);
      continue;
    }

    if (inCode) {
      if (/^Methodology for Compliant Marker Setting$/.test(trimmed)) {
        flushCode();
        inCode = false;
      } else {
        codeLines.push(rawLine);
        continue;
      }
    }

    if (/^Featured App Coupon Guidance$/i.test(trimmed)) {
      out.push(`<h1>${formatInline(trimmed)}</h1>`);
      continue;
    }

    if (/^AS OF\s+/i.test(trimmed)) {
      out.push(`<p><strong>${formatInline(trimmed)}</strong></p>`);
      continue;
    }

    if (/^Core Rules$/i.test(trimmed) || /^Enforcement$/i.test(trimmed) || /^Monitoring$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      out.push(`<h2>${formatInline(trimmed)}</h2>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      out.push(`<h3>${formatInline(trimmed)}</h3>`);
      continue;
    }

    if (/^(Example|Monitoring|Precision Tolerance|Conditions|What this does not allow|Principle|Forward Guidance|Compliance|General Rule|Rationale|Therefore):?$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      out.push(`<h3>${formatInline(trimmed.replace(/:$/, ""))}</h3>`);
      continue;
    }

    if (/^\*\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^\*\s+/, ""));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return out.join("\n");
}

function renderPage(bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Featured App Coupon Guidance | Canton Network</title>

  <style>
    :root {
      --bg: #071017;
      --panel: rgba(15, 28, 35, 0.92);
      --panel-soft: rgba(10, 20, 27, 0.8);
      --line: rgba(116, 227, 195, 0.24);
      --text: #f7fbfc;
      --muted: #c4d2d5;
      --accent: #74e3c3;
      --accent-strong: #f1ff9d;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background:
        radial-gradient(circle at top left, rgba(116, 227, 195, 0.14), transparent 30%),
        linear-gradient(180deg, #061017 0%, #071017 100%);
      color: var(--text);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    body {
      padding: 32px 18px 48px;
      box-sizing: border-box;
    }

    .wrap {
      max-width: 980px;
      margin: 0 auto;
    }

    .panel {
      padding: 48px;
      border-radius: 28px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .eyebrow {
      display: inline-block;
      margin-bottom: 16px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(116, 227, 195, 0.12);
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 16px;
      font-size: 40px;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }

    h2 {
      margin: 30px 0 12px;
      font-size: 28px;
      line-height: 1.15;
    }

    h3 {
      margin: 26px 0 10px;
      font-size: 22px;
      line-height: 1.25;
      color: var(--accent-strong);
    }

    p,
    li {
      color: var(--muted);
      font-size: 17px;
      line-height: 1.65;
    }

    p {
      margin: 0 0 18px;
    }

    ul {
      margin: 0 0 18px 22px;
      padding: 0;
    }

    li {
      margin: 8px 0;
    }

    a {
      color: var(--accent-strong);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 28px;
    }

    .button-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 18px;
      border-radius: 14px;
      font-weight: 800;
      text-decoration: none;
      border: 1px solid rgba(241, 255, 157, 0.28);
      color: var(--text);
    }

    .notice {
      margin-top: 24px;
      padding: 22px;
      border-radius: 18px;
      background: var(--panel-soft);
      border: 1px solid rgba(116, 227, 195, 0.16);
    }

    hr {
      border: none;
      border-top: 1px solid rgba(116, 227, 195, 0.16);
      margin: 28px 0;
    }

    pre {
      margin: 18px 0;
      padding: 18px;
      overflow-x: auto;
      border-radius: 14px;
      background: #081019;
      border: 1px solid rgba(156, 182, 255, 0.14);
      color: #e8f4ff;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }

    @media (max-width: 640px) {
      .panel {
        padding: 28px 22px;
        border-radius: 22px;
      }

      h1 {
        font-size: 31px;
      }

      h2 {
        font-size: 24px;
      }

      h3 {
        font-size: 20px;
      }

      p,
      li {
        font-size: 16px;
      }

      .actions {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="panel">
      <div class="eyebrow">Featured Applications</div>
      <h1>Featured App Coupon Guidance</h1>
      <p>
        This page is generated from the source Google Doc and refreshed by the repo sync script.
      </p>

      <div class="actions">
        <a class="button-secondary" href="${DOC_URL}" target="_blank" rel="noopener">Open Source Doc</a>
        <a class="button-secondary" href="featured-applications.html">Back to Featured Applications</a>
        <a class="button-secondary" href="index.html">Back to Main Page</a>
      </div>

      <div class="notice">
        <p><strong>Sync status:</strong> Synced from the source Google Doc.</p>
      </div>

${bodyHtml}
    </section>
  </main>
</body>
</html>`;
}
