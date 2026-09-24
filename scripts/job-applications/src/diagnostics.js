/* Editor-only diagnostics and retry approval. Bundled into ../Code.gs. */
function inspectJobApplicationFailure() {
  var properties = PropertiesService.getScriptProperties();
  var reference = (properties.getProperty("JOB_DIAGNOSTIC_REFERENCE") || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reference)) {
    throw new Error("Set JOB_DIAGNOSTIC_REFERENCE to the application reference first.");
  }
  var raw = properties.getProperty("application:" + reference);
  var report = { receiptFound: Boolean(raw) };
  var receipt;
  try { receipt = JSON.parse(raw || "null"); } catch (_) { report.receiptUnreadable = true; }
  if (!receipt) return printJobDiagnostic_(report);

  report.phase = ["creating", "uploading", "complete", "retry_approved"].indexOf(receipt.phase) === -1 ? "unknown" : receipt.phase;
  report.itemCreationConfirmed = typeof receipt.itemId === "string" && /^\d+$/.test(receipt.itemId);
  // A "creating" receipt cannot prove that no item exists: the response may have been lost.
  report.manualReviewRequired = report.phase !== "complete";
  report.updatedAnswersRetryApproved = isReviewedJobApplicationRetry_(receipt) && receipt.allowUpdatedAnswers === true;
  report.failureDetailsRecorded = Boolean(receipt.failure);
  var emailStatus = receipt.confirmationEmail && receipt.confirmationEmail.status;
  report.confirmationEmail = ["pending", "sending", "sent", "not_sent", "unconfirmed"].indexOf(emailStatus) !== -1 ? emailStatus : "not_requested";
  if (receipt.failure && typeof safeMondayDiagnostic_ === "function") {
    // Reapply the allowlist rather than printing arbitrary receipt contents.
    report.failure = safeMondayDiagnostic_(receipt.failure.httpStatus, {
      errors: (Array.isArray(receipt.failure.codes) ? receipt.failure.codes : []).map(function (code) {
        return { extensions: { code: code } };
      })
    }, {});
    report.failure.fields = jobColumnFields_().filter(function (field) {
      return Array.isArray(receipt.failure.fields) && receipt.failure.fields.indexOf(field.key) !== -1;
    }).map(function (field) { return field.key; });
  }
  var token = properties.getProperty("MONDAY"), mapping;
  try { mapping = JSON.parse(properties.getProperty("JOB_COLUMN_MAP") || "null"); } catch (_) { /* Report below. */ }
  if (!token || !mapping) {
    report.configurationAvailable = false;
    return printJobDiagnostic_(report);
  }

  var config = { token: token };
  try {
    var board = monday_(config,
      "query ($ids: [ID!]!) { boards(ids: $ids) { columns { id type settings } groups { id } } }",
      { ids: [JOB_BOARD_ID] }).boards[0];
    report.boardAccessible = Boolean(board);
    if (board) {
      var group = properties.getProperty("MONDAY_GROUP_ID");
      report.destinationGroupExists = group ? board.groups.some(function (entry) { return entry.id === group; }) : null;
      report.columnIssues = [];
      report.phoneDestinationType = mapping.phone && ["text", "phone"].indexOf(mapping.phone.type) !== -1 ? mapping.phone.type : "unknown";
      jobColumnFields_().forEach(function (field) {
        var destination = mapping[field.key];
        var column = destination && board.columns.find(function (entry) { return entry.id === destination.id; });
        if (!column || column.type !== destination.type || field.columnTypes.indexOf(column.type) === -1) {
          report.columnIssues.push({ field: field.key, issue: "missing_or_changed_column" });
          return;
        }
        if (column.type !== "status" || !field.options) return;
        var settings = column.settings;
        try { if (typeof settings === "string") settings = JSON.parse(settings); } catch (_) { settings = null; }
        if (!settings || !Array.isArray(settings.labels)) {
          report.columnIssues.push({ field: field.key, issue: "status_labels_not_checked" });
          return;
        }
        var missing = field.options.filter(function (option) {
          return !settings.labels.some(function (label) { return label.label === option; });
        });
        // Only expected public form choices are output, never board labels or submitted answers.
        if (missing.length) report.columnIssues.push({ field: field.key, issue: "missing_status_labels", expectedOptions: missing });
      });
    }
  } catch (_) {
    report.boardMetadataCheck = "failed";
  }

  if (report.itemCreationConfirmed) {
    var fileFields = ["cv", "coverLetter"].filter(function (key) { return mapping[key] && mapping[key].type === "file"; });
    if (!fileFields.length) return printJobDiagnostic_(report);
    try {
      // Read only file counts on this receipt's item, not names, answers, file URLs, or contents.
      var item = monday_(config,
        "query ($ids: [ID!]!, $columns: [String!]) { items(ids: $ids) { board { id } column_values(ids: $columns) { id ... on FileValue { files { __typename } } } } }",
        { ids: [receipt.itemId], columns: fileFields.map(function (key) { return mapping[key].id; }) }).items[0];
      report.itemStillOnJobBoard = Boolean(item && item.board && String(item.board.id) === JOB_BOARD_ID);
      if (report.itemStillOnJobBoard) {
        report.uploadedFileCounts = {};
        fileFields.forEach(function (key) {
          var column = item.column_values.find(function (entry) { return entry.id === mapping[key].id; });
          report.uploadedFileCounts[key] = column && Array.isArray(column.files)
            ? column.files.filter(function (file) { return file.__typename === "FileAssetValue"; }).length : null;
        });
      }
    } catch (_) {
      report.attachmentCheck = "failed";
    }
  }
  return printJobDiagnostic_(report);
}

