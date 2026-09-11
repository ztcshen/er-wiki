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
