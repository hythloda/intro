import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import { buildJobApplicationScript } from "./build.mjs";

const serverSource = readFileSync(new URL("Code.gs", import.meta.url), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

test("Code.gs is a complete standalone deployment with no additional gs files", () => {
  assert.equal(serverSource, buildJobApplicationScript());
  const context = vm.createContext({});
  vm.runInContext(serverSource, context);
  for (const name of ["doGet", "doPost", "setupJobApplication", "inspectJobColumns",
    "inspectJobApplicationFailure", "approveReviewedJobApplicationRetry",
    "approveReviewedJobApplicationRetryWithUpdatedAnswers"]) {
    assert.equal(typeof context[name], "function", name + " must exist in Code.gs alone");
    assert.equal((serverSource.match(new RegExp("^function " + name + "\\(", "gm")) || []).length, 1);
  }
  assert.equal(context.JOB_APPLICATION_SCHEMA.fields.length, 18);
  assert.equal(context.JOB_APPLICATION_SCHEMA.countryNames.US, "United States");
});

function harness(options = {}) {
  const properties = new Map();
  const calls = [];
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => properties.set(key, value),
    getProperties: () => Object.fromEntries(properties)
  };
  const response = (data, status = 200) => ({ getResponseCode: () => status, getContentText: () => typeof data === "string" ? data : JSON.stringify(data) });
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
        if (options.uploadResponse) return response(options.uploadResponse, options.httpStatus);
        return response({ data: { add_file_to_column: { id: "asset-123" } }, ...(options.emptyErrors ? { errors: [] } : {}) });
      }
      const payload = JSON.parse(request.payload);
      if (payload.query.includes("create_item")) {
        if (options.createError) throw new Error("PRIVATE CREATE ERROR");
        if (options.createResponse) return response(options.createResponse, options.httpStatus);
        return response({ data: { create_item: { id: "item-123" } }, ...(options.emptyErrors ? { errors: [] } : {}) });
      }
      return response({ data: { boards: [{ columns: context.JOB_APPLICATION_SCHEMA.fields.filter(f => !f.auxiliary).map(f => ({ title: f.label, id: "col_" + f.key, type: f.columnTypes[0] })), groups: [{ id: "new", title: "New applicants" }] }] } });
    } }
  });
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

test("standalone GET and invalid POST return JSON without creating a Monday item", () => {
  const h = harness();
  assert.deepEqual(JSON.parse(h.context.doGet().text), { service: "Canton Foundation job applications" });
  const result = h.post({});
  assert.equal(result.ok, false);
  assert.equal(result.requestId, "");
  assert.equal(result.message, "Invalid application request. Please refresh the page.");
  assert.equal(h.calls.length, 0);
});

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

test("valid national and formatted international numbers normalize without changing receipt hashes", () => {
  for (const [country, input, number] of [
    ["US", "(202) 555-0123", "+12025550123"],
    ["US", "+1 (202) 555-0123", "+12025550123"],
    ["US", "12025550123", "+12025550123"],
    ["GB", "020 7946 0990", "+442079460990"],
    ["GB", "+44 20 7946 0990", "+442079460990"],
    ["AU", "02 5550 4321", "+61255504321"],
    ["CA", "+1 416 555 0123", "+14165550123"],
    ["IT", "02 3661 8300", "+390236618300"]
  ]) {
    const h = harness();
    h.body.values.phoneCountry = country;
    h.body.values.phone = input;
    const hash = createHash("sha256").update(JSON.stringify({ values: h.body.values, files: h.body.files })).digest("base64");
    assert.equal(h.post(h.body).ok, true, country + " formatted fixture");
    const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
    assert.deepEqual(values.col_phone, { phone: number, countryShortName: country });
    assert.equal(JSON.parse(h.properties.get("application:" + h.body.requestId)).hash, hash);
    assert.equal(h.body.values.phone, input);
    assert.equal(h.post(h.body).ok, true);
    assert.equal(h.creates().length, 1);
  }
});

