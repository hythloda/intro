/* Deploy with assets/job-application-schema.js as Schema.gs. See SETUP.md. */
var JOB_BOARD_ID = "18432556545";
var JOB_HOSTNAME = "intro.canton.foundation";

function applicationError_(message, fields) {
  var error = new Error(message);
  error.publicMessage = message;
  error.fields = fields || [];
  return error;
}

function config_() {
  var properties = PropertiesService.getScriptProperties();
  var token = properties.getProperty("MONDAY");
  var secret = properties.getProperty("TURNSTILE_SECRET");
  var mapping = properties.getProperty("JOB_COLUMN_MAP");
  if (!token || !secret || !mapping) throw applicationError_("Applications are temporarily unavailable. Please try again later.");
  mapping = JSON.parse(mapping);
  var ids = [];
  JOB_APPLICATION_SCHEMA.fields.filter(function (field) { return !field.auxiliary; }).forEach(function (field) {
    var column = mapping && mapping[field.key];
    if (!column || typeof column.id !== "string" || !column.id || field.columnTypes.indexOf(column.type) === -1 || ids.indexOf(column.id) !== -1) throw new Error("Invalid column configuration");
    ids.push(column.id);
  });
  return { token: token, secret: secret, mapping: mapping, groupId: properties.getProperty("MONDAY_GROUP_ID") || null };
}

function monday_(config, query, variables) {
  var response = UrlFetchApp.fetch("https://api.monday.com/v2", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: config.token, "API-Version": "2026-07" },
    payload: JSON.stringify({ query: query, variables: variables })
  });
  var result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 || result.errors || !result.data) throw new Error("Monday request failed");
  return result.data;
}

// Run once in the editor: resolves IDs using board metadata, never applicant rows.
function setupJobApplication() {
  var properties = PropertiesService.getScriptProperties();
  var token = properties.getProperty("MONDAY");
  if (!token) throw new Error("Add MONDAY in Script Properties first.");
  var board = monday_({ token: token },
    "query ($ids: [ID!]!) { boards(ids: $ids) { id columns { id title type } groups { id title } } }",
    { ids: [JOB_BOARD_ID] }).boards[0];
  if (!board) throw new Error("The configured token cannot access the job board.");
  var overrides = JSON.parse(properties.getProperty("JOB_COLUMN_OVERRIDES") || "{}");
  var normalize = function (text) { return text.toLowerCase().replace(/[^a-z0-9]/g, ""); };
  var mapping = {};
  JOB_APPLICATION_SCHEMA.fields.filter(function (field) { return !field.auxiliary; }).forEach(function (field) {
    var matches = board.columns.filter(function (column) {
      return overrides[field.key] ? column.id === overrides[field.key] : normalize(column.title) === normalize(field.label);
    });
    if (matches.length !== 1 || field.columnTypes.indexOf(matches[0].type) === -1) {
      throw new Error("Review column mapping for: " + field.label + ". Use JOB_COLUMN_OVERRIDES to specify the correct column ID, then run setup again.");
    }
    mapping[field.key] = { id: matches[0].id, type: matches[0].type };
  });
  var ids = Object.keys(mapping).map(function (key) { return mapping[key].id; });
  if (new Set(ids).size !== ids.length) throw new Error("Two questions cannot share a destination column.");
  var groupId = properties.getProperty("MONDAY_GROUP_ID");
  if (groupId && !board.groups.some(function (group) { return group.id === groupId; })) throw new Error("MONDAY_GROUP_ID does not exist on this board.");
  properties.setProperty("JOB_COLUMN_MAP", JSON.stringify(mapping));
  console.log("Job column mapping saved. Board group IDs: " + JSON.stringify(board.groups));
}

function inspectJobColumns() {
  var token = PropertiesService.getScriptProperties().getProperty("MONDAY");
  if (!token) throw new Error("Add MONDAY in Script Properties first.");
  var data = monday_({ token: token }, "query ($ids: [ID!]!) { boards(ids: $ids) { columns { id title type } groups { id title } } }", { ids: [JOB_BOARD_ID] });
  console.log(JSON.stringify(data.boards));
}

