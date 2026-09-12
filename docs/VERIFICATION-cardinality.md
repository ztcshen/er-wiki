# Cardinality verification

Runtime checkpoint: `9714af1`, version `0.2.0-preview.4`. Recorded 2026-09-12.
This is local verification evidence; the PR, CI and Release pages record remote status.

- 38 Node tests passed, with none skipped. Cardinality cases cover original endpoint
  direction in horizontal/vertical layouts, mixed shared ports, relationship counts
  versus multiplicity, self references, composite/hidden ports, Net Label member
  identity and full-label focus bounds. Annotation edits preserve routed geometry.
- Focused packaged-Electron checks verified ordinary wires, buses and Net Labels,
  selection of a single relationship, the display toggle and SVG annotations.
  Tables, relationships and model save time remained unchanged; no page errors occurred.
- The release-document capture was rerun at 1440×900 in an isolated profile. Ten
  English/Chinese screenshots came from the actual packaged application, including
  both cardinality views. Capture asserted the selected relation ID and highlighted
  wire membership, rather than relying only on screenshots.
- Capture compared every packaged runtime-source digest against the checkout and
  every example table, field, relation and group against the canonical JSON. It
  retained all 13 tables / 19 relationships and an unchanged model save timestamp.
- SVG export includes 1 / N annotations and excludes the toolbar and minimap.
  [Snapshot provenance](images/fulfillment-snapshot.json) records the input and source hashes.

The community release contains no private business models, configurations or app
profiles. No old canvas regression suite or business-database queries were run.
macOS ARM64 is the verified local platform; Windows/Linux, exhaustive regression
coverage and Apple Developer ID notarization remain outside this preview's evidence.
