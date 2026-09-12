# Diagram navigation verification

Runtime code checkpoint: `14c824b`, version `0.2.0-preview.3`.
Recorded 2026-09-12. This record is local evidence; consult the PR and Release
pages for the current published status.

- 32 Node tests passed, none skipped. New cases cover cursor anchoring with SVG
  letterboxing, navigation bounds, 100% reading size, the focus scale cap,
  backward-compatible AUTO view keys, bookmark direction and both ELK orientations.
- Focused real-Electron navigation checks passed at 1440px and 980px: pointer
  zoom, minimap click/drag and keyboard movement, fit/100%, direction persistence
  across reload, and unobstructed navigation controls beside the inspector.
- All 13 fictional tables remain in the overview. Navigation preserved every
  table, relationship and the model's save timestamp. The real native navigation
  guard also blocked external destinations in the focused run.
- The macOS ARM64 package built and passed ad-hoc codesign verification.
  Eight English/Chinese screenshots were captured from that packaged application,
  not a separate diagram renderer. Capture verified runtime-source hashes against
  the checkout and all 13 tables / 19 relations / groups against the canonical demo.
- Pure SVG export excluded both the toolbar and minimap. Snapshot provenance is
  recorded in [fulfillment-snapshot.json](images/fulfillment-snapshot.json).
- The publication guard and renderer secret scan passed. jscpd 5.2.0 scanned 46
  files including the existing entry/workspace components and new navigation code
  at 6 lines / 80 tokens; no clones were found.

The test runner accepts `scripts/smoke-desktop.mjs --navigation-only` to check this
iteration without repeating backup, SQL-import or old canvas scenarios. No real
business model was used. This is not exhaustive regression acceptance, independent
security review, Windows/Linux runtime validation or Apple Developer ID notarization.
