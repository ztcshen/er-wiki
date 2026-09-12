# Local process-view comparison / 本地流程视图对比

Version `0.2.0-preview.5` is a local preview, not a published release.

- **ER structure / ER 结构** retains the existing table/field editor, full-model
  overview, relationship cardinality, grouping and EDA routing.
- **Process flow / 业务流程** shows explicit activities, decisions, events and
  conditional/return paths. Selecting an ER table chooses a related activity;
  mapped fields navigate back to their actual ER table and field.
- **Mixed comparison / 混合对比** places activity nodes, data-access arrows and
  real ER tables/relationships in one ELK-routed diagram. Choose Activity and
  neighbors or Whole scenario to compare focus against context.

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
Diagram exports in process/mixed mode contain the current view.

This comparison does not provide a full BPMN editor, runtime simulation or a
workflow engine. Business models in the separate local business app were not
migrated, uploaded or assigned invented processes.

Focused checks: `npm test`, plus `scripts/smoke-process.mjs --packaged` using an
available Playwright runtime via `ER_WIKI_PLAYWRIGHT_MODULE`. No old canvas suite
or real business data is used by these checks.
