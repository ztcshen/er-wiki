# Product introduction: claims and evidence

## Before

The root URL opened the workbench with no problem statement. README introduced
an offline desktop workspace and a long list of standard editor features before
showing the visual difference. Desktop screenshots were honestly labeled 0.2.0,
but could not demonstrate current routing. Open Graph used the app icon. Visitors
could identify an ER tool, but not quickly tell why its routing deserves attention.

## Core message

Readable ER diagrams for complex database schemas. EDA-style routing for database
relationships — not a promise of perfect layouts or a database circuit simulator.
中文：让复杂数据库 Schema 的 ER 图保持可读，借鉴电路布线思想组织关系线。

## Evidence map

| Claim | Current source and boundary |
|---|---|
| Orthogonal routing | `desktop/eda/layout.mjs`, `elk-graph.mjs`: ELK layered layout; heuristic candidate selection |
| Obstacle avoidance | `desktop/eda/obstacle-router.mjs`, `refine-positions.mjs`: libavoid rerouting; bounded, size-dependent search |
| Four-sided ports | `desktop/eda/ports.mjs`: field identity is preserved; not a guarantee every layout uses every side |
| Shared buses / junctions | `desktop/eda/model.mjs`: semantic nets, high-fanout hub projection, original relation membership |
| Navigation | `EdaWorkspace.jsx`, `reading-state.mjs`: overview/domain/table/column, search, minimap; not unlimited scale |
| Local SQL and JSON | Desktop import/export adapters and `docs/USER_GUIDE.md`; no database SQL execution |
| Privacy | `desktop/native/session.cjs`, `desktop/updates.cjs`; no application telemetry, explicit GitHub update checks |
| Demo | `site/build.mjs`: fixed fictional 13-table/19-relation schema, 18 precomputed scopes, no model uploads |

## Page structure

1. Short EDA-led hero, demo/source CTAs and secondary desktop download.
2. Actual current web-renderer screenshot, with exact model size and provenance.
3. Problem → solution, followed by paths / connections / ports.
4. Common navigation/editing features below the routing story.
5. Local/privacy behavior, existing technology and explicit limitations.
6. Final demo/GitHub links and platform/signing boundary.

The root and `zh.html` are static HTML with local CSS and images, no JavaScript
or new framework. `demo.html` retains the existing React demo and shared desktop
components. Build-time bilingual content lives in `site/landing.mjs`; neither
page changes the desktop workspace. Canonical, hreflang, Open Graph and Twitter
cards are emitted in HTML, not injected after rendering.

## Visual provenance and unmade claims

`images/routing-preview.png` is an unmodified screenshot of the actual local
v0.4.1-candidate web demo, from the fictional fulfillment model. CSS frames the
central diagram on the introduction; the full screenshot remains available in
README. It is not a screenshot of a production database or a competitor.
`images/social-preview.png` is a 1200×630 browser capture of a compact sharing
layout (`social.html`), using the same headline and actual renderer screenshot;
it is suitable for GitHub's manually configured social preview. Providing the
file does not mean the repository setting has been updated.

There is no fair before/after comparison, animated GIF or public benchmark page.
The historical 42-table synthetic fixture is not a 50/100/200-table performance
report. Those measurements and a richer, independently authored complex example
are follow-up work. Do not label this 13-table demonstration a scalability proof.

## Verification

`npm run build:demo`, `node site/verify.mjs`, `node site/smoke-landing.mjs`,
`node site/smoke.mjs`, `npm run build`, `npm test`, `npm run scan` and
`git diff --check`. Browser smoke uses an existing Playwright/Chromium runtime.
Root/desktop manifests currently expose no lint or typecheck task; Vite compilation
and Node syntax checks are not presented as a full lint/typecheck pass.
See the release and workflow runs for exact publication status, not this design note.