function validateApplication_(body) {
  var schema = JOB_APPLICATION_SCHEMA;
  if (body.role !== schema.role || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId || "")) throw applicationError_("Invalid application request. Please refresh the page.");
  if (typeof body.website !== "string" || body.website) throw applicationError_("The application could not be accepted.");
  var values = body.values, files = body.files;
  if (!values || !files || Array.isArray(values) || Array.isArray(files)) throw applicationError_("Invalid application details.");
  var valueKeys = schema.fields.filter(function (f) { return f.type !== "file"; }).map(function (f) { return f.key; });
  if (Object.keys(values).some(function (key) { return valueKeys.indexOf(key) === -1; }) || Object.keys(files).some(function (key) { return ["cv", "coverLetter"].indexOf(key) === -1; })) throw applicationError_("Unexpected application fields.");
  var clean = {}, attachments = {}, errors = [];
  schema.fields.forEach(function (field) {
    if (field.type === "file") {
      if (!files[field.key]) { if (field.required) errors.push(field.key); return; }
      attachments[field.key] = validateFile_(files[field.key], field.key);
      return;
    }
    var value = values[field.key];
    if (typeof value !== "string") { errors.push(field.key); return; }
    value = value.trim();
    clean[field.key] = value;
    if ((!value && field.required) || value.length > (field.max || 255)) errors.push(field.key);
    if (value && field.options && field.options.indexOf(value) === -1) errors.push(field.key);
    if (value && field.type === "country" && schema.countryCodes.indexOf(value) === -1) errors.push(field.key);
    if (value && field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(field.key);
    if (value && field.type === "url" && !/^https?:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i.test(value)) errors.push(field.key);
    if (value && field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) errors.push(field.key);
    if (value && field.type === "tel" && !/^\+?[0-9 ()\-.]{6,40}$/.test(value)) errors.push(field.key);
  });
  if (clean.phone && !clean.phoneCountry) errors.push("phoneCountry");
  if (errors.length) throw applicationError_("Please check the highlighted fields and try again.", errors);
  return { values: clean, files: attachments };
}

function validateFile_(file, key) {
  if (!file || typeof file.name !== "string" || typeof file.data !== "string") throw applicationError_("Please select a valid attachment.", [key]);
  var extension = file.name.toLowerCase().match(/\.(pdf|doc|docx)$/);
  var max = JOB_APPLICATION_SCHEMA.maxFileBytes;
  // Avoid repeated regex groups: multi-megabyte files can overflow the regex stack.
  if (!extension || file.name.length > 255 || !file.data || file.data.length > Math.ceil(max / 3) * 4 || file.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw applicationError_("Attachments must be PDF or Word files of 5 MB or less.", [key]);
  var bytes = Utilities.base64Decode(file.data);
  var signatures = { pdf: [37,80,68,70,45], doc: [208,207,17,224,161,177,26,225], docx: [80,75,3,4] };
  if (!bytes.length || bytes.length > max || !signatures[extension[1]].every(function (byte, i) { return (bytes[i] & 255) === byte; })) throw applicationError_("The attachment does not match its PDF or Word file type.", [key]);
  var types = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  return { bytes: bytes, type: types[extension[1]], extension: extension[1] };
}

function verifyHuman_(token, config) {
  if (typeof token !== "string" || !token || token.length > 2048) throw applicationError_("Please complete the security check again.");
  var response = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "post", muteHttpExceptions: true, payload: { secret: config.secret, response: token }
  });
  var result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 || !result.success || result.hostname !== JOB_HOSTNAME || result.action !== "job_application") throw applicationError_("The security check expired or failed. Please complete it again.");
}

function columnValues_(application, mapping) {
  var columns = {}, values = application.values;
  JOB_APPLICATION_SCHEMA.fields.forEach(function (field) {
    if (field.auxiliary || field.type === "file" || field.key === "name" || !values[field.key]) return;
    var column = mapping[field.key];
    if (!column || field.columnTypes.indexOf(column.type) === -1) throw new Error("Invalid column configuration");
    var value = values[field.key];
    if (field.type === "country" && column.type !== "country") value = JOB_APPLICATION_SCHEMA.countryNames[value];
    switch (column.type) {
      case "email": value = { email: value, text: value }; break;
      case "phone": value = { phone: value, countryShortName: values.phoneCountry }; break;
      case "country": value = { countryCode: value, countryName: JOB_APPLICATION_SCHEMA.countryNames[value] }; break;
      case "long_text": value = { text: value }; break;
      case "link": value = { url: value, text: "LinkedIn Profile" }; break;
      case "date": value = { date: value }; break;
      case "status": value = { label: value }; break;
      case "dropdown": value = { labels: [value] }; break;
      case "location":
        var results = Maps.newGeocoder().geocode(value);
        if (results.status !== "OK" || !results.results || results.results.length !== 1 || results.results[0].partial_match) throw applicationError_("Please provide a complete physical address, including city and country, or leave this optional field empty.", [field.key]);
        var location = results.results[0].geometry.location;
        value = { address: value, lat: String(location.lat), lng: String(location.lng) };
        break;
    }
    columns[column.id] = value;
  });
  return columns;
}

