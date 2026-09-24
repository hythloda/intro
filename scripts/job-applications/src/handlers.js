/* Application handlers. Bundled into ../Code.gs for Apps Script deployment. */
var JOB_BOARD_ID = "18432556545";
var JOB_HOSTNAME = "intro.canton.foundation";
var JOB_HR_EMAIL = "hr@canton.foundation";

function jobColumnFields_() {
  return JOB_APPLICATION_SCHEMA.fields.filter(function (field) { return !field.auxiliary; }).concat([
    { key: "applicationReference", label: "Application Reference", columnTypes: ["text"] }
  ]);
}

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
  jobColumnFields_().forEach(function (field) {
    var column = mapping && mapping[field.key];
    if (!column || typeof column.id !== "string" || !column.id || field.columnTypes.indexOf(column.type) === -1 || ids.indexOf(column.id) !== -1) throw new Error("Invalid column configuration");
    ids.push(column.id);
  });
  return { token: token, secret: secret, mapping: mapping, groupId: properties.getProperty("MONDAY_GROUP_ID") || null };
}

function safeMondayDiagnostic_(status, result, config) {
  var allowed = ["ColumnValueException", "CorrectedValueException", "InvalidArgumentException",
    "InvalidBoardIdException", "InvalidColumnIdException", "InvalidVersionException", "ItemNameTooLongException",
    "ItemsLimitationException", "missingRequiredPermissions", "ResourceNotFoundException", "UserUnauthorizedException",
    "USER_ACCESS_DENIED", "JsonParseException", "API_TEMPORARILY_BLOCKED", "COMPLEXITY_BUDGET_EXHAUSTED",
    "maxConcurrencyExceeded", "IP_RATE_LIMIT_EXCEEDED", "IDEMPOTENCY_CONFLICT", "GRAPHQL_VALIDATION_FAILED",
    "GRAPHQL_PARSE_FAILED", "UNCONFIRMED_RESPONSE", "INVALID_JSON_RESPONSE", "TRANSPORT_ERROR", "UNCONFIRMED_WRITE"];
  var errors = result && Array.isArray(result.errors) ? result.errors : [];
  if (!errors.length) errors = [{ extensions: { code: result && result.error_code || "UNCONFIRMED_RESPONSE" } }];
  var codes = [], fields = [];
  errors.slice(0, 5).forEach(function (entry) {
    var extension = entry && entry.extensions || {};
    var code = allowed.indexOf(extension.code) === -1 ? "UNKNOWN_PROVIDER_ERROR" : extension.code;
    if (codes.indexOf(code) === -1) codes.push(code);
    var columnId = extension.error_data && extension.error_data.column_id;
    jobColumnFields_().forEach(function (field) {
      var mapping = config && config.mapping && config.mapping[field.key];
      if (mapping && mapping.id === columnId && fields.indexOf(field.key) === -1) fields.push(field.key);
    });
  });
  return { httpStatus: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null, codes: codes, fields: fields };
}

function mondayResponse_(config, url, options) {
  var response, result, status = null;
  try {
    response = UrlFetchApp.fetch(url, options);
    status = response.getResponseCode();
  } catch (_) {
    var transportError = new Error("Monday transport failure");
    transportError.jobDiagnostic = safeMondayDiagnostic_(null, { error_code: "TRANSPORT_ERROR" }, config);
    throw transportError;
  }
  try { result = JSON.parse(response.getContentText()); } catch (_) {
    result = { error_code: "INVALID_JSON_RESPONSE" };
  }
  var hasErrors = result && (Array.isArray(result.errors) ? result.errors.length > 0 : Boolean(result.errors));
  if (status !== 200 || !result || hasErrors || result.error_code || !result.data) {
    var error = new Error("Monday request failed");
    error.jobDiagnostic = safeMondayDiagnostic_(status, result, config);
    // A partial response can include a created ID even when it also reports an error.
    var itemId = result && result.data && result.data.create_item && result.data.create_item.id;
    if (typeof itemId === "string" && /^\d+$/.test(itemId)) error.createdItemId = itemId;
    throw error;
  }
  return result.data;
}

function monday_(config, query, variables) {
  return mondayResponse_(config, "https://api.monday.com/v2", {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: { Authorization: config.token, "API-Version": "2026-07" },
    payload: JSON.stringify({ query: query, variables: variables })
  });
}

