import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(
  process.env.ER_WIKI_PLAYWRIGHT_MODULE || "playwright"
);
const external = process.env.ER_WIKI_DEMO_URL;
const server = external ? null : await serve();
const target =
  external || "http://127.0.0.1:" + server.address().port + "/er-wiki/";
const output = await fs.mkdtemp(path.join(root, "work/static-demo-"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.ER_WIKI_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.ER_WIKI_CHROMIUM_EXECUTABLE }
    : {}),
});
const errors = [],
  outside = [],
  screens = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(target).origin)
      outside.push(request.url());
  });
  const ready = () =>
    page.locator('[data-demo-ready="true"]').waitFor({ timeout: 30000 });
  const capture = async (name) => {
    await page.mouse.move(15, 15);
    await page.screenshot({
      path: path.join(output, name),
      animations: "disabled",
    });
    screens.push(name);
  };
  await page.goto(target);
  await ready();
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 13);
  assert.equal(await page.locator("[data-eda-summary]").count(), 13);
  assert.equal(await page.evaluate(() => typeof window.erDesktop), "undefined");
  assert.equal(
    await page
      .getByRole("button", { name: /^(Save|Edit table|Import|保存|编辑表)$/ })
      .count(),
    0,
  );
  assert(
    (
      await page
        .getByRole("link", { name: "Download desktop ↗" })
        .getAttribute("href")
    ).endsWith("/releases/latest"),
  );
  await capture("desktop-overview.png");
  await page
    .getByRole("searchbox", { name: "Search model" })
    .fill("orders.status");
  await page.locator(".demo-search-result").click();
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
  assert(
    (await page.locator(".eda-enum-values").innerText()).includes("CONFIRMED"),
  );
  assert.equal(
    await page.getByRole("button", { name: "Edit table", exact: true }).count(),
    0,
  );
  await capture("desktop-field.png");
  assert.equal(
    await page.locator(".eda-table-details, .eda-member-list").count(),
    0,
  );
  await page
    .locator(".eda-inspector")
    .getByRole("button", { name: "orders", exact: true })
    .click();
  await page.getByRole("tab", { name: /^Related tables/ }).click();
  const related = page
    .locator("[data-related-relation]")
    .filter({ hasText: "order_items" });
  await related.click();
  assert.equal(
    await page.locator('[data-net-member][data-selected="true"]').count(),
    1,
  );
  assert(
    (await page.locator('[data-eda-wire][data-highlight="true"]').count()) > 0,
  );
  await page
    .getByRole("button", { name: "Focus relationship", exact: true })
    .click();
  await capture("desktop-relation.png");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await ready();
  await page
    .getByRole("combobox", { name: "Domains" })
    .selectOption({ label: "分仓履约与发货" });
  await ready();
  assert.equal(await page.locator('[data-node-kind="table"]').count(), 4);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await ready();
  await page.getByRole("button", { name: "Actual size (100%)" }).click();
  const svg = page.locator("[data-eda-scene]"),
    before = await svg.getAttribute("viewBox"),
    box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -150);
  await page.waitForFunction(
    (value) =>
      document.querySelector("[data-eda-scene]").getAttribute("viewBox") !==
      value,
    before,
  );
  await page
    .getByRole("combobox", { name: "Interface language" })
    .selectOption("zh");
  await page.getByRole("button", { name: "切换主题" }).click();
  await page.getByRole("button", { name: "总图", exact: true }).click();
  await ready();
  await capture("desktop-dark-zh.png");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual((await context.storageState()).cookies, []);
  assert.deepEqual(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
    { local: 0, session: 0 },
  );
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.setDefaultTimeout(12000);
  phone.on("pageerror", (e) => errors.push(e.message));
  phone.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await phone.goto(target);
  await phone.locator('[data-demo-ready="true"]').waitFor({ timeout: 30000 });
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await phone.getByRole("button", { name: "Directory", exact: true }).click();
  await phone
    .getByRole("searchbox", { name: "Search model" })
    .fill("orders.status");
  await phone.locator(".demo-search-result").click();
  await phone.waitForFunction(
    () =>
      document.querySelector("[data-eda-field-details] h3")?.textContent ===
      "status",
  );
  await phone.screenshot({
    path: path.join(output, "mobile-field.png"),
    animations: "disabled",
  });
  screens.push("mobile-field.png");
  await phone
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await phone
    .getByRole("button", { name: "Fit to window", exact: true })
    .click();
  const controls = await phone.locator(".eda-canvas-controls").boundingBox();
  const minimap = await phone.locator(".eda-minimap").boundingBox();
  assert(
    minimap.x + minimap.width < controls.x,
    "Mobile minimap overlaps zoom controls",
  );
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await phone
      .getByRole("button", { name: "Edit table", exact: true })
      .count(),
    0,
  );
  await phone.screenshot({
    path: path.join(output, "mobile-diagram.png"),
    animations: "disabled",
  });
  screens.push("mobile-diagram.png");
  assert.deepEqual(errors, []);
  assert.deepEqual(outside, []);
  console.log(
    JSON.stringify({
      passed: true,
      target,
      output,
      screens,
      checks:
        "desktop/mobile, no external requests/storage/IPC, all tables/domain, field search/enums, relation tracing, zoom, languages and dark mode",
    }),
  );
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({ path: path.join(output, "failure.png") })
        .catch(() => {});
      console.error(
        (
          await page
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(0, 1600),
      );
    }
  console.error({ output, errors, outside });
  throw error;
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
