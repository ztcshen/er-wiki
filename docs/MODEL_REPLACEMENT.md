# Complete model replacement

Use **More → Replace current model…** (also in File and the command palette).
Select a complete ER Wiki/drawDB JSON file, review the table/relation/group counts,
then confirm. Import JSON remains a separate action that creates a copy.

Replacement preserves the current database record ID and model ID. It replaces
the complete document, including tables, relationships, groups, types, notes and
process definitions. Omitted optional collections become empty. It does not merge
old tables or groups into the supplied document and does not restart the app or reload
the browser page. The EDA scene reacts to the new model and returns to overview.

The file is validated before a write. The existing backup facility preserves the
current content, including unsaved edits. A transaction rejects a changed target
or a failed write before any new content is applied to the editor. Old editing
undo/redo stacks are cleared because their object IDs may no longer exist; use
the existing backup restore action to recover the earlier document. Subsequent
edits retain normal undo/redo. This does not add model versions or review history.

## Local Agent entry

A local caller explicitly supplies a file and the ID of the **currently open**
model. The ID is the last part of the editor route. For the fixed macOS install:

```sh
"/path/to/ER Wiki.app/Contents/MacOS/ER Wiki Community" \
  --replace-model "/absolute/path/model.drawdb.json" --model-id "current-model-id"
```

When running, the app handles this via Electron's single-instance handoff; when
starting, it waits for the workspace. A different open model, invalid document,
read-only state, or unavailable workspace fails rather than switching or creating
a copy. This explicit command performs replacement without another confirmation
dialog; the Agent must already have the user's authorization to replace that model.

No HTTP service, debugging port or generic script execution is added. Input files
are limited to 20 MB. `model-replacement-result.json` in the app data directory
contains only the latest operation's target ID, content SHA256 and result. `ok: null`
means pending; `ok: true` means committed and applied. A launcher exit code alone is
not proof of replacement. This receipt is not a model revision log.

## Focused verification

`npm test` covers identity retention, stale/write-failure rejection, CLI arguments
and handoff. `scripts/smoke-replacement.mjs` uses an isolated fictional workspace to
verify validation, failure preservation, picker confirmation/cancellation, native
handoff, same process/window/renderer, model count, live EDA refresh and persistence.
Set `ER_WIKI_TEST_APP` to test a packaged executable. `ER_WIKI_PACKAGE_OUT` can direct
packaging to a temporary directory before updating the one fixed application entry.
