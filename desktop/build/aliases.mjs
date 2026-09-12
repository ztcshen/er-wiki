import path from "node:path";
import { modulePath } from "./paths.mjs";

// All renderer integration with the pinned upstream checkout is declared here.
// React, its router and UI dependencies must resolve to one shared instance.
export function rendererAliases(desktop, source) {
  const aliases = {
    "@drawdb": path.join(source, "src"),
    "er-wiki-locale-provider": path.join(desktop, "i18n/LocaleBridge.jsx"),
    "er-wiki-locale": path.join(desktop, "i18n/renderer.js"),
  };
  for (const name of [
    "react",
    "react-dom",
    "react-i18next",
    "react-router-dom",
    "node-sql-parser",
    "@douyinfe/semi-ui",
  ])
    aliases[name] = path.join(source, "node_modules", name);
  return Object.fromEntries(
    Object.entries(aliases).map(([name, value]) => [name, modulePath(value)]),
  );
}