test("invalid phone numbers and wrong phone countries fail before external requests or receipts", () => {
  for (const [country, phone] of [
    ["US", "1234567890"], ["US", "+11111111111"], ["US", "555-0123"],
    ["US", "------"], ["US", "12345678901234567890"], ["US", "+44 20 7946 0990"],
    ["CA", "+12025550123"], ["", "+12025550123"], ["AQ", "+12025550123"],
    ["US", "call +12025550123"], ["US", "+12025550123 ext. 12"]
  ]) {
    const h = harness();
    h.body.values.phoneCountry = country;
    h.body.values.phone = phone;
    const logs = [];
    h.context.console.log = value => logs.push(value);
    const result = h.post(h.body);
    assert.equal(result.ok, false);
    assert(result.fields.some(field => ["phone", "phoneCountry"].includes(field)));
    assert.equal(h.calls.length, 0);
    assert.equal(h.properties.has("application:" + h.body.requestId), false);
    assert.equal(logs.length, 0);
    assert(!result.message.includes(phone));
  }
});

test("phone stays optional and never drops a supplied invalid number to force a write", () => {
  const h = harness();
  h.body.values.phoneCountry = "US";
  assert.equal(h.post(h.body).ok, true);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.equal(values.col_phone, undefined);
  const invalid = harness();
  invalid.body.values.phoneCountry = "US";
  invalid.body.values.phone = "123456";
  assert.equal(invalid.post(invalid.body).ok, false);
  assert.equal(invalid.creates().length, 0);
});

test("phone validation preserves a reviewed retry until the user corrects the input", () => {
  const h = reviewedRetryHarness();
  h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers();
  h.body.values.phoneCountry = "US";
  h.body.values.phone = "1234567890";
  const before = h.properties.get(h.key);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.properties.get(h.key), before);
  assert.equal(h.creates().length, 1);
  h.body.values.phone = "(202) 555-0123";
  assert.equal(h.post(h.body).ok, true);
  assert.equal(h.receipt().phase, "complete");
  assert.equal(h.receipt().allowUpdatedAnswers, undefined);
});

test("public application page loads the shared offline phone validator before the form", () => {
  for (const page of ["accounting-manager.html"]) {
    const html = readFileSync(new URL("../../" + page, import.meta.url), "utf8");
    const sources = [...html.matchAll(/<script\b[^>]*src="([^"?]+)(?:\?[^\"]*)?"/g)].map(match => match[1]);
    const expected = ["assets/vendor/libphonenumber-js/libphonenumber-max.js", "assets/job-application-schema.js", "assets/job-application-phone.js"];
    const context = vm.createContext({});
    for (const source of expected) {
      assert(sources.includes(source));
      assert(sources.indexOf(source) < sources.indexOf("assets/job-application.js"));
      vm.runInContext(readFileSync(new URL("../../" + source, import.meta.url), "utf8"), context);
    }
    assert.equal(context.JOB_APPLICATION_PHONE.validate("(202) 555-0123", "US").number, "+12025550123");
    assert.equal(context.JOB_APPLICATION_PHONE.validate("1234567890", "US").ok, false);
    assert.equal(context.JOB_APPLICATION_PHONE.validate("+12025550123", "GB").ok, false);
  }
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
  const config = plain(c.JOB_APPLICATION_CONFIG);
  assert.deepEqual(Object.keys(config).sort(), ["enabled", "endpoint", "turnstileSiteKey"]);
  assert.match(config.endpoint, /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
  assert.match(config.turnstileSiteKey, /^0x[\w-]+$/);
  assert.equal(typeof config.enabled, "boolean");
});

test("native questions remain visible before setup, without an external form link", () => {
  const jobs = readFileSync(new URL("../../jobs.html", import.meta.url), "utf8");
  const role = readFileSync(new URL("../../accounting-manager.html", import.meta.url), "utf8");
  assert(!/<iframe\b/i.test(jobs + role));
  assert(jobs.includes('href="accounting-manager.html"'));
  assert.doesNotMatch(role, /<form id="job-application"[^>]*\bhidden\b/);
  assert.match(role, /<fieldset id="application-fields"[^>]*\bdisabled\b/);
  assert.match(role, /<button[^>]*id="application-submit"[^>]*\bdisabled\b/);
  assert(role.includes("Application form preview"));
  assert.doesNotMatch(role + jobs, /(?:wkf\.ms|forms\.monday\.com)/);
});

test("public submissions are enabled after verification and the temporary test page is retired", () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(new URL("../../assets/job-application-config.js", import.meta.url), "utf8"), context);
  assert.equal(context.window.JOB_APPLICATION_CONFIG.enabled, true);
  const role = readFileSync(new URL("../../accounting-manager.html", import.meta.url), "utf8");
  assert.match(role, /job-application-config\.js\?v=20260924-live1/);
  assert.match(role, /id="application-unavailable" hidden/);
  assert.equal(existsSync(new URL("../../job-application-check.html", import.meta.url)), false);
});

