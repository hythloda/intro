import fs from "node:fs/promises";
import path from "node:path";

const DOC_ID = "1xgPUiyfJLR-rfMHqO0xWf_-1O8gidS_UrzroNgVgZHQ";
const DOC_URL = `https://docs.google.com/document/d/${DOC_ID}/edit`;
const EXPORT_URL =
  process.env.GOOGLE_DOC_EXPORT_URL ||
  `https://docs.google.com/document/d/${DOC_ID}/export?format=html`;

const outputPath = path.join(process.cwd(), "featured-app-locking-faq.html");

const response = await fetch(EXPORT_URL, {
  headers: {
    "User-Agent": "canton-featured-app-locking-faq-sync/1.0",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch Google Doc export: ${response.status} ${response.statusText}`);
}

const sourceHtml = normalize(await response.text());
if (!sourceHtml.trim()) {
  throw new Error("Google Doc export returned empty content");
}

const bodyHtml = extractBody(sourceHtml);
const pageHtml = renderPage(bodyHtml);

await fs.writeFile(outputPath, pageHtml, "utf8");

function normalize(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\uFEFF/g, "")
    .trim();
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) {
    throw new Error("Unable to find <body> in exported Google Doc");
  }

  return match[1]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/href="https:\/\/www\.google\.com\/url\?([^"]+)"/g, (_, query) => {
      const params = new URLSearchParams(query.replace(/&amp;/g, "&"));
      const target = params.get("q");
      return target ? `href="${escapeHtml(target)}"` : `href="https://www.google.com/url?${query}"`;
    })
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPage(bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/site-chrome.css">
  <script src="assets/site-chrome.js" defer></script>
  <title>Featured App Locking FAQ | Canton Network</title>

  <style>
    :root {
      --bg: #110d3c;
      --panel: rgba(19, 16, 58, 0.92);
      --panel-soft: rgba(17, 14, 52, 0.82);
      --line: rgba(135, 92, 255, 0.24);
      --text: #f7fbfc;
      --muted: #c4d2d5;
      --accent: #d5a5e3;
      --accent-strong: #f1ff9d;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
      background:
        radial-gradient(circle at top left, rgba(135, 92, 255, 0.22), transparent 30%),
        radial-gradient(circle at top right, rgba(213, 165, 227, 0.14), transparent 26%),
        linear-gradient(180deg, #151043 0%, #171446 50%, #131130 100%);
      color: var(--text);
      font-family: "IBM Plex Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    body {
      padding: 22px 18px 64px;
      box-sizing: border-box;
    }

    .wrap {
      max-width: 1320px;
      margin: 0 auto;
    }

    .panel {
      padding: 0;
      border-radius: 0;
      background: transparent;
      border: 0;
      box-shadow: none;
      backdrop-filter: none;
    }

    .eyebrow {
      display: inline-block;
      margin-bottom: 16px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(213, 165, 227, 0.14);
      color: var(--accent);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .footer-note {
      margin-top: 24px;
      padding: 24px 28px;
      border-radius: 24px;
      background: rgba(20, 17, 61, 0.64);
      border: 1px solid rgba(135, 92, 255, 0.14);
    }

    .footer-note p,
    .doc-content p,
    .doc-content li,
    .doc-content td,
    .doc-content th {
      color: var(--muted);
      font-size: 17px;
      line-height: 1.65;
    }

    .footer-note p,
    .doc-content p {
      margin: 0 0 18px;
    }

    .doc-content p:last-child,
    .footer-note p:last-child {
      margin-bottom: 0;
    }

    .doc-content ul,
    .doc-content ol {
      margin: 0 0 18px 22px;
      padding: 0;
    }

    .doc-content li {
      margin: 8px 0;
    }

    a {
      color: var(--accent-strong);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 22px;
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

    .doc-content {
      margin-top: 30px;
      padding: 44px 48px;
      border-radius: 32px;
      background: rgba(19, 16, 58, 0.84);
      border: 1px solid rgba(135, 92, 255, 0.18);
      box-shadow: 0 18px 54px rgba(0, 0, 0, 0.18);
    }

    .doc-content h1,
    .doc-content h2,
    .doc-content h3,
    .doc-content h4,
    .doc-content h5,
    .doc-content h6 {
      color: var(--text);
      line-height: 1.2;
    }

    .doc-content h1 {
      margin: 0 0 16px;
      font-size: 40px;
      letter-spacing: -0.03em;
    }

    .doc-content h2 {
      margin: 30px 0 12px;
      font-size: 28px;
    }

    .doc-content h3 {
      margin: 26px 0 10px;
      font-size: 22px;
      color: var(--accent-strong);
    }

    .doc-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
    }

    .doc-content th,
    .doc-content td {
      padding: 14px 12px;
      border-top: 1px solid rgba(135, 92, 255, 0.2);
      text-align: left;
      vertical-align: top;
    }

    .doc-content th {
      color: var(--text);
    }

    .doc-content pre,
    .doc-content code {
      font-family: "SFMono-Regular", Menlo, Consolas, monospace;
    }

    .doc-content pre {
      overflow-x: auto;
      padding: 18px;
      border-radius: 16px;
      background: rgba(10, 8, 33, 0.9);
      border: 1px solid rgba(135, 92, 255, 0.2);
    }

    .doc-content img {
      max-width: 100%;
      height: auto;
    }

    @media (max-width: 640px) {
      .panel {
        padding: 0;
        border-radius: 0;
      }

      .doc-content h1 {
        font-size: 31px;
      }

      .doc-content h2 {
        font-size: 24px;
      }

      .doc-content h3 {
        font-size: 20px;
      }

      .footer-note p,
      .doc-content p,
      .doc-content li,
      .doc-content td,
      .doc-content th {
        font-size: 16px;
      }

      .actions {
        flex-direction: column;
      }

      .doc-content {
        padding: 28px 24px;
        border-radius: 24px;
      }

      .footer-note {
        padding: 20px 22px;
        border-radius: 20px;
      }
    }
  </style>
</head>
<body>
  <div data-site-header></div>
  <main class="wrap">
    <section class="panel">
      <div class="eyebrow">Featured Applications</div>

      <div class="actions">
        <a class="button-secondary" href="featured-applications.html">Back to Featured Applications</a>
        <a class="button-secondary" href="index.html">Back to Main Page</a>
      </div>

      <div class="doc-content">
${bodyHtml}
      </div>

      <div class="footer-note">
        <p>If there are any issues with this page, please make suggestions as comments in the <a href="${DOC_URL}" target="_blank" rel="noopener">source Google Doc</a>.</p>
      </div>
    </section>
  </main>
  <div data-site-footer></div>
</body>
</html>
`;
}
