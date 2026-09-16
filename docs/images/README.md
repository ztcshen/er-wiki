# Desktop demo snapshots

## Current website assets (0.4.1 candidate)

`routing-preview.png` is an unmodified 1440×900 screenshot of the current
read-only Web demo, using the canonical fictional fulfillment model (13 tables,
19 relationships). Unlike the older images below, it is not a desktop screenshot.
`social-preview.png` is a 1200×630 browser capture of the compact `social.html`
sharing layout, composed from that actual renderer image and the product headline.
It is also the prepared GitHub social-preview asset; repository settings are not
changed by adding this file. Refresh with `site/smoke.mjs` and
`site/smoke-landing.mjs`, inspect the outputs, then copy the corresponding captures.

## Historical desktop captures

The fulfillment PNGs are unmodified screenshots of the packaged ER Wiki Community
desktop app. They show the all-table overview, ER field workspace, domain drilldown,
relationship tracing, orders table editor and quick search in English and Chinese,
plus the dark ER workspace. The SVG is exported using that same app's Export ER diagram
action, not drawn by a second script.

`fulfillment-snapshot.json` records the application version, renderer-source hash,
example JSON hash, counts, capture time and viewport sizes. The capture verifies
all tables, fields, groups and relationships against the canonical demo before
and after the screenshots, without modifying model content or its save time.

## Refresh

1. Build the current packaged desktop app with `npm run package`.
2. Provide an existing Playwright runtime via `ER_WIKI_PLAYWRIGHT_MODULE` if it is
   not available as a local package. No web browser is launched.
3. Run `node scripts/capture-demo.mjs`. Use `--open` to leave the demo workspace open
   after capture. `ER_WIKI_SNAPSHOT_EXECUTABLE` can select a specific packaged app.
4. Inspect the resulting PNGs and SVG before committing them.

The script creates a fresh persistent profile under ignored `work/demo-snapshots/`.
It never opens or overwrites a normal user profile. `latest.json` in that directory
records the local profile location; that file is not published. In particular,
never substitute screenshots of real business models into these documentation files.

`npm run demo` generates schema JSON and DDL only. It intentionally does not touch
screenshots or the application-exported SVG.
