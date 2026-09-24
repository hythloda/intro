import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import test from "node:test";

const schemaSource = readFileSync(new URL("../../assets/job-application-schema.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("Code.gs", import.meta.url), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function harness(options = {}) {
  const properties = new Map();
  const calls = [];
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => properties.set(key, value),
    getProperties: () => Object.fromEntries(properties)
  };
  const response = data => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(data) });
  const context = vm.createContext({
    console: { log() {} },
    PropertiesService: { getScriptProperties: () => store },
    LockService: { getScriptLock: () => ({ tryLock: () => options.lock !== false, releaseLock() {} }) },
    Utilities: {
      base64Decode: value => [...Buffer.from(value, "base64")],
      base64Encode: value => Buffer.from(value).toString("base64"),
      newBlob: (bytes, type, name) => ({ bytes, type, name }),
      DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (type, value) => [...createHash(type).update(value).digest()]
    },
    Maps: { newGeocoder: () => ({ geocode: () => ({ status: "OK", results: [{ geometry: { location: { lat: 40, lng: -74 } } }] }) }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    UrlFetchApp: { fetch(url, request) {
      calls.push({ url, request });
      if (url.includes("siteverify")) return response({ success: !options.bot, hostname: options.hostname || "intro.canton.foundation", action: options.action || "job_application" });
      if (url.endsWith("/file")) {
        if (options.uploadError) throw new Error("PRIVATE UPLOAD ERROR");
        return response({ data: { add_file_to_column: { id: "asset-123" } } });
      }
      const payload = JSON.parse(request.payload);
      if (payload.query.includes("create_item")) {
        if (options.createError) throw new Error("PRIVATE CREATE ERROR");
        return response({ data: { create_item: { id: "item-123" } } });
      }
      return response({ data: { boards: [{ columns: context.JOB_APPLICATION_SCHEMA.fields.filter(f => !f.auxiliary).map(f => ({ title: f.label, id: "col_" + f.key, type: f.columnTypes[0] })), groups: [{ id: "new", title: "New applicants" }] }] } });
    } }
  });
  vm.runInContext(schemaSource, context);
  vm.runInContext(serverSource, context);
  properties.set("MONDAY", "fake-test-secret");
  properties.set("TURNSTILE_SECRET", "fake-test-secret");
  context.setupJobApplication();
  calls.length = 0;
  const schema = context.JOB_APPLICATION_SCHEMA;
  const values = Object.fromEntries(schema.fields.filter(f => f.type !== "file").map(f => [f.key, ""]));
  Object.assign(values, { name: "Test Applicant", email: "applicant@example.test", country: "US", sponsorship: "No", previousWork: "No", restrictions: "No" });
  const body = { role: schema.role, requestId: randomUUID(), token: "test-token", website: "", values, files: { cv: { name: "test.pdf", data: Buffer.from("%PDF-1.4\nSynthetic test fixture\n%%EOF").toString("base64") } } };
  const post = value => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(value) } }).text);
  const creates = () => calls.filter(c => c.url.endsWith("/v2") && JSON.parse(c.request.payload).query.includes("create_item"));
  return { context, properties, calls, body, post, creates };
}

test("success creates the correct board item, uploads CV, and returns no applicant data", () => {
  const h = harness();
  const result = h.post(h.body);
  assert.deepEqual(result, { ok: true, requestId: h.body.requestId });
  const mutation = JSON.parse(h.creates()[0].request.payload);
  assert.equal(mutation.variables.board, "18432556545");
  const values = JSON.parse(mutation.variables.values);
  assert.deepEqual(values.col_email, { email: "applicant@example.test", text: "applicant@example.test" });
  assert.deepEqual(values.col_country, { countryCode: "US", countryName: "United States" });
  const upload = h.calls.find(call => call.url.endsWith("/file")).request.payload;
  assert.equal(JSON.parse(upload.map).upload, "variables.file");
  assert.equal(upload.upload.type, "application/pdf");
  assert(!JSON.stringify([...h.properties]).includes("applicant@example.test"));
});

test("identical retry is successful without creating or uploading twice", () => {
  const h = harness();
  assert(h.post(h.body).ok);
  assert(h.post(h.body).ok);
  assert.equal(h.creates().length, 1);
  assert.equal(h.calls.filter(c => c.url.endsWith("/file")).length, 1);
});

test("a reused receipt with changed answers cannot alter or duplicate an application", () => {
  const h = harness(); h.post(h.body); h.body.values.name = "Different";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
});

for (const key of ["email", "country", "sponsorship", "previousWork", "restrictions"]) {
  test("rejects missing required " + key, () => {
    const h = harness(); h.body.values[key] = "";
    const result = h.post(h.body);
    assert.equal(result.ok, false); assert(result.fields.includes(key)); assert.equal(h.calls.length, 0);
  });
}

test("voluntary self-identification stays optional and unsent when blank", () => {
  const h = harness(); assert(h.post(h.body).ok);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  for (const field of ["gender", "hispanicLatino", "veteran"]) assert.equal(values["col_" + field], undefined);
});

