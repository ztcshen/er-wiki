# Security

This preview runs its editor locally. The renderer has no Node.js integration;
context isolation and sandboxing are enabled. The packaged session blocks remote
HTTP(S)/WebSocket requests and uses a contained custom protocol for local assets.

Models and settings are stored under the separate ER Wiki Community application
data directory. Exported JSON is a snapshot and may include user annotations.
An imported SQL file or model is untrusted input.

Known boundary: legacy Monaco/upstream dependencies require CSP `unsafe-eval`.
The application has not received a complete independent security audit.
Ad-hoc macOS signing is not Developer ID notarization.

## Reporting

Do not publish credentials, internal schemas or real data in an issue.
Use GitHub's private vulnerability-reporting channel when it is available at
https://github.com/ztcshen/er-wiki/security/advisories/new.
If unavailable, contact the maintainer through the GitHub profile and agree on
a private reporting channel before sending details.

Only the latest community preview is being maintained. It is not a stable
production release and carries no security-response SLA.
