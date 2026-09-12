# Local verification — 0.2.0-preview.1

Code checkpoint: `2094ecb` on `feat/desktop-workflow-v2`.
Recorded 2026-09-12. This is local evidence, not a GitHub CI result or publication.

## Completed

- `npm test`: 21 passing tests, zero failures/skips. Includes legacy JSON migration,
  reading-state isolation, geometry stability, field/alias/enum search, backup
  integrity/retention, concurrent preferences and version comparison.
- Production renderer build completed with the pinned upstream source.
- Focused Electron workflow used a fresh temporary profile and fictional models:
  - Switch English → Chinese → English, including native menus.
  - Preserve the same editing session, model content and model save timestamp.
  - Find a field by Chinese alias, edit its display name without moving tables.
  - Restore viewport/selection after switching models and reloading; retain bookmarks.
  - Create a native backup and restore a separate model without overwriting the original.
  - Parse a two-table SQL fixture with a foreign key and import it as a new model.
  - Export all 13 demo tables as pure SVG and PNG without changing the reading position.
  - Open the offline Monaco/DBML editor.
  - No captured renderer page errors; no document-width overflow at the desktop size.
- macOS ARM64 package built, ad-hoc codesign verification passed.
- The packaged application itself started under a second temporary profile;
  `app.isPackaged` was true, version was `0.2.0-preview.1`, and all 13 demo tables loaded.
- Targeted source/build publication guard passed for 233 text files.
- Gitleaks scanned the current source history and approximately 37.97 MB of renderer
  output without findings after reviewed, narrow source-expression exceptions.

## Boundaries

- No real business data, original private application profile or old canvas regression
  was used. No push, remote PR update, merge, tag or release publication occurred.
- Apple Developer ID signing/notarization needs maintainer credentials and was not run.
- Update checking is implemented but live GitHub network behavior was not exercised
  through the installed app; downloads/installation remain manual.
- No claim of exhaustive SQL dialect/UI/platform coverage or independent security review.
- The Monaco 0.56.0 scanner false positive was explained and narrowly handled, but the
  dependency upgrade is held for its pinned DOMPurify advisories. See SECURITY_REVIEW.md.

The optional smoke script is `scripts/smoke-desktop.mjs`. It uses an existing
Playwright runtime to automate Electron, not a browser. Generated artifacts and
test profiles are intentionally excluded from Git and package inputs.
