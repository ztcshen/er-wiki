# Contributing

Please discuss substantial behavior or architecture changes before implementing
them. Keep pull requests focused and include the exact problem and expected result.

## Development

1. Install Node.js 22.18+ and Git.
2. Run `npm ci && npm run setup`.
3. Run `npm run build` and `npm start`.
4. Use `npm run scan` before sharing source or screenshots.
5. Run focused checks for the change; `npm test` contains synthetic model and
   shell-security checks, not a private-business regression suite.

The generated renderer lives in `work/drawdb`. Do not submit that directory.
Maintain changes in the pinned patch or the desktop build integration.
Do not change upstream versions without reviewing the lockfile, license notices,
patch applicability and offline build.

## Model and privacy boundaries

- Use the fictional fulfillment example or another independently authored model.
- Never attach customer records, production DDL, internal hosts, credentials,
  private source excerpts, database exports or personal browser/application data.
- Redact screenshots before posting; exported JSON may contain annotations.
- A visual relation must distinguish a declared example constraint from inference.

## Pull requests

Explain user-visible changes, verification actually performed, remaining limits,
and dependency/license changes. Do not describe unrun CI or a build as an external
review. Contributions must be compatible with this project's AGPL license and
must be yours to contribute.
