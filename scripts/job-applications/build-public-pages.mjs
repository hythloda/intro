import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const source = readFileSync(new URL("president-and-ceo.html", root), "utf8");

// Reuse the native form's accessible structure and thank-you panel, not its access gate.
let form = source.slice(source.indexOf('    <section class="application-panel" id="application"'), source.indexOf("  </main>"));
form = form.replace('aria-labelledby="application-title" hidden', 'aria-labelledby="application-title"');
form = form.replace(/        <button[^\n]*id="application-lock"[^\n]*\n/, "");
const voluntaryStart = form.indexOf('          <details class="application-voluntary">');
const voluntaryEnd = form.indexOf('          <div class="application-honeypot"', voluntaryStart);
if (voluntaryStart < 0 || voluntaryEnd < 0) throw new Error("Review the native form template before building public pages.");
form = form.slice(0, voluntaryStart) + form.slice(voluntaryEnd);

const headings = ["Company Description", "Role Overview", "Key Responsibilities", "Qualifications", "What Success Looks Like"];
function descriptionHtml(lines) {
  const html = [];
  let list = false;
  for (const line of lines) {
    if (line.startsWith("* ")) {
      if (!list) html.push("<ul>");
      list = true;
      html.push(`<li>${escape(line.slice(2))}</li>`);
      continue;
    }
    if (list) html.push("</ul>");
    list = false;
    const tag = headings.includes(line) ? "h2" : /^(\d+\. |Required$|Preferred$)/.test(line) ? "h3" : "p";
    html.push(`<${tag}>${escape(line)}</${tag}>`);
  }
  if (list) html.push("</ul>");
  return html.join("\n        ");
}

function writeOrCheck(filename, html) {
  const destination = new URL(filename, root);
  if (process.argv.includes("--check")) {
    if (readFileSync(destination, "utf8") !== html) throw new Error(`${filename} needs regeneration`);
  } else writeFileSync(destination, html);
}

// Keep submission role keys stable so existing receipts and board routing remain valid.
for (const [role, pageSlug] of [
  ["head-of-korea", "country-manager-korea"],
  ["head-of-japan", "country-manager-japan"]
]) {
  const document = JSON.parse(readFileSync(new URL(`descriptions/${role}.json`, import.meta.url), "utf8"));
  const lines = document.content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const title = lines[0];
  const titleSplit = title.lastIndexOf(", ");
  const heading = titleSplit < 0 ? escape(title) :
    `${escape(title.slice(0, titleSplit + 1))} <span>${escape(title.slice(titleSplit + 2))}</span>`;
  const descriptionStart = lines.findIndex((line, index) => index > 0 && headings.includes(line));
  if (descriptionStart < 1) throw new Error("Job description is missing its first section heading");
  const facts = lines.slice(1, descriptionStart).map(line => {
    const split = line.indexOf(":");
    if (split < 0) throw new Error("Unexpected job description metadata");
    return `<div><dt>${escape(line.slice(0, split))}</dt><dd>${escape(line.slice(split + 1).trim())}</dd></div>`;
  }).join("\n        ");
  let head = source.slice(0, source.indexOf("<body>"))
    .replace('Password-protected President and CEO application form for Canton Foundation.', `${title} job description and application form at Canton Foundation.`)
    .replaceAll("President and CEO Application", `${title} | Careers`)
    .replaceAll("20261020-access1", "20261021-public1")
    .replaceAll("20261020-required-referral1", "20261021-public1")
    .replace("assets/job-application-schema.js?v=20261021-public1", "assets/job-application-schema.js?v=20261022-country-manager1")
    .replace("</title>", `</title>\n  <link rel="canonical" href="https://intro.canton.foundation/${pageSlug}.html">`);
  const html = `${head}<body>
  <div data-site-header></div>
  <main class="careers-wrap">
    <a class="careers-back" href="jobs.html">Back to Jobs</a>
    <header class="careers-hero">
      <div class="careers-eyebrow">Canton Foundation Careers</div>
      <h1>${heading}</h1>
      <dl class="careers-facts">
        ${facts}
      </dl>
      <a class="careers-button" href="#application">Apply for ${title}</a>
    </header>
    <section class="careers-role" aria-label="Job description">
      <div class="role-copy">
        ${descriptionHtml(lines.slice(descriptionStart))}
      </div>
    </section>
${form.replaceAll("President and CEO", title).replaceAll("president-and-ceo", role)}  </main>
  <div data-site-footer></div>
</body>
</html>
`;
  writeOrCheck(`${pageSlug}.html`, html);
  writeOrCheck(`${role}.html`, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} | Canton Foundation</title>
  <link rel="canonical" href="https://intro.canton.foundation/${pageSlug}.html">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${pageSlug}.html">
  <script>
    window.location.replace("${pageSlug}.html" + window.location.search + window.location.hash);
  </script>
</head>
<body>
  <p>This role has moved to <a href="${pageSlug}.html">${escape(title)}</a>.</p>
</body>
</html>
`);
}
console.log("Public role pages are up to date.");