function diagnosticHarness(phase = "uploading") {
  const h = harness();
  const logs = [], queries = [];
  const columns = h.context.JOB_APPLICATION_SCHEMA.fields.filter(f => !f.auxiliary).map(f => ({
    id: "col_" + f.key, type: f.columnTypes[0],
    settings: { labels: (f.options || []).map(label => ({ label })) }
  }));
  const files = [
    { id: "col_cv", files: [{ __typename: "FileAssetValue" }] },
    { id: "col_coverLetter", files: [] }
  ];
  h.context.console.log = value => logs.push(value);
  h.context.monday_ = (config, query, variables) => {
    assert(query.startsWith("query "));
    queries.push({ query, variables });
    return query.includes("boards(ids:")
      ? { boards: [{ columns, groups: [{ id: "new" }] }] }
      : { items: [{ board: { id: "18432556545" }, column_values: files }] };
  };
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", h.body.requestId);
  h.properties.set("MONDAY_GROUP_ID", "new");
  h.properties.set("application:" + h.body.requestId, JSON.stringify({
    phase, hash: "PRIVATE_RECEIPT_HASH", ...(phase === "creating" ? {} : { itemId: "1234567890" })
  }));
  return { ...h, logs, queries, columns, files, inspect: () => plain(h.context.inspectJobApplicationFailure()) };
}

test("diagnostic reads one receipt and file counts without changing data or leaking IDs", () => {
  const h = diagnosticHarness();
  const before = JSON.stringify([...h.properties]);
  const result = h.inspect();
  assert.equal(result.phase, "uploading");
  assert.equal(result.itemCreationConfirmed, true);
  assert.equal(result.destinationGroupExists, true);
  assert.deepEqual(result.uploadedFileCounts, { cv: 1, coverLetter: 0 });
  assert.deepEqual(result.columnIssues, []);
  assert.equal(h.queries.length, 2);
  assert.deepEqual(plain(h.queries[1].variables.ids), ["1234567890"]);
  assert.doesNotMatch(h.queries[1].query, /\b(name|text|value|url|public_url)\b/);
  assert.equal(JSON.stringify([...h.properties]), before);
  assert.doesNotMatch(h.logs.join(""), /PRIVATE|fake-test-secret|1234567890|applicant@example/);
});

test("creating diagnostic does not assume no item exists or query unrelated applicants", () => {
  const h = diagnosticHarness("creating");
  h.columns.find(c => c.id === "col_gender").settings.labels.pop();
  const result = h.inspect();
  assert.equal(result.itemCreationConfirmed, false);
  assert.equal(result.manualReviewRequired, true);
  assert.deepEqual(result.columnIssues, [{ field: "gender", issue: "missing_status_labels", expectedOptions: ["Decline to Self Identify"] }]);
  assert.equal(h.queries.length, 1);
  assert.equal(result.uploadedFileCounts, undefined);
});

