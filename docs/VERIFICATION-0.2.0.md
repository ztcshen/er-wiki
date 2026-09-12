# v0.2.0 verification

Recorded 2026-09-12. Runtime implementation checkpoint: `b2cf209`.
Only the fictional 13-table / 19-relation fulfillment model was used.

- 49 deterministic Node tests passed, including semantic summary boundaries,
  title wrapping, relationship direction/color and previous persistence/security checks.
- Real Electron ER checks passed: 13-table coverage, summary/detail preference,
  unchanged layout geometry on presentation changes, summary-click focus,
  field filtering, display names, selected field and individual relationship tracing.
- Existing desktop checks passed: cursor zoom, minimap, direction/reload,
  languages/native menus, model switching, centered editing and stable text-edit geometry,
  local backup restore, SQL import, offline Monaco and SVG/PNG export.
- The packaged v0.2.0 process companion passed its focused check: ER/flow switching,
  independent reading position, field mapping, table editor, config validation/save,
  JSON v2 export, copy/reload and legacy mixed-preference migration.
- Desktop layouts were checked at 1440px and 980px widths. This is a desktop app;
  no mobile/browser release or acceptance is claimed.
- Packaged screenshots verify the runtime source hashes and the original tables,
  fields, groups, relationships and save timestamp before/after capture.
  See `images/fulfillment-snapshot.json` for provenance.
- jscpd 5.2.0 scanned the original EdaScene/EdaInspector/EdaWorkspace and extracted
  presentation components at 6 lines / 80 tokens: no clones detected.
- Local targeted source and built-renderer publication scans found no matches.
  This is not a claim that a pattern scan proves absence of every private fact.

GitHub CI and release workflow results are separate live records. The macOS
artifact is ad-hoc signed, not Developer ID signed/notarized. Windows/Linux are
not release-validated. No production workflow, database write or business-row
sample was part of these checks.
