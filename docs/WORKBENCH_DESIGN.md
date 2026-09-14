# Workbench UI and module boundaries

## References inspected

The following public source files were inspected on 2026-09-12. They informed
interaction and module boundaries, not a wholesale copy of their UI or backend.

| Project and inspected source | Applied here |
|---|---|
| [ChartDB command component](https://github.com/chartdb/chartdb/blob/c24936a402bb3e24b4858f05282d69a04fcfe25b/src/components/command/command.tsx) and [focus hook](https://github.com/chartdb/chartdb/blob/c24936a402bb3e24b4858f05282d69a04fcfe25b/src/hooks/use-focus-on.ts) | Use the mature MIT-licensed `cmdk` keyboard interaction primitive; keep focus/viewport operations separate from table edits. |
| [Beekeeper Studio QuickSearch](https://github.com/beekeeper-studio/beekeeper-studio/blob/ed9671bc2e5c5998e97cfd8c3901269def6ddbc7/apps/studio/src/components/quicksearch/QuickSearch.vue) | Quick table lookup with explicit selection and Enter to open. Empty search starts with tables; results stay scoped to the current model. |
| [DbGate menu definitions](https://github.com/dbgate/dbgate/blob/281d1a4c11284f389d565c6b04b85f00bd7538bc/app/src/mainMenuDefinition.js) and [app structure](https://github.com/dbgate/dbgate/tree/281d1a4c11284f389d565c6b04b85f00bd7538bc/app/src) | Represent actions with stable command IDs; separate native menu definitions from handlers and runtime bootstrapping. |

This project retains Electron, React, Semi UI and ELK. It does not introduce a
database driver layer, a web service, cloud synchronization or a second canvas.
User-supplied names and descriptions are rendered as React text, not raw HTML.

## UI decisions

- The header separates model identity from the **Quick search / ⌘K** entry and
  save/history controls. The More menu contains common grouped actions; All actions
  opens the complete catalogue using the `>` command-only prefix.
- The menu and palette use one command catalogue. Disabled/read-only behavior is
  computed once; there is no duplicate list of anonymous menu callbacks.
- The directory has independent domain folding. A collapsed directory group never
  hides its tables from the ER model or changes model save time.
- Search matches names, aliases, comments and enum meanings, including qualified
  `table.field` and multi-word queries. Selecting a field in Quick search opens its
  related-table view and focuses the real table bounds.
- The inspector offers an explicit **Focus in diagram** action. Camera movement is
  separate from scope changes; the all-table overview remains available. Focus
  does not inflate small cards above 100% reading size.
- A small optional SVG minimap reuses the computed ELK node positions. Pointer
  zoom accounts for SVG letterboxing and keeps the pointed world location stable.
  Navigation controls remain outside the exported diagram. Desktop detail panels
  reserve space down to 980px instead of covering the navigation controls.
- Auto direction compares the same four orthogonal candidates; an explicit
  horizontal or vertical choice compares two seeds in that direction. The scoring
  order is unchanged. Direction is a per-model reading preference, not model data;
  default scope keys remain byte-compatible with previously saved camera positions.
- Existing three-column cards, orthogonal routing, Bus/Hub/Net Labels, model editing,
  import/export and backup capabilities are retained.
- Conditional references described by `reviewEvidence.condition = { field, value }`
  have their own nets, field ports and labeled direct paths when both tables are
  visible. They do not merge into ordinary PK buses or disappear behind long-line
  labels; a domain view still uses boundary labels for genuinely out-of-scope tables.
  The predicate is review metadata, never executable SQL/JS or a physical FK.
  Predicate labels reuse ELK edge-label placement and the referencing group's color.
  Hover captions and relation details also show the condition.
- A table may carry `reviewPlacement: { belowTableId, leftOfTableId, gap, offsetX }`
  for a human-chosen overview region. After the initial layout, ELK interactive
  layering consumes pseudo positions and reroutes every edge. Only candidates
  satisfying the relative region and avoiding node overlaps are accepted. This
  follows [ELK's interactive layout guidance](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html);
  it is not an absolute pixel pin or a change to relationship direction. Hints do
  not hide tables and are ignored in drill-down views. Without hints, the existing
  layout path and scoring order remain unchanged.

## Structure

```text
desktop/
  main.cjs                  startup, window lifetime, composition
  preload.cjs               fixed sandbox-safe capabilities
  native/
    command-bridge.cjs      native request/reply correlation and cancellation
    ipc.cjs                 capability registration and sender checks
    dialogs.cjs             dialog serialization and native localization
    menu.cjs                operating-system menu
    session.cjs             protocol, CSP and permission policy
  renderer/
    command-catalogue.mjs   stable action metadata and availability
    CommandPalette.jsx     cmdk-based keyboard lookup
    DesktopHeader.jsx      compact grouped menu and header
    commands.js            fixed renderer event adapters
  eda/
    EdaWorkspace.jsx       compose scope, selection and panels
    EdaToolbar.jsx         reading controls
    EdaDirectory.jsx       domain tree and search results
    EdaInspector.jsx       table/field/relation details
    EdaMinimap.jsx         navigate the existing layout, without a second layout engine
    useSchematicLayout.js  React layout lifecycle
    layout-task.mjs        shared worker deadline/cancellation
    camera.mjs             pure focus, pointer zoom and SVG coordinate geometry
  build/
    aliases.mjs            one upstream/React dependency boundary
    paths.mjs              platform-neutral path normalization
```

Native services such as backups and atomic file writes remain independently
testable. IPC checks still verify the current window and main frame before an
action. The preload does not gain a generic channel, shell or filesystem API.

All renderer imports into the pinned drawDB checkout use `@drawdb/*`. The build
declares that alias and the shared React/router/UI instances in one place.
Generated-source adaptation remains confined to `desktop/integrate.mjs` and
`scripts/localize-ui.mjs`; components do not edit upstream files at runtime.
Build paths and package-source exclusions normalize Windows separators, but this
does not constitute Windows runtime or installer validation.

## Verification boundary

Node checks cover the command catalogue, frame validation across every preload
invoke channel, native command timeouts, worker cancellation, directory-state
compatibility, focus geometry and cross-platform path handling. Focused Electron
checks cover actual keyboard lookup and folding as well as the established
model/save/restore/export workflow. Duplication checks include the original entry
and workspace files after extraction, alongside the new modules.

Screenshots must still come from the actual packaged app using
`scripts/capture-demo.mjs`; a structural refactor is not permission to substitute
a diagram mockup or publish private models. Remote CI and PR state must be checked
against the latest pushed head, not the original checkpoint.
