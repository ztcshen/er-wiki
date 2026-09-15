import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { checkReceipts } from './check-receipts.mjs';
import { checkFieldSelection } from './check-field-selection.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "desktop/package.json"));
const { _electron } = await import(
  process.env.ER_WIKI_PLAYWRIGHT_MODULE || "playwright"
);
const executable = process.env.ER_WIKI_TEST_APP || require("electron");
const launchArgs = process.env.ER_WIKI_TEST_APP
  ? []
  : [path.join(root, "desktop/main.cjs")];
const out = await fs.mkdtemp(path.join(root, "work/replacement-"));
const profile = path.join(out, "profile");
const env = { ...process.env, ER_WIKI_TEST_PROFILE: profile };
const app = await _electron.launch({
  executablePath: executable,
  args: launchArgs,
  env,
});
const page = await app.firstWindow(),
  errors = [];
page.setDefaultTimeout(12000);
page.on("pageerror", (error) => errors.push(error.message));
const ready = () =>
  page.locator('[data-eda-ready="true"]').waitFor({ timeout: 30000 });
const read = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("drawDB");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const q = db.transaction("diagrams").objectStore("diagrams").getAll();
          q.onsuccess = () => {
            db.close();
            resolve(q.result);
          };
        };
      }),
  );
const replace = (data, targetId) =>
  page.evaluate(
    ({ json, targetId }) =>
      new Promise((resolve) =>
        window.dispatchEvent(
          new CustomEvent("erwiki-command", {
            detail: { action: "replace-json", json, targetId, resolve },
          }),
        ),
      ),
    { json: typeof data === "string" ? data : JSON.stringify(data), targetId },
  );
