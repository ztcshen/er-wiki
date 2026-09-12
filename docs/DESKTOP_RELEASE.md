# Desktop installation and release

## Install on macOS

Download the macOS ARM64 ZIP from the matching GitHub release, extract it and move
**ER Wiki Community.app** to Applications. Close the previous version before
replacing it. Model data lives outside the application bundle in the **ER Wiki
Community** application-data directory. Export important models before upgrading.

下载对应版本的 macOS ARM64 ZIP，解压后把应用放入“应用程序”。升级前关闭旧版本并导出重要模型。
默认构建使用 ad-hoc 临时签名，不是 Apple Developer ID 签名或公证。
若 macOS 阻止打开，请遵循设备的安全策略；不要关闭 Gatekeeper 或绕过公司设备限制。

## Build

```sh
npm ci
npm run setup
npm test
npm run package
```

The generated application is in `desktop/release/<version>/`. The source SVG and
rendered 1024-pixel PNG icon are in `desktop/assets/`; macOS icon sizes and ICNS are
generated using `sips` and `iconutil` at packaging time. Application source and
the pinned upstream source are included in the package.

## Optional Developer ID signing and notarization

These require a valid maintainer-owned Developer ID Application certificate and
Xcode command-line tools. This repository contains no signing certificate or
Apple credential. Signing options are passed to `@electron/packager` / `osx-sign`.

```sh
ER_WIKI_SIGN_IDENTITY='Developer ID Application: Your Name (TEAMID)' npm run package
```

Notarization is a separate explicit opt-in because it uploads the application to
Apple. First configure a `notarytool` keychain profile outside this repository.
Only then, with approval to upload the application, run:

```sh
ER_WIKI_SIGN_IDENTITY='Developer ID Application: Your Name (TEAMID)' \
ER_WIKI_NOTARY_PROFILE='your-existing-keychain-profile' \
ER_WIKI_NOTARIZE=1 npm run package
```

The command waits for notarization, staples the ticket, and validates it. Missing
credentials fail closed. The Developer ID / notarization path is implemented but
has not been exercised with real credentials in this development checkpoint.
The GitHub release workflow produces an ad-hoc signed draft. Tags with a prerelease suffix are marked as prereleases; publication is a separate maintainer action.

## Release boundary

Local commits and packages do not publish a release. Push, PR, merge, tags and
release publication require explicit authorization. CI must pass for the exact
release commit; use the existing draft-release workflow and checksum archive.
Windows/Linux distribution and unattended application updates remain out of scope.

## Focused development check

`scripts/smoke-desktop.mjs` uses an existing Playwright runtime to launch Electron
with a new temporary profile. Set `ER_WIKI_PLAYWRIGHT_MODULE` to the runtime module
path if Playwright is not installed locally; no browser installation is required.
It checks language, native menus, model preservation, editing geometry, reading
state, backup restore, SQL import and pure SVG/PNG export using fictional models.
The default `npm test` command only runs deterministic Node tests.
