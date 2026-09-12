# 0.2.0-preview.1 — Desktop workflow improvements

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
This file describes the source version; it is not evidence that a release has been published.