test("configured optional answers and both uploads reach their own columns", () => {
  const h = harness();
  Object.assign(h.body.values, { gender: "Decline to Self Identify", hispanicLatino: "Decline to Self Identify", veteran: "I don't wish to answer", phone: "+12025550123", phoneCountry: "US", address: "Test address", linkedin: "https://example.test/profile", startDate: "2026-10-01", adjustments: "Test note" });
  h.body.files.coverLetter = { ...h.body.files.cv, name: "cover.pdf" };
  assert(h.post(h.body).ok);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.deepEqual(values.col_gender, { label: "Decline to Self Identify" });
  assert.deepEqual(values.col_phone, { phone: "+12025550123", countryShortName: "US" });
  assert.equal(values.col_address.lat, "40");
  assert.equal(h.calls.filter(c => c.url.endsWith("/file")).length, 2);
});

for (const options of [{ bot: true }, { hostname: "evil.example" }, { action: "other" }]) {
  test("rejects invalid bot protection: " + JSON.stringify(options), () => {
    const h = harness(options); assert.equal(h.post(h.body).ok, false); assert.equal(h.creates().length, 0);
  });
}

for (const options of [{ uploadError: true }, { createError: true }]) {
  test("uncertain writes never claim success or recreate the item: " + JSON.stringify(options), () => {
    const h = harness(options);
    const result = h.post(h.body); assert.equal(result.ok, false);
    assert(!JSON.stringify(result).includes("PRIVATE"));
    assert.equal(h.post(h.body).ok, false); assert.equal(h.creates().length, 1);
  });
}

test("malformed fields, dates, choices, URLs, and honeypot are rejected before writes", () => {
  for (const change of [b => b.website = "spam", b => b.values.sponsorship = "unexpected", b => b.values.linkedin = "javascript:alert(1)", b => b.values.country = "ZZ", b => b.values.startDate = "2026-02-30", b => b.values.email = "not-an-email", b => b.values.phone = "+12025550123", b => b.values.extra = "unknown", b => b.role = "other"]) {
    const h = harness(); change(h.body); assert.equal(h.post(h.body).ok, false); assert.equal(h.creates().length, 0);
  }
});

test("requires CV and rejects renamed or oversized uploads", () => {
  for (const file of [null, { name: "test.exe", data: "JVBERi0=" }, { name: "test.pdf", data: Buffer.from("not a PDF").toString("base64") }, { name: "test.pdf", data: "A".repeat(7 * 1024 * 1024) }]) {
    const h = harness(); h.body.files.cv = file;
    assert.equal(h.post(h.body).ok, false); assert.equal(h.calls.length, 0);
  }
});

test("accepts a full-size 5 MB PDF without regex stack overflow", () => {
  const h = harness();
  const bytes = Buffer.alloc(5 * 1024 * 1024, 65);
  bytes.write("%PDF-1.4");
  const file = h.context.validateFile_({ name: "large.pdf", data: bytes.toString("base64") }, "cv");
  assert.equal(file.bytes.length, bytes.length);
});

test("invalid attachment destination fails before creating an applicant", () => {
  const h = harness();
  const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
  delete mapping.cv;
  h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.calls.length, 0);
});

test("schema mismatch, missing credentials, and lock contention fail closed", () => {
  for (const change of [h => h.properties.delete("MONDAY"), h => h.properties.delete("TURNSTILE_SECRET"), h => h.properties.delete("JOB_COLUMN_MAP")]) {
    const h = harness(); change(h); assert.equal(h.post(h.body).ok, false); assert.equal(h.creates().length, 0);
  }
  const h = harness({ lock: false }); assert.equal(h.post(h.body).ok, false); assert.equal(h.creates().length, 0);
});

test("schema has all original fields, no demographic requirement, and public config contains no secret", () => {
  const h = harness();
  assert.equal(h.context.JOB_APPLICATION_SCHEMA.fields.length, 18);
  assert(h.context.JOB_APPLICATION_SCHEMA.fields.filter(f => f.section === "voluntary").every(f => !f.required));
  const c = {}; vm.runInNewContext(readFileSync(new URL("../../assets/job-application-config.js", import.meta.url), "utf8"), { window: c });
  assert.deepEqual(plain(c.JOB_APPLICATION_CONFIG), { endpoint: "", turnstileSiteKey: "" });
});

test("public careers pages contain no iframe and offer a working unconfigured fallback", () => {
  const jobs = readFileSync(new URL("../../jobs.html", import.meta.url), "utf8");
  const role = readFileSync(new URL("../../accounting-manager.html", import.meta.url), "utf8");
  assert(!/<iframe\b/i.test(jobs + role));
  assert(jobs.includes('href="accounting-manager.html"'));
  assert.match(role, /<form id="job-application"[^>]*\bhidden\b/);
  assert.match(role, /<fieldset id="application-fields"[^>]*\bdisabled\b/);
  assert.match(role, /href="https:\/\/wkf\.ms\/4hquwQv"[^>]*target="_blank"/);
});
