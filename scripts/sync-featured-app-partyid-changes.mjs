import fs from "node:fs/promises";
import path from "node:path";

const MONDAY_API_URL = "https://api.monday.com/v2";
const BOARD_ID = process.env.FEATURED_APP_BOARD_ID || "18420896395";
const TOKEN = process.env.MONDAY;
const OUTPUT_PATH = path.join(process.cwd(), "assets", "featured-app-partyid-changes-data.js");
const MAX_CHANGES = 20;
const LOOKBACK_DAYS = Number(process.env.FEATURED_APP_PARTYID_CHANGE_LOOKBACK_DAYS || 365);

const trackedColumnTitlePrefixes = [
  "Party ID for the Featured Application:",
  "Locking PartyIDs",
];

if (!TOKEN) {
  throw new Error("Missing MONDAY environment variable");
}

const columnsQuery = `
  query FeaturedAppPartyIdColumns($boardIds: [ID!]!) {
    boards(ids: $boardIds) {
      id
      columns {
        id
        title
        type
      }
    }
  }
`;

const activityLogsQuery = `
  query FeaturedAppPartyIdActivityLogs(
    $boardIds: [ID!]!
    $columnIds: [String]
    $from: ISO8601DateTime
    $to: ISO8601DateTime
    $limit: Int
    $page: Int
  ) {
    boards(ids: $boardIds) {
      activity_logs(
        column_ids: $columnIds
        from: $from
        to: $to
        limit: $limit
        page: $page
      ) {
        id
        event
        entity
        data
        created_at
      }
    }
  }
`;

const columnsResponse = await mondayRequest(columnsQuery, {
  boardIds: [String(BOARD_ID)],
});

const board = columnsResponse.data?.boards?.[0];
if (!board) {
  throw new Error(`Monday board ${BOARD_ID} was not found or is not accessible`);
}

const trackedColumns = board.columns.filter((column) => isTrackedColumn(column.title));
if (trackedColumns.length === 0) {
  throw new Error("No tracked PartyID columns were found on the Monday board");
}

const columnById = new Map(
  trackedColumns.map((column) => [column.id, { id: column.id, title: cleanText(column.title), type: column.type }])
);

const now = new Date();
const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
const activityResponse = await mondayRequest(activityLogsQuery, {
  boardIds: [String(BOARD_ID)],
  columnIds: trackedColumns.map((column) => column.id),
  from: from.toISOString(),
  to: now.toISOString(),
  limit: 10000,
  page: 1,
});

const rawLogs = activityResponse.data?.boards?.[0]?.activity_logs || [];

const changes = rawLogs
  .filter((log) => log.event === "update_column_value")
  .map((log) => normalizeLog(log, columnById))
  .filter(Boolean)
  .filter((change) => change.previousValue !== change.newValue)
  .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt))
  .slice(0, MAX_CHANGES);

const output = {
  generatedAt: new Date().toISOString(),
  columns: [...columnById.values()],
  changes,
};

await fs.writeFile(
  OUTPUT_PATH,
  `window.FEATURED_APP_PARTYID_CHANGES_DATA = ${JSON.stringify(output, null, 2)};\n`,
  "utf8"
);

console.log(`Synced ${changes.length} recent Featured App PartyID changes.`);

async function mondayRequest(query, variables) {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Monday API request failed: ${response.status} ${response.statusText}`);
  }

  if (!json) {
    throw new Error("Monday API returned an empty response");
  }

  if (json.errors?.length) {
    const message = json.errors.map((error) => error.message).join("; ");
    throw new Error(`Monday API returned GraphQL errors: ${message}`);
  }

  return json;
}

function normalizeLog(log, columnById) {
  const data = parseJson(log.data);
  const columnId = data.column_id || "";
  const column = columnById.get(columnId);
  if (!column) {
    return null;
  }

  return {
    id: String(log.id),
    changedAt: parseMondayTimestamp(log.created_at),
    itemName: cleanText(data.pulse_name) || "Unknown application",
    itemId: data.pulse_id ? String(data.pulse_id) : "",
    field: column.title,
    previousValue: extractDisplayValue(data.previous_value),
    newValue: extractDisplayValue(data.value),
  };
}

function parseMondayTimestamp(value) {
  const raw = cleanText(value);
  if (!raw) {
    return new Date().toISOString();
  }

  if (/^\d{16,18}$/.test(raw)) {
    return new Date(Math.round(Number(raw) / 10000)).toISOString();
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

function extractDisplayValue(value) {
  if (value == null) {
    return "";
  }

  const parsed = typeof value === "string" ? parseJson(value, value) : value;

  if (typeof parsed === "string") {
    return cleanText(parsed);
  }

  if (typeof parsed === "number" || typeof parsed === "boolean") {
    return String(parsed);
  }

  if (Array.isArray(parsed)) {
    return parsed.map(extractDisplayValue).filter(Boolean).join(", ");
  }

  if (typeof parsed === "object") {
    for (const key of ["text", "value", "label", "url"]) {
      if (typeof parsed[key] === "string" || typeof parsed[key] === "number") {
        return cleanText(parsed[key]);
      }
    }

    if (parsed.label && typeof parsed.label === "object") {
      return extractDisplayValue(parsed.label);
    }

    const strings = [];
    collectStrings(parsed, strings);
    return strings.join(", ");
  }

  return "";
}

function collectStrings(value, strings) {
  if (value == null) {
    return;
  }

  if (typeof value === "string") {
    const cleaned = cleanText(value);
    if (cleaned) {
      strings.push(cleaned);
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    strings.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, strings);
    }
    return;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStrings(item, strings);
    }
  }
}

function parseJson(value, fallback = {}) {
  if (typeof value !== "string") {
    return value ?? fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isTrackedColumn(title) {
  const normalizedTitle = cleanText(title).toLowerCase();
  return trackedColumnTitlePrefixes.some((prefix) =>
    normalizedTitle.startsWith(prefix.toLowerCase())
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
