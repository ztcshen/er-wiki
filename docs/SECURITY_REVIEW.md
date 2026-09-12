# Initial preview publication checks

Scope: the independent community source history, fictional example and compiled
renderer. No claim of a full application security audit or independent review.

- Gitleaks 8.30.1 checks the tracked history and built renderer.
- The targeted publication guard checks source paths, generated files and Git
  index entries, including accidental dependency-cache symlinks.
- npm audit reported no known vulnerabilities for the inspected dependency
  manifests and renderer production dependency tree at publication preparation.
- Fourteen synthetic model/protocol/file checks passed locally; CI reruns them.

The initial unfiltered build scan reported 11 generic-api-key matches. Inspection
identified one TypeScript AST member expression, one Monaco export initializer,
and repeated SQL-parser property names (including SAML grammar token names).
They are program identifiers, not API credentials. The scanner configuration
contains narrow path-and-expression exceptions; it does not exclude entire
dependency directories or compiled bundles.

Full UI/platform regression, Developer ID notarization and independent security
review remain outside this preview's verification claims. Live CI status is the
source of truth for the exact PR head.

## Local 0.2 development follow-up

The Monaco 0.56.0 update's single new scanner match was reproduced against its
published npm archive. It is a glyph-atlas constructor expression assigning a
new Set after an NKeyMap construction, not a credential. The new exception is
restricted to that exact expression in the hashed Monaco editor asset and only
the generic-api-key rule. Other rules still scan the full file.
Generated vendor directories are replaced during builds so old hashed assets
cannot survive a dependency upgrade. Remote dependency PRs have not been merged
as part of local-only development.

The update was also checked with npm audit. Monaco 0.56.0 pins DOMPurify 3.4.8;
the audit reports low/moderate advisories including GHSA-55q2-fjhq-7xh7. Therefore
this checkpoint keeps the existing Monaco 0.52.2 pin and does not merge or ship
the dependency update. The scanner correction is ready independently. This is
an audit-based dependency hold, not a claim that old bundled dependencies have
undergone a comprehensive security assessment.
