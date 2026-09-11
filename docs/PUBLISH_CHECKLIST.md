# Publication checklist

Current decision: **local preparation only**. No remote repository, PR, tag push,
Release or public binary upload is authorized by this checkpoint.

Planned owner/name: `ztcshen/er-wiki`.

## Candidate content

- [x] Independent source directory and new history, not an export of private history.
- [x] Fictional fulfillment example instead of business datasets.
- [x] AGPL LICENSE, NOTICE, contribution and security documentation.
- [x] Pinned renderer source and dependency lockfiles.
- [x] CI and draft-release workflow definitions (not yet executed on GitHub).
- [x] Record local build and targeted privacy-scan results (see LOCAL_PREPARATION.md).
- [ ] Human-review every publishable file and source archive.
- [ ] Run a maintained secret scanner over the final tracked history and binaries.
- [ ] Review dependency security/license results and existing limitations.
- [ ] Complete the agreed focused UI and platform checks before a stable release.

## After explicit permission to publish

1. Recheck the active GitHub account is `ztcshen`, repository name and visibility.
2. Agree how to bootstrap an empty default branch; do not silently push main.
3. Publish the candidate branch and open a draft PR.
4. Evaluate CI and review against the exact current PR head.
5. Address actionable feedback before requesting merge/release approval.
6. Enable private vulnerability reporting and verify repository community files.
7. Build fresh community artifacts; never reuse a binary from another workspace.
8. Publish a prerelease only after explicit approval, with checksums, source,
   platform/signing limits and accurate verification notes.

The release workflow is manual and creates a **draft prerelease**. It is a
configuration template, not evidence that a release has happened.
