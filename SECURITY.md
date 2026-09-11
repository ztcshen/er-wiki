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
Once the proposed GitHub repository exists and private vulnerability reporting is
enabled, use that private channel. Until then, contact the maintainer through the
GitHub profile and agree on a private reporting channel before sending details.

Supported version policy will be set with the first public release. At present
there is only a local preview candidate, not a supported public release.
