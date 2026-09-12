# Known limitations

- The application is local-first. The desktop interface supports Chinese and English;
  model content is intentionally not translated. Less-used upstream dialogs may retain upstream terminology.
- Windows/Linux packaging has not been release-validated.
- Default packages are ad-hoc signed. Developer ID signing and notarization require
  maintainer credentials; that optional path has not been live-verified.
- Update checking is explicit and downloads are manual, not automatic installation.
- The upstream renderer is large and still includes legacy dependencies.
- The CSP retains unsafe-eval for current upstream editor dependencies.
- EDA layout chooses among heuristic candidates, not a global optimum.
- Hub/label geometry is presentation data, not a database migration.
- Focused desktop workflows have checks; exhaustive editing/SQL dialect/platform
  regression acceptance is not implied by those checks.
- Reading bookmarks are local preferences, not part of model JSON exports.
- At overview scale, table summaries replace field rows visually, without changing
  table or relationship coverage. Zoom in or disable semantic summaries under Display.
- Process views are optional explicit definitions, not generated execution flows.
  Process configuration is JSON-based and does not participate in the ER undo stack.
- Backups are local and bounded by retention; they do not replace off-device backups.
- The local publication guard is a targeted pattern/path check, not proof that
  no secret or private fact exists. Human review and a maintained secret scanner
  remain requirements for each new publication.
