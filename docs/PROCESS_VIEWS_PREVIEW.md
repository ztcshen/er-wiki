# ER and process views / ER 与业务流程

Version `0.2.0-preview.6` is a local preview, not a published release.

- **ER structure / ER 结构** retains the existing table/field editor, full-model
  overview, relationship cardinality, grouping and EDA routing.
- **Process flow / 业务流程** shows explicit activities, decisions, events and
  conditional/return paths. Selecting an ER table chooses a related activity;
  mapped fields navigate back to their actual ER table and field.

The fictional fulfillment example includes Fulfillment and Returns scenarios.
These definitions are manually authored illustrations, not mined event logs or
assertions about a real system. The app does not execute activities, conditions,
state transitions or database writes against a business system.

`processModel` belongs to the same model document as its ER tables, and survives
save, JSON export/import and duplication. New exports use model schema version 2
so older community versions cannot silently discard process metadata. Legacy
documents remain importable. View choice, selection and camera positions are
separate per-model reading preferences and do not change model save time.

Use **Process configuration / 流程配置** to edit the explicit JSON definition.
Applying configuration participates in model save/autosave, but this preview does
not add process-config edits to the ER undo stack. Table edits retain existing
undo behavior. Missing mapped tables/fields are reported, not silently removed.
Process diagrams contain only activities and control flow. Table/field mappings
stay in the activity details panel: click to inspect them in ER or open the
existing table editor. Process SVG/PNG exports contain the current process view.

Older local previews' mixed-view preferences automatically fall back to Process
flow. Scenario/activity selection and old process-view camera positions survive;
obsolete mixed-view coordinates are discarded. The model and process definition
are unchanged. Mixed nodes, data-access edges, layout options and UI have been
removed rather than hidden behind a feature flag.

This preview does not provide a full BPMN editor, runtime simulation or a
workflow engine. Business models in the separate local business app were not
migrated, uploaded or assigned invented processes.

Focused checks: `npm test`, plus `scripts/smoke-process.mjs --packaged` using an
available Playwright runtime via `ER_WIKI_PLAYWRIGHT_MODULE`. No old canvas suite
or real business data is used by these checks.
