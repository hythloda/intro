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

for (const slug of ["head-of-korea", "head-of-japan"]) {
  const document = JSON.parse(readFileSync(new URL(`descriptions/${slug}.json`, import.meta.url), "utf8"));
  const lines = document.content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const title = lines[0];
  const facts = lines.slice(1, 5).map(line => {
    const split = line.indexOf(":");
    if (split < 0) throw new Error("Unexpected job description metadata");
    return `<div><dt>${escape(line.slice(0, split))}</dt><dd>${escape(line.slice(split + 1).trim())}</dd></div>`;
  }).join("\n        ");
  let head = source.slice(0, source.indexOf("<body>"))
    .replace('Password-protected President and CEO application form for Canton Foundation.', `${title} job description and application form at Canton Foundation.`)
    .replaceAll("President and CEO Application", `${title} | Careers`)
    .replaceAll("20261020-access1", "20261021-public1")
    .replaceAll("20261020-required-referral1", "20261021-public1");
  const html = `${head}<body>
  <div data-site-header></div>
  <main class="careers-wrap">
    <a class="careers-back" href="jobs.html">Back to Jobs</a>
    <header class="careers-hero">
      <div class="careers-eyebrow">Canton Foundation Careers</div>
      <h1>Head of <span>${title.replace("Head of ", "")}</span></h1>
      <dl class="careers-facts">
        ${facts}
      </dl>
      <a class="careers-button" href="#application">Apply for ${title}</a>
    </header>
    <section class="careers-role" aria-label="Job description">
      <div class="role-copy">
        ${descriptionHtml(lines.slice(5))}
      </div>
    </section>
${form.replaceAll("President and CEO", title).replaceAll("president-and-ceo", slug)}  </main>
  <div data-site-footer></div>
</body>
</html>
`;
  const destination = new URL(`${slug}.html`, root);
  if (process.argv.includes("--check")) {
    if (readFileSync(destination, "utf8") !== html) throw new Error(`${slug}.html needs regeneration`);
  } else writeFileSync(destination, html);
}
console.log("Public role pages are up to date.");