test("diagnostic handles absent receipts and invalid references without API calls", () => {
  const h = diagnosticHarness();
  h.properties.delete("application:" + h.body.requestId);
  assert.deepEqual(h.inspect(), { receiptFound: false });
  assert.equal(h.queries.length, 0);
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", "invalid");
  assert.throws(h.inspect, /Set JOB_DIAGNOSTIC_REFERENCE/);
});

test("diagnostic does not print private provider errors or claim failed lookups passed", () => {
  const h = diagnosticHarness();
  h.context.monday_ = () => { throw new Error("PRIVATE fake-test-secret applicant@example.test"); };
  const result = h.inspect();
  assert.equal(result.boardMetadataCheck, "failed");
  assert.equal(result.attachmentCheck, "failed");
  assert.equal(result.uploadedFileCounts, undefined);
  assert.doesNotMatch(h.logs.join(""), /PRIVATE|fake-test-secret|applicant@example/);
});

test("item creation omits an unset group and explicitly includes a configured group", () => {
  for (const group of [null, "topics"]) {
    const h = harness();
    if (group) h.properties.set("MONDAY_GROUP_ID", group);
    assert.equal(h.post(h.body).ok, true);
    const request = JSON.parse(h.creates()[0].request.payload);
    if (group) {
      assert.equal(request.variables.group, "topics");
      assert.match(request.query, /group_id: \$group/);
    } else {
      assert.equal(Object.hasOwn(request.variables, "group"), false);
      assert.doesNotMatch(request.query, /\$group|group_id/);
    }
  }
});

test("empty GraphQL errors arrays do not turn confirmed writes into failures", () => {
  const h = harness({ emptyErrors: true });
  assert.equal(h.post(h.body).ok, true);
  assert.equal(JSON.parse(h.properties.get("application:" + h.body.requestId)).phase, "complete");
});

test("provider diagnostics retain allowlisted codes and field keys but never private payloads", () => {
  const h = harness({ createResponse: { errors: [
    { message: "PRIVATE applicant@example.test fake-test-secret", extensions: {
      code: "ColumnValueException", error_data: { column_id: "col_phone", column_value: "PRIVATE PHONE" }
    } },
    { message: "PRIVATE", extensions: { code: "PRIVATE_SECRET_IN_CODE", error_data: { column_id: "PRIVATE" } } }
  ] } });
  const logs = [];
  h.context.console.log = value => logs.push(value);
  const result = h.post(h.body);
  const receipt = JSON.parse(h.properties.get("application:" + h.body.requestId));
  assert.deepEqual(receipt.failure, { httpStatus: 200, codes: ["ColumnValueException", "UNKNOWN_PROVIDER_ERROR"], fields: ["phone"] });
  assert.doesNotMatch(JSON.stringify(receipt) + logs.join(""), /PRIVATE|applicant@example|fake-test-secret/);
  assert.doesNotMatch(JSON.stringify(result), /ColumnValueException|col_phone|PRIVATE/);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
});

test("partial creation responses preserve the item ID and remain blocked from retry", () => {
  const h = harness({ createResponse: {
    data: { create_item: { id: "1234567890" } }, errors: [{ extensions: { code: "UNKNOWN" } }]
  } });
  assert.equal(h.post(h.body).ok, false);
  const receipt = JSON.parse(h.properties.get("application:" + h.body.requestId));
  assert.equal(receipt.itemId, "1234567890");
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", h.body.requestId);
  assert.throws(() => h.context.approveReviewedJobApplicationRetry(), /cannot be approved/);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
});

test("transport, non-JSON, and HTTP errors produce safe diagnostics without retrying", () => {
  for (const [options, code, status] of [
    [{ createError: true }, "TRANSPORT_ERROR", null],
    [{ createResponse: "<html>PRIVATE</html>", httpStatus: 502 }, "INVALID_JSON_RESPONSE", 502],
    [{ createResponse: { errors: [{ extensions: { code: "UserUnauthorizedException" } }] }, httpStatus: 403 }, "UserUnauthorizedException", 403]
  ]) {
    const h = harness(options);
    assert.equal(h.post(h.body).ok, false);
    const receipt = JSON.parse(h.properties.get("application:" + h.body.requestId));
    assert.equal(receipt.failure.httpStatus, status);
    assert.deepEqual(receipt.failure.codes, [code]);
    assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE/);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.creates().length, 1);
  }
});

