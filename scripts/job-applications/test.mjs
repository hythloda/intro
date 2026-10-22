import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import { buildJobApplicationScript } from "./build.mjs";

const serverSource = readFileSync(new URL("Code.gs", import.meta.url), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const publicPages = {
  "head-of-korea": "country-manager-korea",
  "head-of-japan": "country-manager-japan"
};

function publicApplication(h, role) {
  const schema = h.context.jobApplicationSchemaForRole(role);
  const values = Object.fromEntries(schema.fields.filter(f => f.type !== "file").map(f => [f.key, h.body.values[f.key] || ""]));
  values.referral = "";
  return { ...h.body, role, formRevision: schema.formRevision, values, password: undefined };
}

for (const [role, board, suffix] of [["head-of-korea", "18436483787", "_KOREA"], ["head-of-japan", "18436483844", "_JAPAN"]]) {
  test(role + " submits without a password only to its own private board", () => {
    const h = harness({ phoneType: "text" });
    const ceoMapping = h.properties.get("JOB_COLUMN_MAP");
    h.context.setupPublicJobApplications();
    assert.equal(h.properties.get("JOB_COLUMN_MAP"), ceoMapping);
    h.properties.delete("JOB_ACCESS_PASSWORD");
    const ready = JSON.parse(h.context.doGet({ parameter: { role } }).text);
    assert.equal(ready.acceptingApplications, true);
    assert.equal(ready.passwordRequired, false);
    assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, false);
    const body = publicApplication(h, role);
    if (role === "head-of-japan") body.values.salaryExpectations = "";
    body.values.phone = "+82 10 0000 0000";
    assert.equal(h.post(body).ok, true);
    const payload = JSON.parse(h.creates()[0].request.payload);
    assert.equal(payload.variables.board, board);
    assert.equal(payload.variables.group, "topics");
    const values = JSON.parse(payload.variables.values);
    if (role === "head-of-japan") assert.equal(values.col_salaryExpectations, undefined);
    assert.equal(values.col_phone, body.values.phone);
    assert.deepEqual(values.col_applicationStatus, { label: "New" });
    assert.equal(values.col_applicationReference, body.requestId);
    assert(h.properties.has("application:" + role + ":" + body.requestId));
    assert.equal(h.emails.length, 1);
    assert(h.emails[0].subject.includes(h.context.jobApplicationSchemaForRole(role).roleTitle));
    assert.equal(h.post(body).ok, true);
    assert.equal(h.creates().length, 1);
    assert.equal(h.emails.length, 1);
    assert.equal(JSON.parse(h.properties.get("JOB_COLUMN_MAP" + suffix))._target.board, board);
  });

  test(role + " cannot reuse CEO mappings or bypass Turnstile", () => {
    const h = harness();
    h.context.setupPublicJobApplications();
    h.properties.set("JOB_COLUMN_MAP" + suffix, h.properties.get("JOB_COLUMN_MAP"));
    assert.equal(h.post(publicApplication(h, role)).ok, false);
    assert.equal(h.creates().length, 0);
    for (const options of [{ bot: true }, { hostname: "evil.test" }, { action: "job_application_access" }]) {
      const blocked = harness(options);
      blocked.context.setupPublicJobApplications();
      assert.equal(blocked.post(publicApplication(blocked, role)).ok, false);
      assert.equal(blocked.creates().length, 0);
    }
  });

  test(role + " uses native public fields, no private-role link or US survey", async () => {
    const h = await clientReadinessHarness({ role, acceptingApplications: true, passwordRequired: false }, { pageRole: role });
    h.context.window.onJobVerificationReady();
    assert.equal(h.nodes.get("#application-fields").disabled, false);
    assert.equal(h.nodes.get("#application-submit").disabled, false);
    assert.equal(h.widgets[0].settings.action, "job_application");
    assert.equal(h.created.find(node => node.name === "referral").required, false);
    assert.equal(h.created.some(node => node.name === "salaryExpectations"), role !== "head-of-japan");
    assert(!h.created.some(node => ["gender", "hispanicLatino", "veteran"].includes(node.name)));
    assert(h.requests[0].url.includes("?role=" + role));
    const html = readFileSync(new URL("../../" + publicPages[role] + ".html", import.meta.url), "utf8");
    assert.match(html, /id="application" aria-labelledby="application-title">/);
    assert.match(html, /Key Responsibilities/);
    assert.match(html, /Native-level (Korean|Japanese)/);
    assert.doesNotMatch(html, /president-and-ceo|President and CEO|application-access|application-voluntary|<iframe/);
    assert(html.includes('data-role="' + role + '"'));
    assert(html.includes('rel="canonical" href="https://intro.canton.foundation/' + publicPages[role] + '.html"'));
  });

  test(role + " shared links redirect to the Country Manager page with query and application anchor", () => {
    const html = readFileSync(new URL("../../" + role + ".html", import.meta.url), "utf8");
    const target = publicPages[role] + ".html";
    assert(html.includes('http-equiv="refresh" content="0; url=' + target + '"'));
    assert.doesNotMatch(html, /<form\b/);
    let redirected;
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
      window: { location: { search: "?source=shared", hash: "#application", replace: url => redirected = url } }
    });
    assert.equal(redirected, target + "?source=shared#application");
  });
}

