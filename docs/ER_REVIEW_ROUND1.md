# Local ER review round 1

This local build focuses on editing and immediate structural feedback.
It does not add review records, issue statuses, approvals, model versioning,
baseline comparison, an Agent, or a public release.

## Simpler reading workspace (0.3.0-local.2)

- Primary ER controls are Overview, Arrange, Check and Display. Navigate through
  directory groups/tables; return to Overview to restore every table. The existing
  five view scopes, reading bookmarks and advanced routing settings remain under
  Display rather than taking up the main toolbar.
- The right side shows one context at a time: table, field, individual relationship
  or structure checks. A field does not append the entire table or all of its nets.
  Table details separate Fields and Related tables, with keyboard-operable tabs.
- Checking is a nonmodal side panel. Locate leaves the issue list open and the
  diagram remains interactive. Editing still uses the centered editor; closing it
  returns to the updated list. Clicking a graph/directory object shows its details.
- These changes add no Agent, new persistence format, model history or approval
  workflow. Future Agent configuration should use validated model operations;
  the current advanced manual editors remain available as a fallback.

## Edit

- Keep the existing table editor, type picker, defaults, constraints and indices.
- Edit length/precision next to the field type. Enter/blur commits; Escape cancels.
- Save from the header or Cmd/Ctrl+S first commits the focused input. Invalid
  length/precision drafts must be corrected or cancelled rather than saved silently.
- Edit enum values and meanings in place, with duplicate checks and Apply/Cancel.
  Unapplied enum-row input is not saved. Existing enum add/remove and undo remain.
- Choose both relationship tables and one or more field pairs in the same controls
  for creation and editing. Invalid/missing or repeated pairs cannot be applied.
  Type-definition differences are warnings and do not prohibit logical joins.
- Swapping relationship direction reverses 1:N / N:1 while preserving the chosen
  name. Endpoint changes and swaps use the existing undo/redo mechanism.

## Check the current model

Use **Check / 结构检查** in the ER toolbar or search for it in the command palette.
The result is calculated from the current table/field/relationship values and is
not stored with the model or exported as a review history.

- Errors: blank/duplicate names, duplicate IDs, invalid length/precision format,
  missing relationship endpoints, duplicate composite pairs, missing index fields,
  duplicate enum values and empty SQL ENUM/SET definitions.
- Warnings: differing endpoint definitions, primary/null/default inconsistencies,
  SET NULL on non-null fields, duplicate relationships, index configuration and
  enum/default inconsistencies.
- Locate a problem on the ER diagram or open the existing object editor.
  Duplicate-ID cases intentionally disable direct editing because identity is ambiguous.
- Correcting a model recalculates results automatically. Opening the panel does
  not change the saved content or save timestamp.

Checks do not execute SQL or query a database. They are not full dialect/charset
validation, business-rule verification or evidence of production constraints.
No-primary-key tables are not blanket errors, and logical joins are not forced
to reference unique keys. Quoted literal defaults are normalized for enum checks;
SQL expressions are not evaluated or guessed.

## Validation

Run `npm test` and `npm run build`. The focused real-Electron workflow is
`scripts/smoke-round1.mjs` (optionally `--packaged`) with an existing Playwright
runtime supplied through `ER_WIKI_PLAYWRIGHT_MODULE`.

The workflow creates an isolated fictional fixture with known issues, locates and
repairs them, edits enum/default values, checks focused-input saving and composite
relationship swap/undo, and verifies that checking adds no stored review metadata.
No real business workspace is used for these checks.

The same smoke now covers toolbar simplification, advanced controls, context-only
inspectors, keyboard tab navigation, complete overview and nonmodal checks. The
packaged macOS ARM64 build passed these focused checks at 1440×900, plus a 980×800
overflow check. Shared read-only Demo components passed the local desktop/mobile
smoke at 1440×900 and 390×844, without external requests or browser persistence.
`npm test`: 60 passed. The extracted inspector/display components and original
workspace/toolbar/inspector files were scanned with jscpd 5.2.0 (10 lines / 120
tokens): no clones. No public deployment is part of this local iteration.
