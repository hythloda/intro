import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const destination = new URL("Code.gs", import.meta.url);

export function buildJobApplicationScript() {
  const vendor = "../../assets/vendor/libphonenumber-js/";
  const sources = [vendor + "libphonenumber-max.js", "../../assets/job-application-schema.js",
    "../../assets/job-application-phone.js", "src/handlers.js", "src/diagnostics.js"];
  const notices = ["LICENSE", "LICENSE.Apache", "AUTHORS"].map(name =>
    "/* libphonenumber-js 1.13.14: " + name + "\n" +
    readFileSync(new URL(vendor + name, import.meta.url), "utf8").trim().replaceAll("*/", "* /") + "\n */\n"
  ).join("\n");
  const header = "/*\n" +
    " * ALL-IN-ONE ACCOUNTING MANAGER APPLICATION SCRIPT\n" +
    " * This is the only .gs file to install in Apps Script.\n" +
    " * Includes the schema, doGet/doPost handlers, setup, and diagnostics.\n" +
    " * Keep MONDAY and TURNSTILE_SECRET in Script Properties, not in this file.\n" +
    " * Maintainers: regenerate with node scripts/job-applications/build.mjs.\n" +
    " */\n\n";
  return header + notices + sources.map(source => readFileSync(new URL(source, import.meta.url), "utf8").trim()).join("\n\n") + "\n";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = buildJobApplicationScript();
  if (process.argv.includes("--check")) {
    if (readFileSync(destination, "utf8") !== bundle) {
      console.error("Code.gs is out of date. Run node scripts/job-applications/build.mjs.");
      process.exitCode = 1;
    } else console.log("All-in-one Code.gs is up to date.");
  } else {
    writeFileSync(destination, bundle);
    console.log("Built all-in-one Code.gs (schema, application handlers, and diagnostics).");
  }
}
