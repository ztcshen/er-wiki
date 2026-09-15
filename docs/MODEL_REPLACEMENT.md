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

Each attempted replacement receives a generated `requestId` before argument or
file validation. The receipt includes `operation: "replace-model"`, `status`
(`pending`, `succeeded`, `failed`), `errorCode`, `message`, and structured
`errors: [{code, path, message}]` when available. Failed file reads can have a null
`sha256`; failed argument parsing can have a null `targetId`. A newer request's
receipt is not overwritten by an older request finishing late. Callers must
observe a new matching request identity rather than accept an earlier success.
Only one replacement may execute at a time. `layoutStatus: "not_observed"` means
the model result is known but rendering completion is not yet observed; it must
not be interpreted as layout ready. If the receipt file itself cannot be written,
the operation reports an error rather than guaranteeing an on-disk receipt.

### Headless preflight

After the repository's normal setup, validate a full document without opening the
app or changing the input file:

```sh
node scripts/validate-model.mjs --file examples/fulfillment.drawdb.json --json
```

Standard output is one JSON object with the normalized copy, errors and warnings.
Exit code 0 permits warnings, 2 means invalid JSON/model, and 1 means an argument
or file-read error. The command uses the pinned dialect type catalogue, including
length/precision checks. Browser-only custom type metadata is unavailable and
reported as a warning. No SQL or evidence locator is executed or fetched.

## Focused verification

`npm test` covers identity retention, stale/write-failure rejection, CLI arguments
and handoff. `scripts/smoke-replacement.mjs` uses an isolated fictional workspace to
verify validation, failure preservation, picker confirmation/cancellation, native
handoff, same process/window/renderer, model count, live EDA refresh and persistence.
Set `ER_WIKI_TEST_APP` to test a packaged executable. `ER_WIKI_PACKAGE_OUT` can direct
packaging to a temporary directory before updating the one fixed application entry.
Use `--receipts-only` for the narrow success/validation-failure/JSON-failure
native handoff check; it does not run the broader replacement scenarios.