test("an explicit reviewed retry preserves the reference and is consumed by the next attempt", () => {
  const options = { createError: true };
  const h = harness(options);
  assert.equal(h.post(h.body).ok, false);
  const original = JSON.parse(h.properties.get("application:" + h.body.requestId));
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", h.body.requestId);
  h.context.approveReviewedJobApplicationRetry();
  const approved = JSON.parse(h.properties.get("application:" + h.body.requestId));
  assert.equal(approved.hash, original.hash);
  assert.equal(approved.phase, "retry_approved");
  assert(approved.reviewedAt);
  assert.throws(() => h.context.approveReviewedJobApplicationRetry(), /cannot be approved/);
  options.createError = false;
  assert.equal(h.post(h.body).ok, true);
  assert.equal(h.post(h.body).ok, true);
  assert.equal(h.creates().length, 2);
  assert.throws(() => h.context.approveReviewedJobApplicationRetry(), /cannot be approved/);
});

test("review approval does not permit changed answers or automatic repeat attempts", () => {
  const h = harness({ createError: true });
  h.post(h.body);
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", h.body.requestId);
  h.context.approveReviewedJobApplicationRetry();
  h.body.values.name = "Changed name";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
  h.body.values.name = "Test Applicant";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 2);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 2);
});

function reviewedRetryHarness() {
  const options = { createError: true };
  const h = harness(options);
  const key = "application:" + h.body.requestId;
  assert.equal(h.post(h.body).ok, false);
  h.properties.set("JOB_DIAGNOSTIC_REFERENCE", h.body.requestId);
  h.context.approveReviewedJobApplicationRetry();
  options.createError = false;
  return { ...h, options, key, receipt: () => JSON.parse(h.properties.get(key)) };
}

test("editor approval allows corrected answers and files once, preserving private hash audit", () => {
  const h = reviewedRetryHarness();
  const original = h.receipt();
  const callsBefore = h.calls.length;
  const logs = [];
  h.context.console.log = value => logs.push(value);
  h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers();
  const approved = h.receipt();
  assert.equal(approved.hash, original.hash);
  assert.equal(approved.allowUpdatedAnswers, true);
  assert(approved.updatedAnswersApprovedAt);
  assert.equal(h.calls.length, callsBefore);
  h.body.values.name = "Corrected synthetic applicant";
  h.body.files.cv = { name: "corrected-test.pdf", data: Buffer.from("%PDF-1.4\nCorrected synthetic CV\n%%EOF").toString("base64") };
  h.body.files.coverLetter = { ...h.body.files.cv, name: "cover.pdf" };
  assert.equal(h.post(h.body).ok, true);
  const completed = h.receipt();
  assert.equal(completed.phase, "complete");
  assert.notEqual(completed.hash, original.hash);
  assert.equal(completed.previousHash, original.hash);
  assert.equal(completed.reviewedAt, original.reviewedAt);
  assert.equal(completed.updatedAnswersApprovedAt, approved.updatedAnswersApprovedAt);
  assert.equal(completed.allowUpdatedAnswers, undefined);
  assert.equal(h.post(h.body).ok, true);
  h.body.values.name = "Another change";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 2);
  assert.equal(h.calls.filter(call => call.url.endsWith("/file")).length, 2);
  assert.doesNotMatch(JSON.stringify(completed) + logs.join(""), /synthetic|corrected-test|applicant@example|fake-test-secret/);
  assert.throws(() => h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers(), /cannot be approved/);
});

