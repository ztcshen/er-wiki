import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const { _electron } = await import(
  process.env.ER_WIKI_PLAYWRIGHT_MODULE || "playwright"
);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  require = createRequire(path.join(root, "desktop/package.json")),
  version = JSON.parse(
    await fs.readFile("desktop/package.json", "utf8"),
  ).version;
const packaged = process.argv.includes("--packaged"),
  executable = packaged
    ? path.join(
        root,
        `desktop/release/${version}/ER Wiki Community-darwin-arm64/ER Wiki Community.app/Contents/MacOS/ER Wiki Community`,
      )
    : require("electron");
const run = await fs.mkdtemp(path.join(root, "work/process-preview-")),
  profile = path.join(run, "profile"),
  env = { ...process.env, ER_WIKI_TEST_PROFILE: profile };
const app = await _electron.launch({
    executablePath: executable,
    args: packaged ? [] : [path.join(root, "desktop/main.cjs")],
    env,
  }),
  page = await app.firstWindow(),
  errors = [];
page.setDefaultTimeout(12000);
page.on("pageerror", (error) => errors.push(error.message));
const ready = () =>
  page.locator('[data-process-ready="true"]').waitFor({ timeout: 30000 });
const erReady = () =>
  page
    .locator('.process-original-er:not(.is-hidden) [data-eda-ready="true"]')
    .waitFor({ timeout: 30000 });
const read = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("drawDB");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("diagrams").objectStore("diagrams").getAll();
          q.onsuccess = () => {
            db.close();
            resolve(q.result.find((m) => m.diagramId === "demo-fulfillment"));
          };
        };
      }),
  );