function createJobItem_(config, name, columns) {
  var variables = { board: JOB_BOARD_ID, name: name, values: JSON.stringify(columns) };
  if (config.groupId) variables.group = config.groupId;
  return monday_(config,
    "mutation ($board: ID!, $name: String!, $values: JSON!" + (config.groupId ? ", $group: String!" : "") + ") { create_item(board_id: $board, " +
    (config.groupId ? "group_id: $group, " : "") + "item_name: $name, column_values: $values) { id } }", variables);
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
  jobColumnFields_().forEach(function (field) {
    var matches = board.columns.filter(function (column) {
      return overrides[field.key] ? column.id === overrides[field.key] : normalize(column.title) === normalize(field.label);
    });
    // The recruitment board now uses plain text for Phone. Do not select its old phone column.
    if (field.key === "phone" && !overrides.phone) {
      var textMatches = matches.filter(function (column) { return column.type === "text"; });
      if (textMatches.length) matches = textMatches;
    }
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
    if (value && field.type === "email" && !/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(value)) errors.push(field.key);
    if (value && field.type === "url" && !/^https?:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i.test(value)) errors.push(field.key);
    if (value && field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) errors.push(field.key);
  });
  if (errors.length) throw applicationError_("Please check the highlighted fields and try again.", errors);
  var phone = JOB_APPLICATION_PHONE.validateText(clean.phone);
  if (!phone.ok) throw applicationError_(phone.message, phone.fields);
  // Keep original values for existing receipt hashes; normalize only the Monday column value.
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
      case "phone":
        var phone = JOB_APPLICATION_PHONE.validate(value, values.phoneCountry);
        if (!phone.ok) throw applicationError_(phone.message, phone.fields);
        value = { phone: phone.number, countryShortName: values.phoneCountry };
        break;
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
  var data = mondayResponse_(config, "https://api.monday.com/v2/file", {
    method: "post", muteHttpExceptions: true,
    headers: { Authorization: config.token, "API-Version": "2026-07" },
    // A Blob makes UrlFetchApp construct the required multipart body and boundary.
    payload: { query: query, map: JSON.stringify({ upload: "variables.file" }), upload: Utilities.newBlob(file.bytes, file.type, filename) }
  });
  if (!data.add_file_to_column || !data.add_file_to_column.id) throw new Error("Attachment upload not confirmed");
}

function result_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return result_({ service: "Canton Foundation job applications" });
}

function authorizeJobApplicationEmail() {
  var remaining = MailApp.getRemainingDailyQuota();
  console.log("Application email permission is available. Remaining daily recipients: " + remaining + ". No email was sent.");
}

function completedJobApplicationResult_(requestId, receipt) {
  var status = receipt.confirmationEmail && receipt.confirmationEmail.status;
  return result_({ ok: true, requestId: requestId, confirmationEmail:
    !status ? "not_requested" : ["sent", "not_sent"].indexOf(status) !== -1 ? status : "unconfirmed" });
}

// Called under the submission lock, only after the completed receipt is durable.
function sendJobApplicationConfirmation_(application, requestId, state, properties, key) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      state.confirmationEmail = { status: "not_sent", reason: "quota", at: new Date().toISOString() };
      properties.setProperty(key, JSON.stringify(state));
      console.log(JSON.stringify({ event: "job_confirmation_not_sent", reference: requestId, reason: "quota" }));
      return;
    }
    // Save intent before sending. Lost responses must not send another email on a browser retry.
    state.confirmationEmail = { status: "sending", at: new Date().toISOString() };
    properties.setProperty(key, JSON.stringify(state));
    MailApp.sendEmail({
      to: application.values.email,
      name: "Canton Foundation Recruitment",
      replyTo: JOB_HR_EMAIL,
      subject: "Thank you for applying | Canton Foundation Accounting Manager",
      body: "Thank you for applying for the Accounting Manager role at Canton Foundation.\n\n" +
        "We have received your application and the attachments you submitted. Our recruitment team will review your application and contact you if we would like to discuss next steps.\n\n" +
        "If you have questions, please reply to this email or contact " + JOB_HR_EMAIL + ". Include your application reference so we can help.\n\n" +
        "Application reference: " + requestId + "\n\n" +
        "Thank you for your interest in Canton Foundation.\nThe Canton Foundation Recruitment Team"
    });
    state.confirmationEmail = { status: "sent", at: new Date().toISOString() };
    properties.setProperty(key, JSON.stringify(state));
  } catch (_) {
    // Mail/permission/quota errors must never turn a saved application into a failed submission.
    state.confirmationEmail = { status: "unconfirmed", at: new Date().toISOString() };
    try { properties.setProperty(key, JSON.stringify(state)); } catch (_) { /* The durable receipt remains complete. */ }
    console.log(JSON.stringify({ event: "job_confirmation_unconfirmed", reference: requestId }));
  }
}