const doc = (title) => ({
  title,
  database: "mysql",
  tables: ["accounts", "entries"].map((name, id) => ({
    id: name,
    name,
    x: id * 450,
    y: 100,
    color: "#0f766e",
    comment: "Fictional replacement smoke",
    fields: [
      {
        id: name + ".id",
        name: "id",
        type: "INT",
        primary: true,
        notNull: true,
        unique: false,
        increment: false,
        default: "",
        check: "",
        comment: "",
      },
    ],
    indices: [],
    uniqueConstraints: [],
  })),
  relationships: [],
  reviewGroups: [
    {
      id: "ledger",
      name: "Ledger",
      color: "#0f766e",
      tableIds: ["accounts", "entries"],
    },
  ],
  notes: [],
  subjectAreas: [],
  types: [],
  enums: [],
  views: [],
});
try {
  await ready();
  if (process.argv.includes('--field-selection-only')) {
    await checkFieldSelection({ app, page, read, replace, out });
    assert.deepEqual(errors, []);
  } else if (process.argv.includes('--receipts-only')) {
    await checkReceipts({ app, page, read, profile, out });
    assert.deepEqual(errors, []);
  } else {
  const before = await read(),
    url = page.url(),
    id = url.split("/").at(-1);
  const pid = app.process().pid,
    windowId = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id,
    );
  await page.evaluate(() => {
    window.__replacementSentinel = "same-renderer";
  });
  assert.equal((await replace("{", id)).ok, false);
  assert.deepEqual(await read(), before);
  assert.equal((await replace(doc("wrong-target"), "wrong")).ok, false);
  assert.deepEqual(await read(), before);
  const invalid = doc("invalid");
  invalid.reviewGroups[0].tableIds.push("missing");
  assert.equal((await replace(invalid, id)).ok, false);
  assert.deepEqual(await read(), before);
  await page.evaluate(() => {
    window.__originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (this.name === "diagrams" && value.name === "write-failure")
        throw new DOMException("Injected failure", "QuotaExceededError");
      return window.__originalPut.call(this, value, ...args);
    };
  });
  const failedWrite = await replace(doc("write-failure"), id);
  assert.equal(failedWrite.ok, false);
  assert.match(failedWrite.error, /Injected failure|quota/i);
  assert.deepEqual(await read(), before);
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 13);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.__originalPut;
    delete window.__originalPut;
  });
  const next = doc("Complete replacement");
  const completed = await replace(next, id);
  assert.equal(completed.ok, true, JSON.stringify(completed));
  await page.waitForFunction(
    () => document.querySelectorAll('[data-node-kind="table"]').length === 2,
  );
  await ready();
  const after = await read();
  assert.equal(after.length, before.length);
  const saved = after.find((m) => m.diagramId === id),
    old = before.find((m) => m.diagramId === id);
  assert.equal(saved.id, old.id);
  assert.deepEqual(saved.tables, next.tables);
  assert.deepEqual(saved.reviewGroups, next.reviewGroups);
  assert.equal(saved.name, next.title);
  assert.equal(page.url(), url);
  assert.equal(app.process().pid, pid);
  assert.equal(
    await page.evaluate(() => window.__replacementSentinel),
    "same-renderer",
  );
  assert.equal(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].id,
    ),
    windowId,
  );
  assert.equal(await page.locator(".eda-domain-heading").count(), 1);
  await page.screenshot({
    path: path.join(out, "replacement.png"),
    scale: "css",
  });
  // Native file picker and confirmation use the same replacement path.
  const uiFile = path.join(out, "ui.json");
  await fs.writeFile(uiFile, JSON.stringify(doc("UI replacement")));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
    dialog.showMessageBox = async () => ({ response: 0 });
  }, uiFile);
  const invokeUI = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          window.dispatchEvent(
            new CustomEvent("erwiki-command", {
              detail: { action: "replace", resolve },
            }),
          ),
        ),
    );
  const unchanged = await read();
  assert.equal((await invokeUI()).ok, false);
  assert.deepEqual(await read(), unchanged);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  assert.equal((await invokeUI()).ok, true);
  assert.equal(
    (await read()).find((m) => m.diagramId === id).name,
    "UI replacement",
  );
  const cliFile = path.join(out, "cli.json");
  await fs.writeFile(cliFile, JSON.stringify(doc("CLI live replacement")));
  await app.evaluate(
    ({ app }, { file, id }) =>
      app.emit(
        "second-instance",
        {},
        ["--replace-model", file, "--model-id", id],
        process.cwd(),
      ),
    { file: cliFile, id },
  );
  const until = Date.now() + 15000;
  let receipt;
  do {
    try {
      receipt = JSON.parse(
        await fs.readFile(
          path.join(profile, "model-replacement-result.json"),
          "utf8",
        ),
      );
    } catch {}
    if (receipt?.ok !== null && receipt?.finishedAt) break;
    await new Promise((resolve) => setTimeout(resolve, 80));
  } while (Date.now() < until);
  assert.equal(receipt?.ok, true, JSON.stringify(receipt));
  await page.waitForFunction(() =>
    document
      .querySelector(".desktop-model-switcher select")
      ?.selectedOptions[0]?.textContent?.includes("CLI live replacement"),
  );
  assert.equal(
    await page.evaluate(() => window.__replacementSentinel),
    "same-renderer",
  );
  assert.equal(app.process().pid, pid);
  assert.equal((await read()).length, before.length);
  assert.deepEqual(errors, []);
  await page.reload();
  await ready();
  assert.equal(
    (await read()).find((m) => m.diagramId === id).name,
    "CLI live replacement",
  );
  console.log(
    JSON.stringify({
      passed: true,
      out,
      checks:
        "invalid JSON, invalid groups, wrong target, storage failure, full replacement and deletion, retained model ID/count, native cancel/confirm, live CLI handoff, same renderer/window/process, reload persistence",
    }),
  );
  }
} catch (error) {
  await page
    .screenshot({ path: path.join(out, "failure.png") })
    .catch(() => {});
  console.error({
    out,
    errors,
    body: (await page.locator("body").innerText()).slice(-2200),
  });
  throw error;
} finally {
  await app.close();
}
