# Unreleased — ER review and compact four-sided diagrams

- Directly edit field length and numeric precision, enum values, relationship endpoints and composite field mappings.
- Live structural checks and simpler contextual navigation; no review baselines or audit-history workflow.
- Replace a complete model in the running desktop workspace, retaining its model ID and reading other models independently.
- Explicit conditional relationships with visible predicates and field-grouped cardinality badges.
- Relative table placement, adaptive field ports on all four sides, libavoid obstacle routing and ELK SPOrE compaction.
- Candidate scoring retains original layouts as fallbacks and checks crossings, overlaps, labels, route length and occupancy.
- Minimap placement avoids occupied corners in the fitted overview. Fields and relationship semantics do not change during arrangement.

Position refinement is bounded (up to 80 projected nodes, four search rounds and
a six-second budget); layout remains heuristic. The libavoid-js WASM wrapper is
pinned to a beta release and runs locally. Public examples contain fictional
fulfillment data only. These notes describe source changes, not a newly published
binary release; published downloads remain on the Releases page.

# v0.2.0 — ER-first desktop workbench

## ER reading and editing

- Readable, zoom-aware table summaries in the full-model overview; zoom in for field rows.
- Keep every table and original relationship in the overview. No schema edits or rerouting on zoom.
- Click a summary to focus the table at reading scale without discarding the global scope.
- Compact two-row workbench: the process scenario/configuration bar only appears in process view.
- Searchable table field inspector with display names, types, primary keys and enum indicators.
- Jump from inspector fields to their ER location, and from related tables to an individual relationship.
- Consistent domain colors within groups and neutral cross-domain wires; selected paths and endpoint tables stand out.
- Existing 1/N cardinality, Bus/Hub, Net Labels, centered editors, search, bookmarks and minimap remain available.
- Field hover text includes explicitly configured enum values.

## Optional process context

- Keep ER and process views separate. Mixed comparison mode has been removed.
- Explicit activity-to-table/field mappings can navigate back to ER or open the existing table editor.
- Old mixed-view preferences migrate to process view without deleting model data.
- Model JSON v2 preserves process definitions; older JSON remains importable.
- Process configuration uses JSON and is not part of ER undo history. This is not a BPMN editor or execution engine.

## Real product screenshots

Updated bilingual screenshots of the packaged Electron app show the overview,
domain drilldown, table/field inspector, relationship tracing, editing, search
and dark mode. All screenshots and bundled examples use the fictional fulfillment
model only. No private business models or application profiles are distributed.

## Downloads and limitations

This release provides a macOS Apple Silicon (ARM64) ZIP, corresponding project
source, pinned drawDB source and SHA256 checksums. macOS packages are ad-hoc signed,
not Apple Developer ID signed or notarized. Follow your device's security policy;
do not disable system security protections to install the app.

Windows/Linux binaries are not release-validated. Model cardinality is not a live
row count or proof of a physical database constraint. Layout remains heuristic.
Close the old application before replacing it; models are kept separately in the
ER Wiki Community application-data directory. Export important models before upgrading.