function isReviewedJobApplicationRetry_(receipt) {
  return Boolean(receipt && receipt.phase === "retry_approved" && !receipt.itemId &&
    typeof receipt.hash === "string" && receipt.hash &&
    typeof receipt.reviewedAt === "string" && !isNaN(Date.parse(receipt.reviewedAt)));
}

function doPost(event) {
  var requestId = "", lock, locked = false, writeStarted = false;
  try {
    if (!event || !event.postData || event.postData.contents.length > 15 * 1024 * 1024) throw applicationError_("Application payload is too large or missing.");
    var body = JSON.parse(event.postData.contents);
    requestId = typeof body.requestId === "string" ? body.requestId.slice(0,36) : "";
    var application = validateApplication_(body);
    var config = config_();
    if (config.mapping.phone.type === "phone") {
      var phone = JOB_APPLICATION_PHONE.validate(application.values.phone, application.values.phoneCountry);
      if (!phone.ok) throw applicationError_(phone.message, phone.fields);
    }
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
      var retryApproved = isReviewedJobApplicationRetry_(prior);
      if (prior.hash !== hash && !(retryApproved && prior.allowUpdatedAnswers === true)) throw applicationError_("An earlier attempt exists with different answers. Please contact hr@canton.foundation with this reference before submitting again.");
      if (prior.phase === "complete") return completedJobApplicationResult_(requestId, prior);
      if (!retryApproved) {
        throw applicationError_("Your earlier attempt needs confirmation by the recruitment team. Please contact hr@canton.foundation with this reference; do not submit a second application.");
      }
    }
    // Only receipts, internal IDs, and allowlisted diagnostic codes are retained, never answers or files.
    if (Object.keys(properties.getProperties()).filter(function (name) { return name.indexOf("application:") === 0; }).length >= 1200) throw applicationError_("Applications are temporarily unavailable. Please contact hr@canton.foundation.");
    var columns = columnValues_(application, config.mapping);
    // Save the validated receipt reference in the initial write, even if an attachment later fails.
    columns[config.mapping.applicationReference.id] = requestId;
    var state = { hash: hash, phase: "creating", at: new Date().toISOString() };
    if (prior) {
      state.reviewedAt = prior.reviewedAt;
      if (prior.hash !== hash) state.previousHash = prior.hash;
      if (prior.allowUpdatedAnswers === true) state.updatedAnswersApprovedAt = prior.updatedAnswersApprovedAt;
    }
    // Consume the editor's approval before any write; never carry retry permission forward.
    properties.setProperty(key, JSON.stringify(state));
    writeStarted = true;
    var data = createJobItem_(config, application.values.name || "Accounting Manager application", columns);
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
    state.confirmationEmail = { status: "pending" };
    properties.setProperty(key, JSON.stringify(state));
    sendJobApplicationConfirmation_(application, requestId, state, properties, key);
    return completedJobApplicationResult_(requestId, state);
  } catch (error) {
    if (writeStarted && state) {
      state.failure = error.jobDiagnostic || safeMondayDiagnostic_(null, { error_code: "UNCONFIRMED_WRITE" }, config);
      if (error.createdItemId && !state.itemId) state.itemId = error.createdItemId;
      try { properties.setProperty(key, JSON.stringify(state)); } catch (_) { /* Preserve the original failure response. */ }
      console.log(JSON.stringify({ event: "job_application_failure", reference: requestId, phase: state.phase, diagnostic: state.failure }));
    }
    // Never return provider errors or log request bodies, credentials, or applicant data.
    var message = writeStarted
      ? "We could not confirm all parts of your application. Please contact hr@canton.foundation with this reference; do not submit a second application."
      : error.publicMessage || "The application service is temporarily unavailable. Your answers have not been cleared; please try again later.";
    return result_({ ok: false, requestId: requestId, message: message, fields: error.fields || [] });
  } finally {
    if (locked) lock.releaseLock();
  }
}
