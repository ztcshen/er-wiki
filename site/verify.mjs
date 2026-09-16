import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { validateLayout } from "../desktop/eda/metrics.mjs";
const here = path.dirname(fileURLToPath(import.meta.url)),
  dist = path.join(here, "dist");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(here, "generated/catalogue.json"), "utf8"),
);
const example = JSON.parse(
  fs.readFileSync(
    path.join(here, "../examples/fulfillment.drawdb.json"),
    "utf8",
  ),
);
assert.deepEqual(catalogue.model.tables, example.tables);
assert.deepEqual(catalogue.model.relationships, example.relationships);
assert.equal(Object.keys(catalogue.scopes).length, 18);
for (const [key, value] of Object.entries(catalogue.scopes)) {
  const result = JSON.parse(
    fs.readFileSync(path.join(dist, value.file), "utf8"),
  );
  validateLayout(result.layout, result.projection);
  if (key === "overview")
    assert.equal(
      result.projection.nodes.filter((n) => n.kind === "table").length,
      13,
    );
}
const js = fs
  .readdirSync(path.join(dist, "assets"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(dist, "assets", name), "utf8"))
  .join("\n");
for (const forbidden of [
  "window.erDesktop",
  "indexedDB",
  "@douyinfe/semi-ui",
  "monaco-editor",
  "@vercel/analytics",
])
  assert(
    !js.includes(forbidden),
    forbidden + " must not be shipped in the read-only demo",
  );
assert(js.length < 500000, "Avoid pulling the desktop editor into the demo");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
assert(html.includes("Content-Security-Policy"));
assert(!html.includes("unsafe-eval"));
assert(!/https?:\/\/[^"]+\.js/.test(html), "No remote script dependency");
for (const file of ['index.html','zh.html']) {
  const page=fs.readFileSync(path.join(dist,file),'utf8');
  assert.equal((page.match(/<h1>/g)||[]).length,1);
  assert(page.includes('demo.html')&&page.includes('og:image')&&page.includes('rel="canonical"'));
  assert(!page.includes('<script'), 'Landing must work without JavaScript');
  assert(page.includes('orthogonal')||page.includes('正交'));
  assert(page.includes('13')&&page.includes('19'),'Show actual demo size');
}
assert(fs.existsSync(path.join(dist,'demo.html')));
console.log(
  "Static demo verified: 18 orthogonal scopes, 13 fictional tables, no desktop IPC/database/editor/analytics, local assets only.",
);
