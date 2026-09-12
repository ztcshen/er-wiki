const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const document = () =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../examples/fulfillment.drawdb.json"),
      "utf8",
    ),
  );
const model = () => {
  const d = document();
  return {
    tables: d.tables,
    relationships: d.relationships,
    groups: d.reviewGroups,
  };
};
test("explicit process metadata validates without inferring any flow from foreign keys", async () => {
  const { validateProcessModel, bindingIssues } = await import(
      "../process/definition.mjs"
    ),
    d = document();
  assert.equal(validateProcessModel(null), null);
  assert.equal(validateProcessModel(d.processModel), d.processModel);
  assert.deepEqual(bindingIssues(d.processModel, d.tables), []);
  const returns = d.processModel.scenarios[1],
    amend = returns.steps.find(
      (s) => s.id === returns.flows.find((f) => f.kind === "return").to,
    );
  assert(amend.bindings.every((b) => b.access !== "create"));
  const bad = structuredClone(d.processModel);
  bad.scenarios[0].flows[0].to = "missing";
  assert.throws(() => validateProcessModel(bad), /endpoint/);
  bad.scenarios[0].flows[0].to = bad.scenarios[0].steps[1].id;
  bad.scenarios[0].steps[1].bindings[0].access = "execute";
  assert.throws(() => validateProcessModel(bad), /binding/);
});
test("missing mapped fields remain reportable rather than deleting the process", async () => {
  const { validateProcessModel, bindingIssues } = await import(
      "../process/definition.mjs"
    ),
    d = document(),
    before = JSON.stringify(d.processModel);
  d.tables = d.tables.filter((t) => t.id !== "orders");
  assert(bindingIssues(d.processModel, d.tables).length > 0);
  validateProcessModel(d.processModel);
  assert.equal(JSON.stringify(d.processModel), before);
});
test("ER selection maps to activities and scenarios without one-table-one-step assumptions", async () => {
  const { actionsForTable, processSelection } = await import(
    "../process/definition.mjs"
  );
  const d = document();
  assert(actionsForTable(d.processModel.scenarios[0], "orders").length >= 3);
  assert(
    actionsForTable(d.processModel.scenarios[0], "orders", "orders.status")
      .length >= 3,
  );
  assert.equal(
    processSelection(d.processModel, "returns", "restock").activity.id,
    "restock",
  );
  assert.equal(processSelection(null, "", "").scenario, null);
});
test("process topology contains only steps and flow edges; table bindings remain metadata", async () => {
  const { projectProcess } = await import("../process/graph.mjs"),
    m = model(),
    s = document().processModel.scenarios[0],
    before = JSON.stringify(m);
  const flow = projectProcess(m, s);
  assert.equal(flow.nodes.length, s.steps.length);
  assert.equal(flow.edges.length, s.flows.length);
  assert(
    flow.nodes.every((n) => ["action", "event", "decision"].includes(n.kind)),
  );
  assert(flow.edges.every((e) => e.kind === "process-flow"));
  assert.equal(flow.mappedTableIds.length, 11);
  const order = flow.nodes.find((n) => n.stepId === "create-order");
  assert(
    order.step.bindings.some(
      (b) => b.tableId === "orders" && b.fieldIds.includes("orders.status"),
    ),
  );
  assert.deepEqual(projectProcess({ ...m, relationships: [] }, s), flow);
  assert.equal(JSON.stringify(m), before);
});
test("ELK routes both process scenarios, including a return loop, without changing ER data", async () => {
  const { arrangeProcess } = await import("../process/graph.mjs"),
    m = model(),
    d = document(),
    before = JSON.stringify(m);
  for (const scenario of d.processModel.scenarios) {
    const result = await arrangeProcess(m, { scenario });
    assert(result.layout.width > 0);
    assert.equal(result.layout.children.length, scenario.steps.length);
    for (const edge of result.layout.edges)
      for (const section of edge.sections) {
        const points = [
          section.startPoint,
          ...(section.bendPoints || []),
          section.endPoint,
        ];
        for (let i = 1; i < points.length; i++)
          assert(
            points[i - 1].x === points[i].x || points[i - 1].y === points[i].y,
          );
      }
  }
  assert.equal(JSON.stringify(m), before);
});
test("process model survives v2 roundtrips and view positions remain per model and per scenario", async () => {
  const { versionModelDocument, migrateModelDocument } = await import(
    "../renderer/model-format.mjs"
  );
  const d = document(),
    saved = versionModelDocument(d);
  assert.equal(saved.schemaVersion, 2);
  assert.deepEqual(
    migrateModelDocument(JSON.parse(JSON.stringify(saved))).processModel,
    d.processModel,
  );
  const { cleanProcessReader, processReaderKey, processViewKey } = await import(
    "../process/reader.mjs"
  );
  assert.notEqual(processReaderKey("a"), processReaderKey("b"));
  assert.notEqual(
    processViewKey({ mode: "flow", scenarioId: "x" }),
    processViewKey({ mode: "flow", scenarioId: "y" }),
  );
  assert.equal(cleanProcessReader({ mode: "invalid" }).mode, "er");
  assert.deepEqual(
    cleanProcessReader({ views: { bad: [NaN, 0, 100, 200] } }).views,
    {},
  );
});

test("old mixed reader preferences migrate without touching the process definition", async () => {
  const { cleanProcessReader, MODES } = await import("../process/reader.mjs");
  const value = {
      mode: "mixed",
      scenarioId: "fulfillment",
      activityId: "ship",
      mixedScope: "all",
      views: {
        '["flow","fulfillment","focused",""]': [10, 20, 900, 600],
        '["mixed","fulfillment","all",""]': [999, 999, 500, 300],
        '["flow","returns"]': [0, 0, 800, 500],
      },
    },
    before = JSON.stringify(value),
    next = cleanProcessReader(value);
  assert.deepEqual(MODES, ["er", "flow"]);
  assert.equal(next.mode, "flow");
  assert.equal(next.scenarioId, "fulfillment");
  assert.equal(next.activityId, "ship");
  assert.equal(Object.hasOwn(next, "mixedScope"), false);
  assert.deepEqual(next.views, {
    '["flow","fulfillment"]': [10, 20, 900, 600],
    '["flow","returns"]': [0, 0, 800, 500],
  });
  assert.equal(JSON.stringify(value), before);
});
