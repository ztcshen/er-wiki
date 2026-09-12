import assert from "node:assert/strict";
export async function checkErReading({ page, record }) {
  const original = await record();
  const ready = () =>
    page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
  const overview = async () => {
    await page
      .getByRole("combobox", { name: "Schematic level" })
      .selectOption("overview");
    await ready();
    await page
      .getByRole("button", { name: "Fit to window", exact: true })
      .click();
  };
  await overview();
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 13);
  assert.equal(await page.locator("[data-eda-summary]").count(), 13);
  assert.equal(await page.locator(".process-switchbar").count(), 0);
  const geometry = () =>
    page
      .locator('[data-node-kind="table"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => [n.dataset.tableId, n.getAttribute("transform")]),
      );
  const positions = await geometry();
  await page
    .getByRole("button", { name: "Diagram display settings", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Emphasize table names when zoomed out" })
    .uncheck();
  await page
    .getByRole("button", { name: "Diagram display settings", exact: true })
    .click();
  assert.equal(await page.locator("[data-eda-summary]").count(), 0);
  assert.deepEqual(await geometry(), positions);
  await page
    .getByRole("button", { name: "Diagram display settings", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Emphasize table names when zoomed out" })
    .check();
  await page
    .getByRole("button", { name: "Diagram display settings", exact: true })
    .click();
  await page
    .locator('[data-node-kind="table"][data-table-id="orders"]')
    .click();
  await page.getByRole("region", { name: "Table fields" }).waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-node-kind="table"][data-table-id="orders"]')
        .dataset.detail === "fields",
  );
  assert.equal(
    await page.locator('[data-node-kind="table"]').count(),
    13,
    "Focusing a summary must not drop global tables",
  );
  await page
    .getByRole("searchbox", { name: "Filter table fields" })
    .fill("订单状态");
  assert.equal(await page.locator("[data-field-item]").count(), 1);
  await page.locator('[data-field-item="orders.status"]').click();
  await ready();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-eda-field-details] h3")?.textContent ===
      "status",
  );
  assert.equal(
    await page
      .locator('[data-eda-field="orders.status"]')
      .getAttribute("data-eda-endpoint"),
    "true",
  );
  const relation = original.references.find(
    (r) => r.startTableId === "order_items" && r.endTableId === "orders",
  );
  await page.locator('[data-related-relation="' + relation.id + '"]').click();
  assert.equal(
    await page
      .locator('[data-net-member][data-selected="true"]')
      .getAttribute("data-net-member"),
    relation.id,
  );
  const highlight = await page
    .locator('[data-eda-wire][data-highlight="true"]')
    .evaluateAll((nodes) => nodes.map((n) => JSON.parse(n.dataset.relIds)));
  assert(
    highlight.length && highlight.every((ids) => ids.includes(relation.id)),
  );
  await overview();
  const final = await record();
  assert.deepEqual(final.tables, original.tables);
  assert.deepEqual(final.references, original.references);
  assert.equal(final.lastModified.getTime(), original.lastModified.getTime());
  console.log(
    "PASS: 13-table semantic summary, unchanged geometry, readable focus, field aliases/enums, relation selection and unchanged saved model",
  );
}