function printJobDiagnostic_(report) {
  console.log(JSON.stringify(report));
  return report;
}

// Run only after an administrator has searched the board and confirmed no item exists.
// This does not submit an application or delete its receipt. The original answers must match.
function approveReviewedJobApplicationRetry() {
  var properties = PropertiesService.getScriptProperties();
  var reference = (properties.getProperty("JOB_DIAGNOSTIC_REFERENCE") || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reference)) {
    throw new Error("Set JOB_DIAGNOSTIC_REFERENCE to the reviewed application reference first.");
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("An application is being processed. Try again later.");
  try {
    var key = "application:" + reference;
    var receipt = JSON.parse(properties.getProperty(key) || "null");
    if (!receipt || receipt.phase !== "creating" || receipt.itemId || typeof receipt.hash !== "string" || !receipt.hash) {
      throw new Error("This receipt cannot be approved for a creation retry. Review it manually.");
    }
    receipt.phase = "retry_approved";
    receipt.reviewedAt = new Date().toISOString();
    properties.setProperty(key, JSON.stringify(receipt));
    console.log("One retry approved for the reviewed reference, using the unchanged original answers and attachments. No application was submitted.");
  } finally {
    lock.releaseLock();
  }
}

// Editor-only opt-in for a reviewed test whose answers or attachments have changed.
// Requires the existing no-item review; it never submits or clears a receipt.
function approveReviewedJobApplicationRetryWithUpdatedAnswers() {
  var properties = PropertiesService.getScriptProperties();
  var reference = (properties.getProperty("JOB_DIAGNOSTIC_REFERENCE") || "").trim();
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reference)) {
    throw new Error("Set JOB_DIAGNOSTIC_REFERENCE to the reviewed application reference first.");
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("An application is being processed. Try again later.");
  try {
    var key = "application:" + reference;
    var receipt = JSON.parse(properties.getProperty(key) || "null");
    if (!isReviewedJobApplicationRetry_(receipt)) {
      throw new Error("This receipt cannot be approved for updated answers. A reviewed creation retry with no item ID is required.");
    }
    receipt.allowUpdatedAnswers = true;
    receipt.updatedAnswersApprovedAt = new Date().toISOString();
    properties.setProperty(key, JSON.stringify(receipt));
    console.log("One retry with updated answers or attachments approved for the reviewed reference. No application was submitted.");
  } finally {
    lock.releaseLock();
  }
}