test("public requests cannot change CEO access policy or read another role's receipt", () => {
  const h = harness();
  h.context.setupPublicJobApplications();
  for (const role of ["head-of-korea", "head-of-japan"]) assert(h.post(publicApplication(h, role)).ok);
  assert.equal(h.creates().length, 2);
  assert.equal(h.post({ ...h.body, password: "", passwordRequired: false, boardId: "18436483787" }).accessRequired, true);
  assert.equal(JSON.parse(h.context.doGet().text).passwordRequired, true);
  assert(h.post(h.body).ok);
  assert.equal(h.creates().length, 3);
  assert.equal(JSON.parse(h.creates()[2].request.payload).variables.board, "18434504661");
  assert.equal(h.emails.length, 3);
});

test("unknown roles fail closed even after a public request", () => {
  const h = harness();
  h.context.setupPublicJobApplications();
  h.context.doGet({ parameter: { role: "head-of-korea" } });
  for (const role of ["__proto__", "constructor", "head-of-korea ", "accounting-manager"]) {
    assert.equal(h.post({ ...h.body, role }).ok, false);
    assert.equal(JSON.parse(h.context.doGet({ parameter: { role } }).text).acceptingApplications, false);
  }
  assert.equal(h.creates().length, 0);
});

test("Code.gs is a complete standalone deployment with no additional gs files", () => {
  assert.equal(serverSource, buildJobApplicationScript());
  const context = vm.createContext({});
  vm.runInContext(serverSource, context);
  for (const name of ["doGet", "doPost", "setupJobApplication", "inspectJobColumns",
    "inspectJobApplicationFailure", "approveReviewedJobApplicationRetry",
    "approveReviewedJobApplicationRetryWithUpdatedAnswers", "authorizeJobApplicationEmail"]) {
    assert.equal(typeof context[name], "function", name + " must exist in Code.gs alone");
    assert.equal((serverSource.match(new RegExp("^function " + name + "\\(", "gm")) || []).length, 1);
  }
  assert.equal(context.JOB_APPLICATION_SCHEMA.fields.length, 20);
  assert.equal(context.JOB_APPLICATION_SCHEMA.countryNames.US, "United States");
});

function harness(options = {}) {
  const properties = new Map();
  const calls = [];
  const emails = [];
  const store = {
    getProperty: key => properties.get(key) ?? null,
    setProperty: (key, value) => {
      if (key.startsWith("application:") && options.failEmailReceiptStatus && options.failEmailReceiptStatus === JSON.parse(value).confirmationEmail?.status) throw new Error("PRIVATE STORAGE ERROR");
      return properties.set(key, value);
    },
    getProperties: () => Object.fromEntries(properties)
  };
  const response = (data, status = 200) => ({ getResponseCode: () => status, getContentText: () => typeof data === "string" ? data : JSON.stringify(data) });
  const context = vm.createContext({
    console: { log() {} },
    PropertiesService: { getScriptProperties: () => store },
    LockService: { getScriptLock: () => ({ tryLock: () => options.lock !== false, releaseLock() {} }) },
    MailApp: {
      getRemainingDailyQuota() {
        if (options.mailPermissionError) throw new Error("PRIVATE MAIL PERMISSION ERROR");
        return options.mailQuota ?? 100;
      },
      sendEmail(message) {
        const receipt = [...properties].find(([key, value]) => key.startsWith("application:") && JSON.parse(value).confirmationEmail?.status === "sending");
        assert.equal(JSON.parse(receipt[1]).phase, "complete");
        assert.equal(JSON.parse(receipt[1]).confirmationEmail.status, "sending");
        emails.push(plain(message));
        if (options.mailError) throw new Error("PRIVATE RECIPIENT ERROR applicant@example.test");
      }
    },
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
      const columns = context.JOB_APPLICATION_SCHEMA.fields.filter(f => !f.auxiliary).map(f => ({ title: f.columnTitle || f.label, id: "col_" + f.key, type: f.key === "phone" ? options.phoneType || "phone" : f.columnTypes[0] }));
      if (!options.omitReferenceColumn) columns.push({ title: "Application Reference", id: "col_applicationReference", type: options.referenceType || "text" });
      if (context.JOB_ROLE.suffix) columns.push({ title: "Application Status", id: "col_applicationStatus", type: "status" });
      if (options.extraColumns) columns.push(...options.extraColumns);
      return response({ data: { boards: [{ columns, groups: [{ id: "new", title: "New applicants" }, { id: "topics", title: "New Applications" }] }] } });
    } }
  });
  vm.runInContext(serverSource, context);
  properties.set("MONDAY", "fake-test-secret");
  properties.set("TURNSTILE_SECRET", "fake-test-secret");
  properties.set("JOB_ACCESS_PASSWORD", "synthetic-access-password");
  context.setupJobApplication();
  calls.length = 0;
  const schema = context.JOB_APPLICATION_SCHEMA;
  const values = Object.fromEntries(schema.fields.filter(f => f.type !== "file").map(f => [f.key, ""]));
  Object.assign(values, { name: "Test Applicant", email: "applicant@example.test", country: "US", address: "123 Example Street, Example City, NY 10001, USA", startDate: "2026-11-01", salaryExpectations: "USD 200,000 annually", referral: "Example Referrer", sponsorship: "No", previousWork: "No", restrictions: "No" });
  const body = { role: schema.role, formRevision: schema.formRevision, requestId: randomUUID(), token: "test-token", password: "synthetic-access-password", website: "", values, files: { cv: { name: "test.pdf", data: Buffer.from("%PDF-1.4\nSynthetic test fixture\n%%EOF").toString("base64") } } };
  const post = value => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(value) } }).text);
  const creates = () => calls.filter(c => c.url.endsWith("/v2") && JSON.parse(c.request.payload).query.includes("create_item"));
  return { context, properties, calls, emails, body, post, creates };
}

