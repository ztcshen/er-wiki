import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  require = createRequire(path.join(root, "desktop/package.json"));
const { _electron } = await import(
  process.env.ER_WIKI_PLAYWRIGHT_MODULE || "playwright"
);
const version = JSON.parse(
  await fs.readFile(path.join(root, "desktop/package.json"), "utf8"),
).version;
const packaged = process.argv.includes("--packaged"),
  executable = packaged
    ? path.join(
        root,
        "desktop/release",
        version,
        "ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community",
      )
    : require("electron");
const out = await fs.mkdtemp(path.join(root, "work/round1-"));
const app = await _electron.launch({
  executablePath: executable,
  args: packaged ? [] : [path.join(root, "desktop/main.cjs")],
  env: { ...process.env, ER_WIKI_TEST_PROFILE: path.join(out, "profile") },
});
const page = await app.firstWindow(),
  errors = [];
page.setDefaultTimeout(12000);
page.on("pageerror", (e) => errors.push(e.message));
const ready = () =>
  page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
const close = () =>
  page.getByRole("button", { name: "Close editor", exact: true }).click();
const checks = () =>
  page.getByRole("button", { name: "Structure checks", exact: true }).click();
const read = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const q = indexedDB.open("drawDB");
        q.onerror = () => reject(q.error);
        q.onsuccess = () => {
          const db = q.result,
            r = db.transaction("diagrams").objectStore("diagrams").getAll();
          r.onsuccess = () => {
            db.close();
            resolve(
              r.result.find(
                (m) => m.diagramId === location.pathname.split("/").at(-1),
              ),
            );
          };
        };
      }),
  );
const waitRecord = async (predicate) => {
  const until = Date.now() + 12000;
  let value;
  do {
    value = await read();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 50));
  } while (Date.now() < until);
  throw Error("Saved state did not match expected result");
};
const locateRow = (code) =>
  page.locator('[data-check-code="' + code + '"]').first();