function upload_(config, itemId, columnId, file, filename) {
  var query = "mutation ($file: File!) { add_file_to_column(item_id: " + JSON.stringify(String(itemId)) + ", column_id: " + JSON.stringify(columnId) + ", file: $file) { id } }";
  var response = UrlFetchApp.fetch("https://api.monday.com/v2/file", {
    method: "post", muteHttpExceptions: true,
    headers: { Authorization: config.token, "API-Version": "2026-07" },
    // A Blob makes UrlFetchApp construct the required multipart body and boundary.
    payload: { query: query, map: JSON.stringify({ upload: "variables.file" }), upload: Utilities.newBlob(file.bytes, file.type, filename) }
  });
  var result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200 || result.errors || !result.data || !result.data.add_file_to_column || !result.data.add_file_to_column.id) throw new Error("Attachment upload not confirmed");
}

function result_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return result_({ service: "Canton Foundation job applications" });
}

function doPost(event) {
  var requestId = "", lock, locked = false, writeStarted = false;
  try {
    if (!event || !event.postData || event.postData.contents.length > 15 * 1024 * 1024) throw applicationError_("Application payload is too large or missing.");
    var body = JSON.parse(event.postData.contents);
    requestId = typeof body.requestId === "string" ? body.requestId.slice(0,36) : "";
    var application = validateApplication_(body);
    var config = config_();
    verifyHuman_(body.token, config);
    lock = LockService.getScriptLock();
    locked = lock.tryLock(1000);
    if (!locked) throw applicationError_("The application service is busy. Please try again in a moment.");
    var properties = PropertiesService.getScriptProperties();
    var key = "application:" + requestId;
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify({ values: application.values, files: body.files }));
    var hash = Utilities.base64Encode(digest);
    var prior = JSON.parse(properties.getProperty(key) || "null");
    if (prior) {
      if (prior.hash !== hash) throw applicationError_("An earlier attempt exists with different answers. Please contact operations@canton.foundation with this reference before submitting again.");
      if (prior.phase === "complete") return result_({ ok: true, requestId: requestId });
      throw applicationError_("Your earlier attempt needs confirmation by the recruitment team. Please contact operations@canton.foundation with this reference; do not submit a second application.");
    }
    // Only receipt hashes and internal IDs are retained here, never answers or files.
    if (Object.keys(properties.getProperties()).filter(function (name) { return name.indexOf("application:") === 0; }).length >= 1200) throw applicationError_("Applications are temporarily unavailable. Please contact operations@canton.foundation.");
    var columns = columnValues_(application, config.mapping);
    var state = { hash: hash, phase: "creating", at: new Date().toISOString() };
    properties.setProperty(key, JSON.stringify(state));
    writeStarted = true;
    var data = monday_(config,
      "mutation ($board: ID!, $group: String, $name: String!, $values: JSON!) { create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values) { id } }",
      { board: JOB_BOARD_ID, group: config.groupId, name: application.values.name || "Accounting Manager application", values: JSON.stringify(columns) });
    if (!data.create_item || !data.create_item.id) throw new Error("Creation not confirmed");
    state.itemId = data.create_item.id;
    state.phase = "uploading";
    properties.setProperty(key, JSON.stringify(state));
    Object.keys(application.files).forEach(function (field) {
      var column = config.mapping[field];
      if (!column || column.type !== "file") throw new Error("Missing attachment destination");
      upload_(config, state.itemId, column.id, application.files[field], field + "-" + requestId + "." + application.files[field].extension);
    });
    state.phase = "complete";
    properties.setProperty(key, JSON.stringify(state));
    return result_({ ok: true, requestId: requestId });
  } catch (error) {
    // Never return provider errors or log request bodies, credentials, or applicant data.
    var message = writeStarted
      ? "We could not confirm all parts of your application. Please contact operations@canton.foundation with this reference; do not submit a second application."
      : error.publicMessage || "The application service is temporarily unavailable. Your answers have not been cleared; please try again later.";
    return result_({ ok: false, requestId: requestId, message: message, fields: error.fields || [] });
  } finally {
    if (locked) lock.releaseLock();
  }
}