test("updated-answer permission is consumed even by unchanged answers or a failed write", () => {
  for (const failure of ["create", "partial", "upload"]) {
    const h = reviewedRetryHarness();
    h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers();
    if (failure === "create") h.options.createError = true;
    if (failure === "partial") h.options.createResponse = {
      data: { create_item: { id: "1234567890" } }, errors: [{ extensions: { code: "UNKNOWN" } }]
    };
    if (failure === "upload") h.options.uploadError = true;
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.receipt().allowUpdatedAnswers, undefined);
    assert.notEqual(h.receipt().phase, "retry_approved");
    assert.equal(h.post(h.body).ok, false);
    h.body.values.name = "Changed after failed write";
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.creates().length, 2);
    assert.throws(() => h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers(), /cannot be approved/);
  }
});

test("updated-answer approval still requires validation, configuration, Turnstile, and locking", () => {
  for (const change of [
    h => h.body.values.email = "invalid", h => h.body.files.cv = null,
    h => h.options.bot = true, h => h.options.lock = false,
    h => h.properties.delete("TURNSTILE_SECRET")
  ]) {
    const h = reviewedRetryHarness();
    h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers();
    const approved = h.properties.get(h.key);
    h.body.values.name = "Corrected synthetic applicant";
    change(h);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.creates().length, 1);
    assert.equal(h.properties.get(h.key), approved);
  }
});

test("updated-answer editor approval rejects unreviewed, completed, malformed, and item-backed receipts", () => {
  for (const change of [
    r => r.phase = "creating", r => r.phase = "uploading", r => r.phase = "complete",
    r => r.itemId = "1234567890", r => delete r.reviewedAt,
    r => r.reviewedAt = "invalid", r => r.hash = "", r => delete r.hash
  ]) {
    const h = reviewedRetryHarness();
    const receipt = h.receipt();
    change(receipt);
    h.properties.set(h.key, JSON.stringify(receipt));
    const before = JSON.stringify([...h.properties]);
    const calls = h.calls.length;
    assert.throws(() => h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers(), /cannot be approved/);
    assert.equal(JSON.stringify([...h.properties]), before);
    assert.equal(h.calls.length, calls);
  }
  for (const change of [
    h => h.properties.delete(h.key), h => h.properties.set("JOB_DIAGNOSTIC_REFERENCE", "invalid"),
    h => h.options.lock = false
  ]) {
    const h = reviewedRetryHarness();
    change(h);
    const before = JSON.stringify([...h.properties]);
    assert.throws(() => h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers());
    assert.equal(JSON.stringify([...h.properties]), before);
  }
});

test("public POST flags cannot approve updated answers and private flags require a reviewed receipt", () => {
  const h = reviewedRetryHarness();
  h.body.values.name = "Changed without editor approval";
  h.body.allowUpdatedAnswers = true;
  h.body.reviewedAt = new Date().toISOString();
  h.body.phase = "retry_approved";
  const before = h.properties.get(h.key);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.properties.get(h.key), before);
  for (const overrides of [
    { allowUpdatedAnswers: "true" }, { allowUpdatedAnswers: true, reviewedAt: null },
    { allowUpdatedAnswers: true, phase: "creating" },
    { allowUpdatedAnswers: true, itemId: "1234567890" },
    { allowUpdatedAnswers: true, phase: "complete" }
  ]) {
    h.properties.set(h.key, JSON.stringify({ ...JSON.parse(before), ...overrides }));
    assert.equal(h.post(h.body).ok, false);
  }
  assert.equal(h.creates().length, 1);
});

test("diagnostic reports updated-answer approval without leaking hashes or writing anything", () => {
  const h = diagnosticHarness("creating");
  assert.equal(h.inspect().updatedAnswersRetryApproved, false);
  h.context.approveReviewedJobApplicationRetry();
  assert.equal(h.inspect().updatedAnswersRetryApproved, false);
  h.context.approveReviewedJobApplicationRetryWithUpdatedAnswers();
  const before = JSON.stringify([...h.properties]);
  assert.equal(h.inspect().updatedAnswersRetryApproved, true);
  assert.equal(JSON.stringify([...h.properties]), before);
  assert.doesNotMatch(h.logs.join(""), /PRIVATE_RECEIPT_HASH|fake-test-secret|applicant@example/);
});
