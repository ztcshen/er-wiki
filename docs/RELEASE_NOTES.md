# 0.2.0-preview.4 — ER cardinality and relation tracing

- Display 1 / N at real table endpoints while keeping orthogonal routing.
- Keep bundle relationship counts separate from cardinality; mixed endpoint values are shown explicitly.
- Select one relationship within a bundle or Net Label network and trace only its complete path.
- Inspect cardinality in the relationship panel and focus both endpoints, routed paths and complete Net Labels.
- Remember the selected relationship without changing model content or reading-position keys.
- Toggle cardinality under Display; include the same annotations in diagram exports.
- Refresh bilingual screenshots from the packaged desktop with the fictional fulfillment model only.

Cardinality describes the model's configured multiplicity, not live row counts or
verified database constraints. Minimum participation is not inferred; unspecified
cardinality is shown as a question mark. Private business models/configurations
are not included in this community release.

## Diagram navigation

- Optional navigation minimap with click, drag and keyboard movement.
- Smooth cursor-anchored wheel zoom and a 100% reading-scale button.
- Auto / Horizontal / Vertical orthogonal layout direction, remembered per model and bookmark.
- Existing automatic-layout reading positions remain compatible after upgrade.
- Navigation does not modify tables, relations or model save timestamps.
- Updated screenshots from the actual packaged Electron application and fictional fulfillment model.

## Keyboard-first workbench

- Quick search with cmdk, qualified field lookup, keyboard navigation and command-only mode.
- Shared action catalogue for a shorter grouped menu and the complete command palette.
- Independent directory folding and explicit focus-to-table without changing ER scope.
- Native IPC/menu/session boundaries and smaller EDA presentation components.
- Shared cancellable layout tasks and centralized upstream aliases / normalized build paths.
- Open-source design references and updated real desktop snapshots.

## Included desktop workflow improvements

- English / Simplified Chinese / system language, including native menus.
- Unified settings, local help, field aliases and field/enum search.
- Per-model reading positions, bookmarks and back navigation.
- Text-only edits retain layout geometry; structural changes rerun layout.
- Versioned JSON with legacy import, local backups and restore-as-copy.
- Local SQL import preview and pure SVG/PNG/clipboard diagram export.
- Application icon, manual update checking and optional signing/notarization hooks.

This is a prerelease. Initial artifacts target macOS; signing is ad-hoc rather
than Apple Developer ID notarization unless a maintainer explicitly configures
signing. Windows/Linux and exhaustive regression acceptance remain pending.

macOS may show an unidentified-developer warning. Follow your organization's
security policy; do not bypass device-management restrictions to run this preview.

No business data, user profiles or private database examples are included.
Consult LICENSE, NOTICE, SECURITY.md and docs/KNOWN_LIMITATIONS.md before use.