test("standalone GET and invalid POST return JSON without creating a Monday item", () => {
  const h = harness();
  assert.deepEqual(JSON.parse(h.context.doGet().text), { service: "Canton Foundation job applications", role: "president-and-ceo", acceptingApplications: true, passwordRequired: true });
  const result = h.post({});
  assert.equal(result.ok, false);
  assert.equal(result.requestId, "");
  assert.equal(result.message, "Invalid application request. Please refresh the page.");
  assert.equal(h.calls.length, 0);
});

test("setup binds column IDs to the new role, board, and selected group", () => {
  const h = harness();
  assert.deepEqual(JSON.parse(h.properties.get("JOB_COLUMN_MAP"))._target,
    { role: "president-and-ceo", board: "18434504661", groupId: null });
  h.properties.set("MONDAY_GROUP_ID", "new");
  assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, false);
  h.context.setupJobApplication();
  assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, true);
  assert(h.post(h.body).ok);
  const mutation = JSON.parse(h.creates()[0].request.payload);
  assert.equal(mutation.variables.board, "18434504661");
  assert.equal(mutation.variables.group, "new");
});

test("readiness and submissions fail closed for stale destination mappings without exposing configuration", () => {
  for (const target of [null, { board: "18432556545", role: "accounting-manager", groupId: null },
    { board: "18434504661", role: "accounting-manager", groupId: null },
    { board: "18434504661", role: "president-and-ceo", groupId: "old-group" }]) {
    const h = harness();
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping._target = target;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    const response = JSON.parse(h.context.doGet().text);
    assert.deepEqual(response, { service: "Canton Foundation job applications", role: "president-and-ceo", acceptingApplications: false, passwordRequired: true });
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.emails.length, 0);
    assert.equal(h.properties.has("application:" + h.body.requestId), false);
  }
});

test("old Accounting Manager payloads cannot create records in the new board", () => {
  const h = harness();
  h.body.role = "accounting-manager";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.emails.length, 0);
});

test("cached old form scripts cannot post even if they load the new shared schema", () => {
  const h = harness();
  delete h.body.formRevision;
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.calls.length, 0);
});

test("Salary Expectations is optional free text and reaches its own text or long-text column", () => {
  for (const type of ["text", "long_text"]) {
    const h = harness();
    const field = h.context.JOB_APPLICATION_SCHEMA.fields.find(f => f.key === "salaryExpectations");
    assert.equal(field.type, "text");
    assert.equal(Boolean(field.required), false);
    assert.match(field.help, /optional/i);
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping.salaryExpectations.type = type;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    h.body.values.salaryExpectations = "  USD 200,000-250,000 annually; open to discussion  ";
    assert(h.post(h.body).ok);
    const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
    const expected = h.body.values.salaryExpectations.trim();
    assert.deepEqual(values.col_salaryExpectations, type === "text" ? expected : { text: expected });
    assert(!h.emails[0].body.includes(expected));
    assert(!JSON.stringify([...h.properties]).includes(expected));
  }
  const long = harness();
  long.body.values.salaryExpectations = "x".repeat(1001);
  assert.deepEqual(long.post(long.body).fields, ["salaryExpectations"]);
  assert.equal(long.calls.length, 0);
});

test("salary may be left blank while referral is supplied", () => {
  const h = harness();
  h.body.values.salaryExpectations = "   ";
  assert(h.post(h.body).ok);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.equal(values.col_salaryExpectations, undefined);
  assert.equal(values.col_referral, "Example Referrer");
});

test("required referral maps to its own Referral text or long-text column", () => {
  for (const type of ["text", "long_text"]) {
    const h = harness();
    const field = h.context.JOB_APPLICATION_SCHEMA.fields.find(f => f.key === "referral");
    assert.equal(field.label, "Who can you thank for your referral?");
    assert.equal(field.columnTitle, "Referral");
    assert.equal(field.type, "text");
    assert.equal(field.required, true);
    assert.doesNotMatch(field.help, /optional/i);
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping.referral.type = type;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    h.body.values.referral = "  Example Referrer at Example Organization  ";
    assert(h.post(h.body).ok);
    const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
    const expected = h.body.values.referral.trim();
    assert.deepEqual(values.col_referral, type === "text" ? expected : { text: expected });
    assert(!h.emails[0].body.includes(expected));
    assert(!JSON.stringify([...h.properties]).includes(expected));
  }
});

test("invalid referral answers are rejected before external calls", () => {
  for (const value of ["", "   ", null, {}, "x".repeat(1001)]) {
    const h = harness();
    h.body.values.referral = value;
    assert.deepEqual(h.post(h.body).fields, ["referral"]);
    assert.equal(h.calls.length, 0);
    assert.equal(h.emails.length, 0);
    assert.equal(h.properties.has("application:" + h.body.requestId), false);
  }
});

test("omitting the referral field cannot bypass required validation", () => {
  const h = harness();
  delete h.body.values.referral;
  assert.deepEqual(h.post(h.body).fields, ["referral"]);
  assert.equal(h.calls.length, 0);
  assert.equal(h.emails.length, 0);
  assert.equal(h.properties.has("application:" + h.body.requestId), false);
});

test("pre-reopening form revisions cannot submit with optional-referral rules", () => {
  const h = harness();
  h.body.formRevision = "ceo-20261007";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.emails.length, 0);
  assert.equal(h.properties.has("application:" + h.body.requestId), false);
});

test("missing referral destination or wrong type blocks readiness and submissions", () => {
  for (const destination of [null, { id: "col_referral", type: "numbers" }]) {
    const h = harness();
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping.referral = destination;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, false);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
  }
});

