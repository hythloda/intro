import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const script = fileURLToPath(new URL("./sync-featured-app-board.mjs", import.meta.url));
const page = await fs.readFile(new URL("../featured-app-board.html", import.meta.url), "utf8");
const statusId = "color_mm4kmej3";
const statusColumn = (title = "FA Status", id = statusId) => ({ id, title, type: "status" });
const privateColumns = [
  { id: "dvp", title: "DVP Status", type: "status" },
  { id: "internal", title: "Status Internal Notes", type: "text" },
  { id: "email", title: "Email", type: "email" },
];

function item(id, status, columnId = statusId) {
  return {
    id, name: `Synthetic App ${id}`, updated_at: "2026-10-21T12:00:00Z",
    column_values: [
      { id: columnId, text: status, type: "status" },
      { id: "institution", text: "Synthetic Company", type: "text" },
      ...privateColumns.map((column) => ({ ...column, text: "PRIVATE_TEST_VALUE" })),
    ],
  };
}

function responses(columns, items = [item("1", "2-Approved")], nextItems) {
  const result = [{ data: { boards: [{
    id: "18420896395",
    columns: [
      ...columns,
      { id: "institution", title: "Name of Applying Institution", type: "text" },
      ...privateColumns,
    ],
    items_page: { cursor: nextItems ? "next-page" : null, items },
  }] } }];
  if (nextItems) result.push({ data: { next_items_page: { cursor: null, items: nextItems } } });
  return result;
}

async function runSync(t, replies, env = {}) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "fa-board-test-"));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await fs.mkdir(path.join(cwd, "assets"));
  const output = path.join(cwd, "assets", "featured-app-board-data.js");
  await fs.writeFile(output, "previous working data");
  const mock = `
    import assert from 'node:assert/strict';
    const replies = ${JSON.stringify(replies)};
    let count = 0;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.monday.com/v2');
      assert.equal(options.headers.Authorization, 'synthetic-test-token');
      const { query, variables } = JSON.parse(options.body);
      assert.match(query, /query FeaturedAppBoard/);
      if (count > 0) assert.equal(variables.cursor, 'next-page');
      const reply = replies[count++];
      assert.ok(reply, 'Unexpected API call');
      return { ok: true, json: async () => reply };
    };
  `;
  const result = spawnSync(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(mock)}`, script,
  ], {
    cwd,
    env: { PATH: process.env.PATH, MONDAY: "synthetic-test-token", ...env },
    encoding: "utf8",
  });
  const source = await fs.readFile(output, "utf8");
  let data;
  if (result.status === 0) {
    const context = { window: {} };
    vm.runInNewContext(source, context);
    data = JSON.parse(JSON.stringify(context.window.FEATURED_APP_BOARD_DATA));
  }
  return { ...result, source, data };
}

for (const title of ["Status", "FA Status", "Featured Application Review Status"]) {
  test(`sync retains the FA status column titled ${title}`, async (t) => {
    const result = await runSync(t, responses([statusColumn(title)]));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.data.statusColumnId, statusId);
    assert.equal(result.data.columns.find((column) => column.id === statusId).title, title);
    assert.equal(result.data.rows[0].values[statusId], "2-Approved");
    assert.deepEqual(result.data.columns.map((column) => column.id), [statusId, "institution"]);
    assert.doesNotMatch(result.source, /PRIVATE_TEST_VALUE|synthetic-test-token|DVP Status|Status Internal Notes/);
  });
}

test("sync includes all pages and new labels without hard-coded status values", async (t) => {
  const result = await runSync(t, responses([statusColumn()], [item("1", "0-Locked+Needs Review")], [
    item("2", "1b-FAAC Approved-waiting on tokenomics"), item("3", "9-New label"),
    item("4", ""),
  ]));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.data.rows.map((row) => row.values[statusId] || ""), [
    "0-Locked+Needs Review", "1b-FAAC Approved-waiting on tokenomics", "9-New label", "",
  ]);
});

test("replacement column ID can be configured explicitly", async (t) => {
  const result = await runSync(t, responses([statusColumn("FA Status", "replacement")], [
    item("1", "2-Approved", "replacement"),
  ]), { FEATURED_APP_STATUS_COLUMN_ID: "replacement" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.data.statusColumnId, "replacement");
  assert.equal(result.data.rows[0].values.replacement, "2-Approved");
});

for (const [description, columns] of [
  ["missing status", []],
  ["different status column", [statusColumn("FA Status", "unapproved-replacement")]],
  ["unsupported type", [{ ...statusColumn(), type: "mirror" }]],
]) {
  test(`${description} fails without overwriting working public data`, async (t) => {
    const result = await runSync(t, responses(columns));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Required FA status column/);
    assert.equal(result.source, "previous working data");
  });
}

function browserStatusColumn(boardData) {
  const expression = page.match(/const statusColumn = ([\s\S]*?);/)[1];
  return vm.runInNewContext(expression, {
    boardData, columns: boardData.columns,
    lowered: (value) => String(value || "").trim().toLowerCase(),
  });
}

test("page resolves explicit column metadata before other status columns", () => {
  const faStatus = statusColumn("Renamed", "replacement");
  assert.equal(browserStatusColumn({
    statusColumnId: "replacement",
    columns: [...privateColumns, statusColumn("Old Status"), faStatus],
  }), faStatus);
});

test("page supports cached legacy data and the renamed FA Status column", () => {
  for (const column of [statusColumn("Status"), statusColumn("FA Status"),
    statusColumn("FA Status", "other"), statusColumn("Status", "legacy")]) {
    assert.equal(browserStatusColumn({ columns: [...privateColumns, column] }), column);
  }
  assert.equal(browserStatusColumn({ columns: privateColumns }), undefined);
});

test("page keeps numerical status order, including the new 1b stage", () => {
  const functions = page.slice(page.indexOf("      function getStatusSortNumber("),
    page.indexOf("      function createToggleButton("));
  const labels = ["No Status", "7-Closed-new-process", "2-Approved",
    "1b-FAAC Approved-waiting on tokenomics", "1-Needs Review", "0-Locked+Needs Review"];
  const sorted = vm.runInNewContext(`${functions}\nlabels.sort(compareStatuses)`, {
    text: (value) => String(value || "").trim(), labels,
  });
  assert.deepEqual([...sorted], ["0-Locked+Needs Review", "1-Needs Review",
    "1b-FAAC Approved-waiting on tokenomics", "2-Approved", "7-Closed-new-process", "No Status"]);
});
