# Workbench iteration verification

Code checkpoint: `4e571cd` (core workbench change `64e886a`), version `0.2.0-preview.2`.
Recorded 2026-09-12. Public PR and CI evidence must be read separately for the
latest pushed head.

## Evidence collected locally

- 28 Node tests passed with no skipped tests. New cases cover every preload invoke
  channel's untrusted-frame rejection, correlated command replies/timeouts, dialog
  serialization, worker cancellation/deadlines, command availability, directory
  preference compatibility, focus geometry and Windows path normalization.
- Focused Electron checks passed: English/Chinese native menus, model preservation,
  field editing without geometry movement, model-switch/reload view recovery,
  backups and restore-as-copy, SQL import, SVG/PNG export and the offline DBML editor.
- New desktop behavior passed: folding a directory group retained all 13 global
  tables; keyboard quick search found and focused `products.sku`; the compact
  header had no document overflow or control overlap at 980px.
- Production renderer build and macOS ARM64 package completed; ad-hoc codesign
  verification passed. The package was then used directly for six real screenshots
  and application SVG export.
- Capture checked the packaged runtime-source hashes against the checkout and
  compared every demo table, field, relation and group before/after capture.
  The canonical example remains 13 tables / 19 relations, with unchanged save time.
- jscpd 5.2.0 scanned 44 source files, including the original entry/workspace/header
  and extracted modules, at a minimum of 6 lines / 80 tokens. No clones were found.
  A separate three-file scan confirmed the original entry files were all recognized.
- The targeted publication guard and Gitleaks renderer scan passed. The renderer
  scan covered approximately 38.03 MB; it did not exclude whole bundles.

## Limits

This is not an independent security audit, exhaustive UI acceptance, Windows
runtime verification or Apple Developer ID notarization. No private models,
production data or old canvas regression suite were used. Native signing remains
ad-hoc and application updates remain manual. This record does not imply a merge
to main or publication of a binary release.