test("missing salary destination or wrong type blocks readiness and submissions", () => {
  for (const destination of [null, { id: "col_salaryExpectations", type: "numbers" }]) {
    const h = harness();
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping.salaryExpectations = destination;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, false);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
  }
});

test("success creates the correct board item, uploads CV, and returns no applicant data", () => {
  const h = harness();
  const result = h.post(h.body);
  assert.deepEqual(result, { ok: true, requestId: h.body.requestId, confirmationEmail: "sent" });
  const mutation = JSON.parse(h.creates()[0].request.payload);
  assert.equal(mutation.variables.board, "18434504661");
  const values = JSON.parse(mutation.variables.values);
  assert.equal(values.col_applicationReference, result.requestId);
  assert(h.emails[0].body.includes("Application reference: " + values.col_applicationReference));
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
  assert.equal(h.emails.length, 1);
});

test("setup requires one unambiguous Application Reference text column", () => {
  for (const options of [
    { omitReferenceColumn: true },
    { referenceType: "numbers" },
    { extraColumns: [{ title: "Application Reference", id: "duplicate_reference", type: "text" }] }
  ]) {
    assert.throws(() => harness(options), /Review column mapping for: Application Reference/);
  }
  const h = harness();
  assert.deepEqual(JSON.parse(h.properties.get("JOB_COLUMN_MAP")).applicationReference,
    { id: "col_applicationReference", type: "text" });
  assert(!h.context.JOB_APPLICATION_SCHEMA.fields.some(f => f.key === "applicationReference"));
});

test("a verified reference column override is respected without overwriting another answer", () => {
  const h = harness({ extraColumns: [{ title: "Recruitment ID", id: "custom_reference", type: "text" }] });
  h.properties.set("JOB_COLUMN_OVERRIDES", JSON.stringify({ applicationReference: "custom_reference" }));
  h.context.setupJobApplication();
  assert(h.post(h.body).ok);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.equal(values.custom_reference, h.body.requestId);
  assert.equal(values.col_applicationReference, undefined);
  const mappingBefore = h.properties.get("JOB_COLUMN_MAP");
  h.properties.set("JOB_COLUMN_OVERRIDES", JSON.stringify({ applicationReference: "col_adjustments" }));
  assert.throws(() => h.context.setupJobApplication(), /cannot share a destination column/);
  assert.equal(h.properties.get("JOB_COLUMN_MAP"), mappingBefore);
});

test("missing or invalid saved reference mapping fails before external calls or receipts", () => {
  for (const destination of [null, { id: "col_applicationReference", type: "numbers" }, { id: "col_adjustments", type: "text" }]) {
    const h = harness();
    const mapping = JSON.parse(h.properties.get("JOB_COLUMN_MAP"));
    mapping.applicationReference = destination;
    h.properties.set("JOB_COLUMN_MAP", JSON.stringify(mapping));
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.properties.has("application:" + h.body.requestId), false);
  }
});

test("the reference is in the original creation even when attachment upload fails", () => {
  const h = harness({ uploadError: true });
  const result = h.post(h.body);
  assert.equal(result.ok, false);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.equal(values.col_applicationReference, result.requestId);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
  assert.equal(h.emails.length, 0);
});

test("applicants cannot supply a separate reference field or an invalid receipt ID", () => {
  for (const change of [b => b.values.applicationReference = "different", b => b.requestId = "not-a-uuid"]) {
    const h = harness();
    change(h.body);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
  }
});

test("a reused receipt with changed answers cannot alter or duplicate an application", () => {
  const h = harness(); h.post(h.body); h.body.values.name = "Different";
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.creates().length, 1);
});