try {
  await ready();
  const original = await read();
  await checks();
  assert.equal(await page.locator("[data-check-code]").count(), 0);
  await close();
  assert.equal(
    (await read()).lastModified.getTime(),
    original.lastModified.getTime(),
  );
  // Seed only this isolated test profile with a legacy/damaged schema fixture.
  await page.evaluate(async () => {
    const q = indexedDB.open("drawDB");
    const db = await new Promise(
      (resolve) => (q.onsuccess = () => resolve(q.result)),
    );
    const get = db.transaction("diagrams").objectStore("diagrams").getAll();
    const rows = await new Promise(
      (resolve) => (get.onsuccess = () => resolve(get.result)),
    );
    const fixture = structuredClone(
      rows.find((m) => m.diagramId === "demo-fulfillment"),
    );
    delete fixture.id;
    fixture.diagramId = "round1-fixture";
    fixture.name = "Round 1 fixture";
    fixture.tables
      .find((t) => t.id === "orders")
      .fields.find((f) => f.name === "order_no").name = "id";
    fixture.tables
      .find((t) => t.id === "orders")
      .fields.find((f) => f.name === "status").default = "'UNKNOWN_VALUE'";
    fixture.references[0].endFieldId = "missing-field";
    fixture.references[0].fields[0].endFieldId = "missing-field";
    const tx = db.transaction("diagrams", "readwrite");
    tx.objectStore("diagrams").add(fixture);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
    window.dispatchEvent(
      new CustomEvent("erwiki-switch-model", { detail: "round1-fixture" }),
    );
  });
  await page.waitForURL("**/round1-fixture");
  await ready();
  await checks();
  for (const code of ["field_name", "relation_field", "enum_default"])
    await locateRow(code).waitFor();
  await page.screenshot({ path: path.join(out, "checks.png"), scale: "css" });
  await locateRow("field_name")
    .getByRole("button", { name: "Locate", exact: true })
    .click();
  await ready();
  assert.equal(
    await page.locator("[data-eda-field-details] h3").innerText(),
    "id",
  );
  await checks();
  await locateRow("field_name")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const duplicate = page.locator('[data-edit-field="id"]').nth(1);
  await duplicate.locator('[data-editor-cell="field"] input').fill("order_no");
  await page
    .locator('[data-edit-field="order_no"] [data-editor-cell="field"] input')
    .press("Tab");
  await close();
  await checks();
  assert.equal(await page.locator('[data-check-code="field_name"]').count(), 0);
  await locateRow("relation_field")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Target field 1", exact: true })
    .selectOption(original.references[0].endFieldId);
  await page
    .getByRole("button", { name: "Apply field mapping", exact: true })
    .click();
  await close();
  await ready();
  await checks();
  assert.equal(
    await page.locator('[data-check-code="relation_field"]').count(),
    0,
  );
  await locateRow("enum_default")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  const status = page.locator('[data-edit-field="status"]');
  await status
    .getByRole("button", { name: "Field details orders.status", exact: true })
    .click();
  await status.getByPlaceholder("Default", { exact: true }).fill("'DRAFT'");
  await status.getByPlaceholder("Default", { exact: true }).press("Tab");
  await status
    .getByRole("button", {
      name: "Configure enum values orders.status",
      exact: true,
    })
    .click();
  const enumRow = page.locator(
    '[data-enum-editor="orders.status"] [data-enum-value="DRAFT"]',
  );
  await enumRow
    .getByRole("button", { name: "Edit enum DRAFT", exact: true })
    .click();
  await enumRow
    .getByRole("textbox", { name: "Edit enum meaning", exact: true })
    .fill("Draft order");
  await enumRow.getByRole("button", { name: "Apply", exact: true }).click();
  assert((await enumRow.innerText()).includes("Draft order"));
  await close();
  await checks();
  assert.equal(
    await page.locator('[data-check-code="enum_default"]').count(),
    0,
  );
  await close();
  // A native save shortcut commits the focused length draft before saving.
  await page.getByRole("button", { name: "Edit table", exact: true }).click();
  const size = page.getByRole("textbox", {
    name: "Field length orders.order_no",
    exact: true,
  });
  await size.fill("192");
  await size.press("Meta+s");
  await waitRecord(
    (m) =>
      String(
        m.tables
          .find((t) => t.id === "orders")
          .fields.find((f) => f.name === "order_no").size,
      ) === "192",
  );
  await close();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Add relation", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Relationship name", exact: true })
    .fill("review_composite");
  await page
    .getByRole("combobox", { name: "Referencing table", exact: true })
    .selectOption("products");
  await page
    .getByRole("combobox", { name: "Target table", exact: true })
    .selectOption("orders");
  await page
    .getByRole("combobox", { name: "Source field 1", exact: true })
    .selectOption("products.id");
  await page
    .getByRole("combobox", { name: "Target field 1", exact: true })
    .selectOption("orders.id");
  await page
    .getByRole("button", { name: "Add field pair", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Source field 2", exact: true })
    .selectOption("products.sku");
  await page
    .getByRole("combobox", { name: "Target field 2", exact: true })
    .selectOption("orders.order_no");
  await page
    .getByRole("button", { name: "Create relation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply field mapping", exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(out, "relationship.png"),
    scale: "css",
  });
  await page.locator("button:has(i.bi-arrow-left-right)").click();
  await close();
  let saved = await waitRecord((m) =>
    m.references.some(
      (r) => r.name === "review_composite" && r.startTableId === "orders",
    ),
  );
  let relation = saved.references.find((r) => r.name === "review_composite");
  assert.equal(relation.fields.length, 2);
  assert.equal(relation.cardinality, "one_to_many");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  saved = await waitRecord(
    (m) =>
      m.references.find((r) => r.name === "review_composite")?.startTableId ===
      "products",
  );
  relation = saved.references.find((r) => r.name === "review_composite");
  assert.equal(relation.cardinality, "many_to_one");
  assert.equal(relation.startFieldId, relation.fields[0].startFieldId);
  await checks();
  await page.locator('[data-check-code="relation_type"]').waitFor();
  await close();
  const before = await read();
  await checks();
  await close();
  const after = await read();
  assert.deepEqual(before, after);
  assert(!Object.hasOwn(after, "reviewIssues"));
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(980, 800),
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      packaged,
      out,
      checks:
        "live non-persistent diagnostics, locate/edit/resolve, broken reference repair, enum edit/default parsing, focused length save, composite relationship and reversible cardinality swap",
    }),
  );
} catch (error) {
  await page
    .screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
  console.error({
    out,
    errors,
    body: (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).slice(-3200),
  });
  throw error;
} finally {
  await app.close();
}
