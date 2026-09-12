const { test } = require("node:test");
const assert = require("node:assert/strict");
test("only intra-domain wires share the domain color; cross-domain bundles stay neutral", async () => {
  const { relationColor } = await import("../eda/presentation.mjs");
  const domains = new Map([
    ["a", { id: "sales", color: "#0f766e" }],
    ["b", { id: "sales", color: "#0f766e" }],
    ["c", { id: "stock", color: "#3276b9" }],
  ]);
  const relations = new Map([
    ["same", { startTableId: "a", endTableId: "b" }],
    ["cross", { startTableId: "c", endTableId: "b" }],
  ]);
  assert.equal(
    relationColor({ refs: ["same"] }, relations, domains),
    "#0f766e",
  );
  assert.equal(
    relationColor({ refs: ["cross"] }, relations, domains),
    "#8a9db0",
  );
  assert.equal(
    relationColor({ refs: ["same", "cross"] }, relations, domains),
    "#8a9db0",
  );
});
test("semantic summary is a scale-only presentation, not a scope filter", async () => {
  const { isCompact } = await import("../eda/presentation.mjs");
  assert.equal(isCompact(0.29), true);
  assert.equal(isCompact(0.55), false);
  assert.equal(isCompact(1), false);
  assert.equal(isCompact(0), false);
  assert.equal(isCompact(NaN), false);
});
test("compact table titles wrap at a boundary and preserve short identifiers", async () => {
  const { compactTitle, fitText } = await import("../eda/presentation.mjs");
  assert.deepEqual(compactTitle("orders", 320, 36), ["orders"]);
  const name = "fulfillment_items",
    lines = compactTitle(name, 320, 36);
  assert.equal(lines.length, 2);
  assert.equal(lines.join(""), name);
  assert(fitText("很长的中文字段名称", 44, 11).endsWith("…"));
});
test("table relationship list includes both directions and self links only once", async () => {
  const { tableRelationships } = await import("../eda/presentation.mjs");
  const rows = [
    { id: "a", startTableId: 0, endTableId: 1 },
    { id: "b", startTableId: 1, endTableId: 0 },
    { id: "c", startTableId: 0, endTableId: 0 },
    { id: "d", startTableId: 1, endTableId: 2 },
  ];
  assert.deepEqual(
    tableRelationships(0, rows).map((r) => r.id),
    ["a", "b", "c"],
  );
  assert.equal(rows.length, 4);
});
