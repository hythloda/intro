import fs from "node:fs/promises";
import path from "node:path";

const MONDAY_API_URL = "https://api.monday.com/v2";
const BOARD_ID = process.env.FEATURED_APP_BOARD_ID || "18420896395";
const TOKEN = process.env.MONDAY;
const OUTPUT_PATH = path.join(process.cwd(), "assets", "featured-app-board-data.js");
const PAGE_LIMIT = 500;

const approvedColumnTitlePrefixes = [
  "Status",
  "Name of Applying Institution",
  "Party ID for the Featured Appl",
  "Locking PartyIDs",
  "Unlocking",
  "Type",
  "Locked amount (Million)",
  "Describe how your application",
  "Describe the activities that yo",
  "Describe the expected users",
  "Does this activity use Canton",
  "Does your application have an",
  "How do you expect your trans",
  "How would not having FA stat",
  "If there are multiple use cases,",
  "If using Activity Markers pleas",
  "Link to Brand Materials (optio",
  "On a per user basis, what is yo",
  "Product Website",
  "Provide a summary of what yo",
  "Share links for resources such",
  "Summary of Company and Ba",
  "URL for the public code repos",
  "Under what conditions may a",
  "What is your anticipated launc",
  "Where is your code visible for",
  "Who will be your first custom",
  "Demo Video 16:9 ratio (option",
  "Additional Notes for the Com",
  "Has this application, or a subs",
];

if (!TOKEN) {
  throw new Error("Missing MONDAY environment variable");
}

const firstPageQuery = `
  query FeaturedAppBoard($boardIds: [ID!]!, $limit: Int!) {
    boards(ids: $boardIds) {
      id
      columns {
        id
        title
        type
      }
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          updated_at
          column_values {
            id
            text
            type
            column {
              title
            }
          }
        }
      }
    }
  }
`;

const nextPageQuery = `
  query FeaturedAppBoardNextPage($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id
        name
        updated_at
        column_values {
          id
          text
          type
          column {
            title
          }
        }
      }
    }
  }
`;

const firstPage = await mondayRequest(firstPageQuery, {
  boardIds: [String(BOARD_ID)],
  limit: PAGE_LIMIT,
});

const board = firstPage.data?.boards?.[0];
if (!board) {
  throw new Error(`Monday board ${BOARD_ID} was not found or is not accessible`);
}

let cursor = board.items_page?.cursor || null;
const items = [...(board.items_page?.items || [])];

while (cursor) {
  const nextPage = await mondayRequest(nextPageQuery, {
    cursor,
    limit: PAGE_LIMIT,
  });
  const page = nextPage.data?.next_items_page;
  if (!page) {
    throw new Error("Monday next_items_page response was empty");
  }

  items.push(...(page.items || []));
  cursor = page.cursor || null;
}

const publicColumns = board.columns
  .filter((column) => isApprovedColumn(column.title))
  .map((column) => ({
    id: column.id,
    title: cleanText(column.title),
    type: column.type,
  }));

const publicColumnIds = new Set(publicColumns.map((column) => column.id));

const rows = items
  .map((item) => {
    const values = {};

    for (const value of item.column_values || []) {
      if (!publicColumnIds.has(value.id)) {
        continue;
      }

      const displayValue = cleanText(value.text);
      if (displayValue) {
        values[value.id] = displayValue;
      }
    }

    return {
      id: String(item.id),
      name: cleanText(item.name),
      updatedAt: cleanText(item.updated_at),
      values,
    };
  })
  .filter((row) => row.name || Object.keys(row.values).length > 0);

const output = {
  generatedAt: new Date().toISOString(),
  columns: publicColumns,
  rows,
};

await fs.writeFile(
  OUTPUT_PATH,
  `window.FEATURED_APP_BOARD_DATA = ${JSON.stringify(output, null, 2)};\n`,
  "utf8"
);

console.log(`Synced ${rows.length} Featured App board rows and ${publicColumns.length} approved columns.`);

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

function isApprovedColumn(title) {
  const normalizedTitle = cleanText(title).toLowerCase();
  return approvedColumnTitlePrefixes.some((prefix) =>
    normalizedTitle.startsWith(prefix.toLowerCase())
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}
