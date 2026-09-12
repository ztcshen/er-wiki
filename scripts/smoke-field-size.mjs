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
const packaged = process.argv.includes("--packaged");
const executable = packaged
  ? path.join(
      root,
      "desktop/release",
      version,
      "ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community",
    )
  : require("electron");
const out = await fs.mkdtemp(path.join(root, "work/field-size-")),
  profile = path.join(out, "profile");
const launch = () =>
  _electron.launch({
    executablePath: executable,
    args: packaged ? [] : [path.join(root, "desktop/main.cjs")],
    env: { ...process.env, ER_WIKI_TEST_PROFILE: profile },
  });
let app = await launch(),
  page = await app.firstWindow();
const errors = [];
const setup = () => {
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
};
setup();
const ready = () =>
  page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
const read = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("drawDB");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            query = db.transaction("diagrams").objectStore("diagrams").getAll();
          query.onsuccess = () => {
            db.close();
            resolve(
              query.result.find((x) => x.diagramId === "demo-fulfillment"),
            );
          };
        };
      }),
  );
const field = async (name) =>
  (await read()).tables
    .find((t) => t.id === "orders")
    .fields.find((f) => f.name === name);
const waitSize = async (name, size) => {
  const deadline = Date.now() + 12000;
  let actual;
  do {
    actual = String((await field(name)).size);
    if (actual === size) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.equal(actual, size);
};
const close = () =>
  page.getByRole("button", { name: "Close editor", exact: true }).click();
const open = async () => {
  await page
    .locator(".eda-directory")
    .getByRole("button", { name: "orders", exact: true })
    .click();
  await ready();
  await page.getByRole("button", { name: "Edit table", exact: true }).click();
};
try {
  await ready();
  const original = await read(),
    old = String((await field("order_no")).size);
  await open();
  let row = page.locator('[data-edit-field="order_no"]'),
    input = row.getByRole("textbox", {
      name: "Field length orders.order_no",
      exact: true,
    });
  assert.equal(await input.inputValue(), old);
  await input.fill("256");
  assert.equal(String((await field("order_no")).size), old);
  await input.press("Enter");
  await close();
  await page.getByRole("button", { name: "Save model", exact: true }).click();
  await waitSize("order_no", "256");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await waitSize("order_no", old);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await waitSize("order_no", "256");
  await open();
  row = page.locator('[data-edit-field="order_no"]');
  await row
    .getByRole("button", { name: "Field details orders.order_no", exact: true })
    .click();
  const detailed = row.locator(
    '.review-field-details [data-size-editor="order_no"] input',
  );
  assert.equal(await detailed.inputValue(), "256");
  await detailed.fill("512");
  await detailed.press("Tab");
  await row
    .getByRole("button", { name: "Field details orders.order_no", exact: true })
    .click();
  input = row.getByRole("textbox", {
    name: "Field length orders.order_no",
    exact: true,
  });
  assert.equal(await input.inputValue(), "512");
  await waitSize("order_no", "512");
  await input.fill("-1");
  await input.press("Tab");
  await row.getByRole("alert").waitFor();
  assert.equal(String((await field("order_no")).size), "512");
  await input.focus();
  await input.press("Escape");
  assert.equal(await input.inputValue(), "512");
  await input.fill("768");
  await input.press("Escape");
  await input.press("Tab");
  assert.equal(await input.inputValue(), "512");
  const number = page.locator('[data-edit-field="total_minor"]');
  await number.locator(".semi-select").click();
  await page.getByText("DECIMAL", { exact: true }).click();
  const precision = number.getByRole("textbox", {
    name: "Field precision orders.total_minor",
    exact: true,
  });
  await precision.fill("18, 4");
  await precision.press("Enter");
  assert.equal(await precision.inputValue(), "18,4");
  await page.screenshot({
    path: path.join(out, "editor.png"),
    animations: "disabled",
    scale: "css",
  });
  await close();
  await page.getByRole("button", { name: "Save model", exact: true }).click();
  await waitSize("total_minor", "18,4");
  const file = path.join(out, "model.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByText("Export JSON…", { exact: true }).click();
  const until = Date.now() + 12000;
  let exported;
  while (Date.now() < until) {
    try {
      exported = JSON.parse(await fs.readFile(file, "utf8"));
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert(exported);
  assert.equal(
    exported.tables
      .find((t) => t.id === "orders")
      .fields.find((f) => f.name === "order_no").size,
    "512",
  );
  assert.equal(
    exported.tables
      .find((t) => t.id === "orders")
      .fields.find((f) => f.name === "total_minor").size,
    "18,4",
  );
  assert.deepEqual(exported.relationships, original.references);
  await app.close();
  app = await launch();
  page = await app.firstWindow();
  setup();
  await ready();
  await open();
  assert.equal(
    await page
      .getByRole("textbox", {
        name: "Field length orders.order_no",
        exact: true,
      })
      .inputValue(),
    "512",
  );
  assert.equal(
    await page
      .getByRole("textbox", {
        name: "Field precision orders.total_minor",
        exact: true,
      })
      .inputValue(),
    "18,4",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      packaged,
      out,
      checks:
        "inline length, draft isolation, Enter/blur single undo, redo, detail synchronization, invalid input, Escape, precision, JSON export and restart persistence",
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
    ).slice(-2400),
  });
  throw error;
} finally {
  await app.close();
}
