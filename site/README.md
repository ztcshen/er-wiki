# Read-only ER demo

Live URL: <https://ztcshen.github.io/er-wiki/>

This is a small demonstration entry point, not a second editing product. It uses
the existing EdaScene, TableContent, CardinalityLayer, EdaInspector, TableDetails,
DiagramViewport and EdaMinimap. The inspector's readOnly option removes edit
controls; its default remains editable in the desktop app.

- Fixed fictional fulfillment example: 13 tables, 19 relationships, 4 domains.
- Pan/zoom, minimap, table/field/alias/enum search, domain drilldown and relation tracing.
- English/Chinese interface and light/dark appearance; model content is not translated.
- Responsive directory and detail panels on phones.
- No login, database connection, editing, uploads, import/export, model persistence,
  cloud synchronization or process view. Language/theme/read positions are session
  memory only, not cookies or browser storage.
- Desktop download and GitHub source links are ordinary external navigation.

## Build and preview

After the repository's normal setup:

```sh
npm run build:demo
node site/verify.mjs
node site/serve.mjs
```

Open `http://127.0.0.1:8769/er-wiki/`. The server is a local read-only static preview.
The deployable output is **site/dist only**, never the repository root, desktop
bundle, work directory or a user's application-data folder.

The build runs the same ELK layout code ahead of time for 18 fixed scopes: all
tables, four domains and thirteen full-field/table-neighborhood views. Hashed
layout JSON is fetched from the same site as needed. No ELK worker or full drawDB
editor is sent to visitors. Desktop localization is replaced at build time with
a lightweight in-memory locale module; no Electron bridge is present.

`node site/smoke.mjs` uses an existing Playwright Chromium runtime. Supply
`ER_WIKI_PLAYWRIGHT_MODULE` when it is outside this repository; optionally set
`ER_WIKI_CHROMIUM_EXECUTABLE` to an existing compatible browser. Set
`ER_WIKI_DEMO_URL` to check the deployed page instead of the local static server.
The check covers desktop/mobile, browsing, no edits, languages/themes and requests/storage.

## Deployment

GitHub Pages uses the Actions publishing source. The pinned Pages workflow builds,
checks and uploads only site/dist, then deploys from main to the github-pages
environment. PR CI builds and scans the same demo without deploying.

The page ships local scripts/styles, a CSP without unsafe-eval, the project
license/notice and no third-party analytics. Full corresponding source is in this
public repository. This is an interactive fictional schema, not a database export
service; never substitute private examples into its build inputs.