const item = async (name) => {
  await page.getByRole("button", { name: /^(More actions|更多操作)$/ }).click();
  await page.getByText(name, { exact: true }).click();
};
const capture = async (name) => {
  await page.mouse.move(18, 70);
  await page.screenshot({
    path: path.join(run, name),
    scale: "css",
    animations: "disabled",
  });
};
try {
  await erReady();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
  );
  const original = await read();
  assert.equal(original.tables.length, 13);
  assert.equal(original.processModel.scenarios.length, 2);
  await item("Settings…");
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh");
  await page.getByRole("button", { name: "关闭编辑器", exact: true }).click();
  await page
    .locator(".process-original-er .eda-directory")
    .getByRole("button", { name: "orders", exact: true })
    .click();
  await erReady();
  const erView = await page
    .locator(".process-original-er [data-eda-scene]")
    .getAttribute("viewBox");
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  assert.equal(
    await page.locator('.process-workspace [data-node-kind="table"]').count(),
    0,
  );
  assert.equal(await page.locator("[data-process-step]").count(), 9);
  await page.locator('[data-process-step="ship"]').click();
  await capture("flow.png");
  const flowScene = page.locator(".process-workspace [data-eda-scene]"),
    flowBefore = await flowScene.getAttribute("viewBox"),
    box = await flowScene.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForFunction(
    (before) =>
      document
        .querySelector(".process-workspace [data-eda-scene]")
        .getAttribute("viewBox") !== before,
    flowBefore,
  );
  const zoomed = await flowScene.getAttribute("viewBox");
  const background = await flowScene.locator(":scope > rect").boundingBox();
  await page.mouse.move(background.x + 5, background.y + 5);
  await page.mouse.down();
  await page.mouse.move(background.x + 45, background.y + 25);
  await page.mouse.up();
  assert.notEqual(await flowScene.getAttribute("viewBox"), zoomed);
  await page.getByRole("button", { name: "适应流程", exact: true }).click();
  assert.equal(
    await page
      .locator('[data-process-step="ship"][data-selected="true"]')
      .count(),
    1,
  );
  assert.equal(await page.locator(".process-view-tabs button").count(), 2);
  assert.equal(
    await page.locator('[data-edge-kind="process-binding"]').count(),
    0,
  );
  const svgFile = path.join(run, "process.svg");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, svgFile);
  await item("导出 ER 图…");
  await page
    .locator(".desktop-form")
    .getByRole("button", { name: "导出", exact: true })
    .click();
  await page.getByRole("status").filter({ hasText: "图形已导出" }).waitFor();
  const svg = await fs.readFile(svgFile, "utf8");
  assert(svg.includes("data-process-step"));
  assert(!svg.includes('data-edge-kind="process-binding"'));
  assert(!svg.includes("data-eda-cardinality"));
  await page.getByRole("button", { name: "关闭编辑器", exact: true }).click();
  await page
    .getByRole("combobox", { name: "业务场景" })
    .selectOption("returns");
  await ready();
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  assert.equal(await page.locator("[data-process-step]").count(), 8);
  await capture("returns.png");
  await page.getByRole("button", { name: "ER 结构", exact: true }).click();
  await erReady();
  assert.equal(
    await page
      .locator(".process-original-er [data-eda-scene]")
      .getAttribute("viewBox"),
    erView,
  );
  const unchanged = await read();
  assert.deepEqual(unchanged.tables, original.tables);
  assert.deepEqual(unchanged.references, original.references);
  assert.deepEqual(unchanged.processModel, original.processModel);
  assert.equal(
    unchanged.lastModified.getTime(),
    original.lastModified.getTime(),
  );
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  await page
    .getByRole("combobox", { name: "业务场景" })
    .selectOption("fulfillment");
  await ready();
  await page.locator('[data-process-step="create-order"]').click();
  await ready();
  await page
    .locator(
      '.process-binding-detail[data-table-id="orders"] .process-field-links',
    )
    .getByRole("button", { name: "status", exact: true })
    .click();
  await erReady();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-eda-field-details] h3")?.textContent ===
      "status",
  );
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  await page
    .locator('.process-binding-detail[data-table-id="orders"]')
    .getByRole("button", { name: "编辑表", exact: true })
    .click();
  await page.locator('[data-edit-field="status"]').waitFor();
  await page.getByRole("button", { name: "关闭编辑器", exact: true }).click();
  await page.getByRole("button", { name: "流程配置", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "流程定义 JSON" }),
    valid = await editor.inputValue();
  await editor.fill("{broken");
  await page.getByRole("button", { name: "校验并应用", exact: true }).click();
  await page.locator(".process-config [role=alert]").waitFor();
  const changed = JSON.parse(valid);
  changed.scenarios[0].steps.find(
    (step) => step.id === "create-order",
  ).description = "本机流程配置保存验证";
  await editor.fill(JSON.stringify(changed, null, 2));
  await page.getByRole("button", { name: "校验并应用", exact: true }).click();
  await page.getByRole("button", { name: "保存模型", exact: true }).click();
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open("drawDB");
        r.onsuccess = () => {
          const db = r.result,
            q = db.transaction("diagrams").objectStore("diagrams").getAll();
          q.onsuccess = () => {
            db.close();
            resolve(
              q.result
                .find((m) => m.diagramId === "demo-fulfillment")
                ?.processModel?.scenarios[0].steps.find(
                  (s) => s.id === "create-order",
                )?.description === "本机流程配置保存验证",
            );
          };
        };
      }),
  );
  const file = path.join(run, "export.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await item("导出 JSON…");
  await page
    .getByRole("status")
    .filter({ hasText: "已导出" })
    .waitFor()
    .catch(() => {});
  const exported = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(exported.schemaVersion, 2);
  assert.deepEqual(exported.processModel, changed);
  await item("复制当前模型");
  await page.waitForURL((url) => !url.pathname.endsWith("demo-fulfillment"));
  await erReady();
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  assert.equal(await page.locator("[data-process-step]").count(), 9);
  await page
    .getByRole("combobox", { name: "切换模型" })
    .selectOption("demo-fulfillment");
  await page.waitForURL("**/demo-fulfillment");
  await ready();
  await page.addInitScript(() =>
    localStorage.setItem(
      "erwiki.process.reader.v1.demo-fulfillment",
      JSON.stringify({
        mode: "mixed",
        scenarioId: "fulfillment",
        activityId: "ship",
        mixedScope: "all",
        views: {},
      }),
    ),
  );
  await page.reload();
  await ready();
  assert.equal(
    await page
      .locator('[data-process-step="ship"][data-selected="true"]')
      .count(),
    1,
  );
  assert.equal(await page.locator(".process-view-tabs button").count(), 2);
  assert.equal(
    await page
      .getByRole("button", { name: "业务流程", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: "流程配置", exact: true }).click();
  await page.getByRole("textbox", { name: "流程定义 JSON" }).fill(valid);
  await page.getByRole("button", { name: "校验并应用", exact: true }).click();
  await page.getByRole("button", { name: "保存模型", exact: true }).click();
  await ready();
  await page.getByRole("button", { name: "业务流程", exact: true }).click();
  await ready();
  await page.locator('[data-process-step="allocate"]').click();
  await capture("preview.png");
  assert.deepEqual(errors, []);
  const final = await read();
  assert.deepEqual(final.tables, original.tables);
  assert.deepEqual(final.references, original.references);
  await fs.writeFile(
    path.join(root, "work/process-preview-latest.json"),
    JSON.stringify({ run, profile, executable, version, packaged }, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      run,
      packaged,
      checks:
        "wheel/pan, ER/flow only, legacy preference migration, scenario branching/return, independent camera, field links, ER editor, config validation/save, v2 export, clone and reload",
      errors,
    }),
  );
} catch (error) {
  await capture("failure.png").catch(() => {});
  console.error({
    run,
    errors,
    body: (await page.locator("body").innerText()).slice(-4000),
  });
  throw error;
} finally {
  await app.close();
}
if (process.argv.includes("--open"))
  spawn(executable, packaged ? [] : [path.join(root, "desktop/main.cjs")], {
    env,
    detached: true,
    stdio: "ignore",
  }).unref();
