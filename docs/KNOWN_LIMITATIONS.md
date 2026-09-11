# Known limitations

- The application is a local preview and primarily has a Chinese interface.
- Windows/Linux packaging has not been release-validated.
- No Apple Developer ID signing, notarization or automatic updates are configured.
- The upstream renderer is large and still includes legacy dependencies.
- The CSP retains unsafe-eval for current upstream editor dependencies.
- EDA layout chooses among heuristic candidates, not a global optimum.
- Hub/label geometry is presentation data, not a database migration.
- Full editing, enum, file-dialog and platform regression acceptance is pending.
- The local publication guard is a targeted pattern/path check, not proof that
  no secret or private fact exists. Human review and a maintained secret scanner
  remain pre-publication requirements.