for (const key of ["name", "email", "country", "address", "sponsorship", "previousWork", "restrictions", "startDate", "referral"]) {
  test("rejects missing required " + key, () => {
    for (const blank of ["", "   ", undefined]) {
      const h = harness(); h.body.values[key] = blank;
      const result = h.post(h.body);
      assert.equal(result.ok, false); assert(result.fields.includes(key)); assert.equal(h.calls.length, 0);
      assert.equal(h.emails.length, 0);
      assert.equal(h.properties.has("application:" + h.body.requestId), false);
    }
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
  for (const page of ["president-and-ceo.html"]) {
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
  assert.equal(h.context.JOB_APPLICATION_SCHEMA.fields.length, 20);
  assert(h.context.JOB_APPLICATION_SCHEMA.fields.filter(f => f.section === "voluntary").every(f => !f.required));
  const c = {}; vm.runInNewContext(readFileSync(new URL("../../assets/job-application-config.js", import.meta.url), "utf8"), { window: c });
  const config = plain(c.JOB_APPLICATION_CONFIG);
  assert.deepEqual(Object.keys(config).sort(), ["enabled", "endpoint", "turnstileSiteKey"]);
  assert.match(config.endpoint, /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/);
  assert.match(config.turnstileSiteKey, /^0x[\w-]+$/);
  assert.equal(typeof config.enabled, "boolean");
});

test("native questions are hidden and disabled until access is verified, without an external form link", () => {
  const jobs = readFileSync(new URL("../../jobs.html", import.meta.url), "utf8");
  const role = readFileSync(new URL("../../president-and-ceo.html", import.meta.url), "utf8");
  assert(!/<iframe\b/i.test(jobs + role));
  assert.doesNotMatch(jobs, /href="president-and-ceo\.html"/);
  assert.doesNotMatch(role, /<form id="job-application"[^>]*\bhidden\b/);
  assert.match(role, /<section[^>]*id="application"[^>]*\bhidden\b/);
  assert.match(role, /id="application-password"[^>]*type="password"/);
  assert.match(role, /<fieldset id="application-fields"[^>]*\bdisabled\b/);
  assert.match(role, /<button[^>]*id="application-submit"[^>]*\bdisabled\b/);
  assert(role.includes("Applications are temporarily unavailable"));
  assert.doesNotMatch(role + jobs, /(?:wkf\.ms|forms\.monday\.com)/);
});

test("direct CEO applications are restored without advertising the role on the homepage or jobs listing", () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(new URL("../../assets/job-application-config.js", import.meta.url), "utf8"), context);
  assert.equal(context.window.JOB_APPLICATION_CONFIG.enabled, true);
  const deploy = readFileSync(new URL("../../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.doesNotMatch(deploy, /president-and-ceo\.html/);
  const home = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(home, /href="jobs\.html"/);
  assert.doesNotMatch(home, /president-and-ceo|President and CEO/);
  const jobs = readFileSync(new URL("../../jobs.html", import.meta.url), "utf8");
  assert.match(jobs, /href="country-manager-korea\.html"/);
  assert.match(jobs, /href="country-manager-japan\.html"/);
  assert.doesNotMatch(jobs, /href="head-of-(korea|japan)\.html"/);
  assert.doesNotMatch(jobs, /President and CEO|<form\b|<iframe\b|job-application(?:-schema|-config)?\.js/);
  const role = readFileSync(new URL("../../president-and-ceo.html", import.meta.url), "utf8");
  assert.match(role, /job-application-config\.js\?v=20261020-reopen1/);
  assert.match(role, /job-application-schema\.js\?v=20261021-public1/);
  assert.match(role, /id="application-unavailable" hidden/);
  assert.equal(existsSync(new URL("../../job-application-check.html", import.meta.url)), false);
});

function diagnosticHarness(phase = "uploading") {
  const h = harness();
  const logs = [], queries = [];
  const columns = h.context.JOB_APPLICATION_SCHEMA.fields.filter(f => !f.auxiliary).map(f => ({
    id: "col_" + f.key, type: f.key === "phone" ? "phone" : f.columnTypes[0],
    settings: { labels: (f.options || []).map(label => ({ label })) }
  }));
  columns.push({ id: "col_applicationReference", type: "text" });
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
      : { items: [{ board: { id: "18434504661" }, column_values: files }] };
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

test("diagnostics identify a missing reference destination without reading applicant answers", () => {
  const h = diagnosticHarness("creating");
  h.columns.splice(h.columns.findIndex(c => c.id === "col_applicationReference"), 1);
  const report = h.inspect();
  assert.deepEqual(report.columnIssues, [{ field: "applicationReference", issue: "missing_or_changed_column" }]);
  assert.equal(h.queries.length, 1);
  const safe = plain(h.context.safeMondayDiagnostic_(200, {
    errors: [{ extensions: { code: "ColumnValueException", error_data: { column_id: "col_applicationReference" } } }]
  }, { mapping: JSON.parse(h.properties.get("JOB_COLUMN_MAP")) }));
  assert.deepEqual(safe.fields, ["applicationReference"]);
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
  for (const group of [null, "new"]) {
    const h = harness();
    if (group) {
      h.properties.set("MONDAY_GROUP_ID", group);
      h.context.setupJobApplication();
    }
    assert.equal(h.post(h.body).ok, true);
    const request = JSON.parse(h.creates()[0].request.payload);
    if (group) {
      assert.equal(request.variables.group, "new");
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

test("text Phone preserves formatting and extensions without requiring a phone country", () => {
  for (const phone of ["(202) 555-0123", "+1 202 555 0123 ext. 9", "555-0123", "1234567890"]) {
    const h = harness({ phoneType: "text" });
    h.body.values.phone = phone;
    assert.equal(h.body.values.phoneCountry, "");
    assert.equal(h.post(h.body).ok, true);
    const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
    assert.equal(values.col_phone, phone);
    assert.equal(typeof values.col_phone, "string");
    assert.equal(values.col_phoneCountry, undefined);
  }
});

test("rerunning setup replaces the old saved phone mapping with the uniquely named text column", () => {
  const options = {};
  const h = harness(options);
  assert.equal(JSON.parse(h.properties.get("JOB_COLUMN_MAP")).phone.type, "phone");
  options.extraColumns = [{ id: "new_text_phone", title: "Phone", type: "text" }];
  h.context.setupJobApplication();
  assert.deepEqual(JSON.parse(h.properties.get("JOB_COLUMN_MAP")).phone, { id: "new_text_phone", type: "text" });
  h.body.values.phone = "+1 202 555 0123 ext. 9";
  assert.equal(h.post(h.body).ok, true);
  const values = JSON.parse(JSON.parse(h.creates()[0].request.payload).variables.values);
  assert.equal(values.new_text_phone, h.body.values.phone);
  assert.equal(values.col_phone, undefined);
});

test("setup fails on ambiguous text Phone columns rather than guessing", () => {
  assert.throws(() => harness({ phoneType: "text", extraColumns: [{ id: "other_phone", title: "Phone", type: "text" }] }), /Review column mapping for: Phone/);
});

test("text Phone still rejects control characters and overlong input before sending", () => {
  for (const phone of ["hello", "12\u0000data", "123\n456", "1".repeat(41)]) {
    const h = harness({ phoneType: "text" });
    h.body.values.phone = phone;
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.emails.length, 0);
  }
});

test("confirmation emails thank one applicant, use HR replies, and contain no application answers or attachments", () => {
  const h = harness();
  h.body.values.adjustments = "PRIVATE ADJUSTMENTS";
  h.body.values.gender = "Female";
  assert.equal(h.post(h.body).confirmationEmail, "sent");
  assert.equal(h.emails.length, 1);
  const email = h.emails[0];
  assert.equal(email.to, "applicant@example.test");
  assert.equal(email.replyTo, "hr@canton.foundation");
  assert.equal(email.name, "Canton Foundation Recruitment");
  assert.match(email.subject, /Thank you for applying/);
  assert.match(email.body, /President and CEO/);
  assert.match(email.subject, /President and CEO/);
  assert(email.body.includes(h.body.requestId));
  assert.doesNotMatch(email.body, /PRIVATE|Female|fake-test-secret|Test Applicant|%PDF/);
  for (const field of ["attachments", "cc", "bcc", "from", "htmlBody"]) assert.equal(email[field], undefined);
  assert.equal(h.post(h.body).ok, true);
  assert.equal(h.emails.length, 1);
});

test("an unsuccessful application never sends an acknowledgment email", () => {
  for (const options of [{ createError: true }, { uploadError: true }, { bot: true }, { lock: false }]) {
    const h = harness(options);
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.emails.length, 0);
  }
});

test("mail failures never fail a completed application or retry an uncertain email", () => {
  for (const [options, status, attempts] of [
    [{ mailError: true }, "unconfirmed", 1],
    [{ mailQuota: 0 }, "not_sent", 0],
    [{ mailPermissionError: true }, "unconfirmed", 0],
    [{ failEmailReceiptStatus: "sending" }, "unconfirmed", 0],
    [{ failEmailReceiptStatus: "sent" }, "unconfirmed", 1]
  ]) {
    const h = harness(options);
    const logs = [];
    h.context.console.log = value => logs.push(value);
    const result = h.post(h.body);
    assert.equal(result.ok, true);
    assert.equal(result.confirmationEmail, status);
    const receipt = JSON.parse(h.properties.get("application:" + h.body.requestId));
    assert.equal(receipt.phase, "complete");
    assert.equal(receipt.confirmationEmail.status, status);
    assert.equal(h.post(h.body).ok, true);
    assert.equal(h.emails.length, attempts);
    assert.equal(h.creates().length, 1);
    assert.doesNotMatch(logs.join("") + JSON.stringify(receipt), /PRIVATE|applicant@example|fake-test-secret/);
  }
});

test("completed legacy receipts and interrupted mail attempts are not emailed again", () => {
  for (const status of [undefined, "pending", "sending"]) {
    const h = harness();
    assert.equal(h.post(h.body).ok, true);
    const key = "application:" + h.body.requestId;
    const receipt = JSON.parse(h.properties.get(key));
    if (status) receipt.confirmationEmail = { status };
    else delete receipt.confirmationEmail;
    h.properties.set(key, JSON.stringify(receipt));
    h.emails.length = 0;
    const result = h.post(h.body);
    assert.equal(result.ok, true);
    assert.equal(result.confirmationEmail, status ? "unconfirmed" : "not_requested");
    assert.equal(h.emails.length, 0);
    assert.equal(h.creates().length, 1);
  }
});

test("email input cannot inject extra recipients or mail headers", () => {
  for (const email of ["a,b@example.test", "a;b@example.test", "a@example.test,b@example.test", "a@example.test\r\nBcc: b@example.test", "Name<a@example.test>"]) {
    const h = harness();
    h.body.values.email = email;
    assert.equal(h.post(h.body).ok, false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.emails.length, 0);
  }
});

test("email authorization uses send-only permission and does not send an email", () => {
  const h = harness();
  h.context.authorizeJobApplicationEmail();
  assert.equal(h.emails.length, 0);
  assert.equal(h.calls.length, 0);
  const manifest = JSON.parse(readFileSync(new URL("appsscript.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.oauthScopes.sort(), ["https://www.googleapis.com/auth/script.external_request", "https://www.googleapis.com/auth/script.send_mail"].sort());
});

test("thank-you content provides next steps, a reference, and the HR contact without promising email delivery", () => {
  const role = readFileSync(new URL("../../president-and-ceo.html", import.meta.url), "utf8");
  assert.match(role, /What happens next/);
  assert.match(role, /mailto:hr@canton.foundation/);
  assert.match(role, /id="application-email-status" hidden/);
  assert.match(role, /Your application reference/);
  const client = readFileSync(new URL("../../assets/job-application.js", import.meta.url), "utf8");
  assert.match(client, /result.confirmationEmail === "sent"/);
  assert.match(client, /JOB_APPLICATION_PHONE.validateText/);
  assert.doesNotMatch(client, /operations@canton.foundation/);
});

test("CEO application source is available and the legacy role cannot collect applications", () => {
  const jobs = readFileSync(new URL("../../jobs.html", import.meta.url), "utf8");
  const role = readFileSync(new URL("../../president-and-ceo.html", import.meta.url), "utf8");
  const closed = readFileSync(new URL("../../accounting-manager.html", import.meta.url), "utf8");
  assert.doesNotMatch(jobs + role, /Accounting Manager|accounting-manager/);
  assert.match(closed, /no longer accepting applications/);
  assert.match(closed, /href="jobs.html"/);
  assert.doesNotMatch(closed, /<form|job-application(?:-schema|-config)?\.js/);
  for (const heading of ["Position Summary", "Strategy &amp; Execution", "Ecosystem &amp; Market Development",
    "Candidate Profile", "What Success Looks Like", "US based, NYC preferred", "Full-time", "Board of Directors"]) assert(!role.includes(heading));
  assert.doesNotMatch(jobs, /href="president-and-ceo\.html"/);
});

async function clientReadinessHarness(service, options = {}) {
  const nodes = new Map(), requests = [], storageReads = [], scripts = [], created = [], widgets = [];
  const element = tag => ({
    tagName: tag.toUpperCase(), classList: { add() {} }, dataset: {}, listeners: {},
    append(...children) { if (tag === "head") scripts.push(...children); },
    add() {}, setAttribute() {}, removeAttribute() {}, focus() {}, reset() {}, reportValidity() { return true; },
    addEventListener(event, callback) { this.listeners[event] = callback; }
  });
  const document = {
    head: element("head"), createElement(tag) { const node = element(tag); created.push(node); return node; },
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, element("div"));
      return nodes.get(selector);
    }
  };
  document.querySelector("#application-fields").disabled = true;
  document.querySelector("#application-submit").disabled = true;
  document.querySelector("#application").hidden = true;
  document.querySelector("#application-access-submit").disabled = true;
  document.querySelector("#application-unavailable").hidden = true;
  document.querySelector("#job-application").dataset.role = options.pageRole ?? "president-and-ceo";
  const context = vm.createContext({
    document, window: { JOB_APPLICATION_CONFIG: {
      enabled: options.enabled !== false, endpoint: "https://script.google.com/macros/s/fake-test-deployment/exec", turnstileSiteKey: "fake-test-key"
    }, turnstile: { render(target, settings) { widgets.push({ target, settings }); return widgets.length; }, remove() {}, reset() {} } },
    location: { hostname: "intro.canton.foundation" }, crypto: { randomUUID },
    sessionStorage: { getItem(key) { storageReads.push(key); return null; } },
    Option: function (text, value) { this.text = text; this.value = value; },
    AbortController, setTimeout, clearTimeout,
    fetch: async (url, request) => {
      requests.push({ url, request });
      if (options.networkError) throw new Error("offline");
      return { ok: options.httpOk !== false, json: async () => request.method === "POST" ? options.unlockResult || { ok: true, accessGranted: true, role: "president-and-ceo" } : service };
    }
  });
  vm.runInContext(readFileSync(new URL("../../assets/job-application-schema.js", import.meta.url), "utf8"), context);
  vm.runInContext(readFileSync(new URL("../../assets/job-application.js", import.meta.url), "utf8"), context);
  // Inputs stay disabled during the asynchronous readiness check.
  assert.equal(nodes.get("#application-fields").disabled, true);
  await new Promise(resolve => setImmediate(resolve));
  return { nodes, requests, scripts, storageReads, created, widgets, context };
}

test("browser requires name, address, start date, and referral but keeps salary optional", async () => {
  const h = await clientReadinessHarness({ role: "president-and-ceo", acceptingApplications: true });
  for (const key of ["name", "address", "startDate", "referral"]) {
    assert.equal(h.created.find(node => node.name === key).required, true);
    assert.match(h.created.find(node => node.htmlFor === key).textContent, / \*$/);
  }
  for (const key of ["salaryExpectations", "preferredName", "phone", "coverLetter", "gender", "hispanicLatino", "veteran"]) {
    assert.equal(h.created.find(node => node.name === key).required, false);
    assert.doesNotMatch(h.created.find(node => node.htmlFor === key).textContent, / \*$/);
  }
});

test("browser keeps the form locked until the server confirms the password", async () => {
  const h = await clientReadinessHarness({ role: "president-and-ceo", acceptingApplications: true, passwordRequired: true });
  assert.equal(h.nodes.get("#application-fields").disabled, true);
  assert.equal(h.nodes.get("#application-submit").disabled, true);
  assert.equal(h.nodes.get("#application").hidden, true);
  assert.equal(h.nodes.get("#application-unavailable").hidden, true);
  assert.equal(h.scripts.length, 1);
  assert.match(h.scripts[0].src, /challenges\.cloudflare\.com/);
  assert.deepEqual(h.storageReads, ["canton-president-and-ceo-application-request"]);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].request.body, undefined);
  assert.equal(h.requests[0].request.credentials, "omit");
  h.context.window.onJobVerificationReady();
  assert.equal(h.widgets[0].settings.action, "job_application_access");
  h.widgets[0].settings.callback("synthetic-turnstile-token");
  h.nodes.get("#application-password").value = "synthetic-access-password";
  await h.nodes.get("#application-access-form").listeners.submit({ preventDefault() {} });
  assert.equal(h.nodes.get("#application-fields").disabled, false);
  assert.equal(h.nodes.get("#application-submit").disabled, false);
  assert.equal(h.nodes.get("#application").hidden, false);
  assert.equal(h.nodes.get("#application-access").hidden, true);
  assert.equal(h.nodes.get("#application-password").value, "");
  assert.equal(h.widgets[1].settings.action, "job_application");
  const unlock = JSON.parse(h.requests[1].request.body);
  assert.equal(unlock.action, "unlock");
  assert.equal(unlock.password, "synthetic-access-password");
  assert.equal(unlock.values, undefined);
  assert.equal(unlock.files, undefined);
  assert(!h.requests[1].url.includes("synthetic-access-password"));
  h.nodes.get("#application-lock").listeners.click();
  assert.equal(h.nodes.get("#application").hidden, true);
  assert.equal(h.nodes.get("#application-fields").disabled, true);
  assert.equal(h.widgets[2].settings.action, "job_application_access");
});

test("browser blocks old deployments, wrong roles, setup failures, network errors, and disabled config", async () => {
  for (const [service, options] of [
    [{ service: "Canton Foundation job applications" }, {}],
    [{ role: "accounting-manager", acceptingApplications: true }, {}],
    [{ role: "president-and-ceo", acceptingApplications: false }, {}],
    [{ role: "president-and-ceo", acceptingApplications: true }, {}],
    [{ role: "president-and-ceo", acceptingApplications: true, passwordRequired: true }, { httpOk: false }],
    [null, { networkError: true }],
    [null, { enabled: false }],
    [null, { pageRole: "accounting-manager" }],
    [null, { pageRole: "" }]
  ]) {
    const h = await clientReadinessHarness(service, options);
    assert.equal(h.nodes.get("#application-fields").disabled, true);
    assert.equal(h.nodes.get("#application-submit").disabled, true);
    assert.match(h.nodes.get("#application-access-status").textContent, /temporarily unavailable/);
    assert.equal(h.scripts.length, 0);
    await h.nodes.get("#job-application").listeners.submit({ preventDefault() {} });
    assert.match(h.nodes.get("#application-status").textContent, /Nothing has been sent/);
    assert(h.requests.every(({ request }) => !request.body));
  }
});

test("missing, wrong, malformed and padded passwords cannot submit or replay completed receipts", () => {
  for (const password of [undefined, null, "", "wrong", "synthetic-access-password ", [], {}, "x".repeat(257)]) {
    const h = harness();
    const result = h.post({ ...h.body, password });
    assert.equal(result.ok, false);
    assert.equal(result.accessRequired, true);
    assert.equal(h.calls.length, 1);
    assert(h.calls[0].url.includes("siteverify"));
    assert.equal(h.emails.length, 0);
    assert(!h.properties.has("application:" + h.body.requestId));
  }
  const h = harness();
  assert(h.post(h.body).ok);
  h.properties.set("JOB_ACCESS_PASSWORD", "changed-synthetic-password");
  h.calls.length = 0;
  assert.equal(h.post(h.body).accessRequired, true);
  assert.equal(h.calls.length, 1);
  assert(h.calls[0].url.includes("siteverify"));
});

test("missing private password configuration fails closed", () => {
  const h = harness();
  h.properties.delete("JOB_ACCESS_PASSWORD");
  assert.equal(JSON.parse(h.context.doGet().text).acceptingApplications, false);
  assert.equal(h.post(h.body).ok, false);
  assert.equal(h.calls.length, 0);
});

test("direct submissions cannot use password errors as a bot-check-free guessing oracle", () => {
  for (const password of ["wrong", "synthetic-access-password"]) {
    const h = harness({ bot: true });
    const result = h.post({ ...h.body, password });
    assert.equal(result.ok, false);
    assert.equal(result.accessRequired, false);
    assert.match(result.message, /security check/);
    assert.equal(h.creates().length, 0);
    assert.equal(h.emails.length, 0);
  }
});

test("password setup is editor-only and an empty helper never overwrites a password", () => {
  const h = harness();
  const before = JSON.stringify([...h.properties]);
  assert.throws(() => h.context.configureJobApplicationPassword(), /Enter a shared password/);
  assert.equal(JSON.stringify([...h.properties]), before);
  assert.equal(h.calls.length, 0);
  assert.equal(h.emails.length, 0);
  assert.match(serverSource, /function configureJobApplicationPassword\(\) \{\s+var password = "";/);
});

test("unlock requires the correct password and a matching bot check, never writes an application", () => {
  for (const [options, password, granted] of [
    [{ action: "job_application_access" }, "synthetic-access-password", true],
    [{ action: "job_application_access" }, "wrong", false],
    [{ action: "job_application" }, "synthetic-access-password", false],
    [{ action: "job_application_access", bot: true }, "synthetic-access-password", false],
    [{ action: "job_application_access", hostname: "other.example" }, "synthetic-access-password", false]
  ]) {
    const h = harness(options);
    const before = JSON.stringify([...h.properties]);
    const result = h.post({ action: "unlock", role: h.body.role, formRevision: h.body.formRevision, token: "test-token", password });
    assert.equal(result.ok, granted);
    assert.equal(result.accessGranted === true, granted);
    assert.equal(h.creates().length, 0);
    assert.equal(h.emails.length, 0);
    assert.equal(JSON.stringify([...h.properties]), before);
    assert(h.calls.every(call => call.url.includes("siteverify") && !JSON.stringify(call).includes(password)));
    assert(!JSON.stringify(result).includes(password));
  }
});

test("the shared password is excluded from Monday values, receipts and email", () => {
  const h = harness();
  assert(h.post(h.body).ok);
  assert(!JSON.stringify(h.calls).includes(h.body.password));
  assert(!JSON.stringify(h.emails).includes(h.body.password));
  assert(!h.properties.get("application:" + h.body.requestId).includes(h.body.password));
});

test("browser stays locked for incorrect or unconfirmed access responses", async () => {
  for (const unlockResult of [{ ok: false, message: "Incorrect password" }, { ok: true }, { ok: true, accessGranted: true, role: "other" }]) {
    const h = await clientReadinessHarness({ role: "president-and-ceo", acceptingApplications: true, passwordRequired: true }, { unlockResult });
    h.context.window.onJobVerificationReady();
    h.widgets[0].settings.callback("synthetic-token");
    h.nodes.get("#application-password").value = "synthetic-access-password";
    await h.nodes.get("#application-access-form").listeners.submit({ preventDefault() {} });
    assert.equal(h.nodes.get("#application").hidden, true);
    assert.equal(h.nodes.get("#application-fields").disabled, true);
    assert.equal(h.nodes.get("#application-password").value, "");
    assert(h.nodes.get("#application-access-status").textContent);
  }
});
