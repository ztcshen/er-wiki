import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { arrangeSchematic } from "../desktop/eda/layout.mjs";
import { integrateDesktop } from "../desktop/integrate.mjs";
import { createUiLocalizer } from "../scripts/localize-ui.mjs";
import { rendererAliases } from "../desktop/build/aliases.mjs";
import { modulePath } from "../desktop/build/paths.mjs";
import { landingHTML } from './landing.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(here),
  desktop = path.join(root, "desktop"),
  source = path.join(root, "work/drawdb");
execFileSync(
  process.execPath,
  [path.join(root, "scripts/prepare-renderer.mjs")],
  { cwd: root, stdio: "inherit" },
);
const require = createRequire(path.join(source, "package.json"));
const { build } = await import(pathToFileURL(require.resolve("vite")));
const { default: react } = await import(
  pathToFileURL(require.resolve("@vitejs/plugin-react"))
);
const example = JSON.parse(
  fs.readFileSync(path.join(root, "examples/fulfillment.drawdb.json"), "utf8"),
);
const model = {
  tables: example.tables,
  relationships: example.relationships,
  groups: example.reviewGroups,
};
const generated = path.join(here, "generated");
fs.mkdirSync(generated, { recursive: true });
const locations = [
  ["overview", { level: "overview", labels: "off" }],
  ...model.groups.map((group) => [
    "domain:" + group.id,
    { level: "domain", domainId: group.id, labels: "auto" },
  ]),
  ...model.tables.map((table) => [
    "table:" + table.id,
    { level: "column", tableId: table.id, labels: "auto" },
  ]),
];
const scopes = {};
const artifacts = [];
for (const [key, options] of locations) {
  const result = await arrangeSchematic(model, options);
  const json = JSON.stringify(result),
    hash = createHash("sha256").update(json).digest("hex").slice(0, 16),
    filename = "diagram-" + hash + ".json";
  fs.writeFileSync(path.join(generated, filename), json);
  artifacts.push(filename);
  scopes[key] = {
    file: filename,
    tableCount: result.projection.nodes.filter((node) => node.kind === "table")
      .length,
  };
}
const catalogue = {
  model,
  scopes,
  version: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
    .version,
};
fs.writeFileSync(
  path.join(generated, "catalogue.json"),
  JSON.stringify(catalogue),
);
const locale = path.join(here, "locale.jsx");
const integrate = integrateDesktop(desktop),
  localize = createUiLocalizer(root, { runtime: locale });
await build({
  root: here,
  base: "./",
  publicDir: false,
  configFile: false,
  plugins: [
    {
      name: "er-wiki-demo",
      enforce: "pre",
      resolveId(id, importer) {
        if (
          importer &&
          id.startsWith(".") &&
          modulePath(path.resolve(path.dirname(importer), id)).replace(
            /\.(jsx|js)$/,
            "",
          ) === modulePath(path.join(desktop, "i18n/renderer"))
        )
          return locale;
      },
      transform(code, id) {
        return localize(
          id.endsWith("/utils/fieldPresentation.js")
            ? integrate(code, id) || code
            : code,
          id,
        );
      },
    },
    react(),
  ],
  resolve: { alias: rendererAliases(desktop, source) },
  build: {
    outDir: path.join(here, "dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
for (const file of artifacts)
  fs.copyFileSync(path.join(generated, file), path.join(here, "dist", file));
fs.renameSync(path.join(here,'dist/index.html'),path.join(here,'dist/demo.html'));
fs.writeFileSync(path.join(here,'dist/index.html'),landingHTML('en'));
fs.writeFileSync(path.join(here,'dist/zh.html'),landingHTML('zh'));
fs.writeFileSync(path.join(here,'dist/social.html'),landingHTML('en').replace('<body>','<body class="social-card">'));
fs.copyFileSync(path.join(here,'landing.css'),path.join(here,'dist/landing.css'));
for (const [from, to] of [
  ["LICENSE", "LICENSE.txt"],
  ["NOTICE", "NOTICE.txt"],
  ["docs/images/routing-preview.png", "routing-preview.png"],
  ["docs/images/social-preview.png", "social-preview.png"],
  ["desktop/assets/icon.svg", "icon.svg"],
])
  fs.copyFileSync(path.join(root, from), path.join(here, "dist", to));
fs.writeFileSync(path.join(here, "dist", ".nojekyll"), "");
fs.writeFileSync(
  path.join(here, "dist", "THIRD_PARTY.txt"),
  fs.readFileSync(path.join(root, "NOTICE"), "utf8") +
    "\n\nReact\n" +
    fs.readFileSync(path.join(source, "node_modules/react/LICENSE"), "utf8") +
    "\n\nReact DOM\n" +
    fs.readFileSync(
      path.join(source, "node_modules/react-dom/LICENSE"),
      "utf8",
    ),
);
fs.writeFileSync(
  path.join(here, "dist", "build-info.json"),
  JSON.stringify({
    version: catalogue.version,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    tables: model.tables.length,
    relationships: model.relationships.length,
    scopes: Object.keys(scopes).length,
  }),
);
console.log(
  "Read-only demo built: " +
    model.tables.length +
    " fictional tables, " +
    locations.length +
    " precomputed scopes. No desktop IPC or editor loaded.",
);
