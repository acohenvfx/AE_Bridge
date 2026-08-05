# AEBridge — distribution

How AEBridge reaches an artist's machine, and how it updates afterwards.
Modelled on DifferenceEngine's setup; the differences are called out because
they are not accidental.

## The two update channels

**Panel UI — continuous, no release needed.** The helper serves the panel at
`http://localhost:8010/app`. Set `AEBRIDGE_UI_ORIGIN` and it instead proxies a
hosted build (`service/routers/ui_proxy.py`), so publishing to Cloudflare
updates every artist on their next panel open.

This is a proxy rather than pointing the panel's manifest at the hosted URL
because **the `.avpi` manifest is signed** — `url` and `allowedDomains` live
inside it, so changing either means re-signing with Avid. It also sidesteps
mixed content (an HTTPS page cannot call `http://127.0.0.1:8010`), Private
Network Access preflights, and CORS, since the WebView only ever sees
`http://localhost:8010`.

**Helper binary — tagged releases.** `git tag helper-vX.Y.Z && git push --tags`
runs `.github/workflows/release-helper.yml`, which builds, signs and notarizes
both architectures and publishes them to `acohenvfx/AE_Bridge_Releases`.
`ota/AEBridgeLauncher.sh` picks them up on next start.

## Components

| Path | Role |
| --- | --- |
| `ota/aebridge_main.py` | PyInstaller entry. Needed because `service` is a package using relative imports — DE points straight at its `app.py` only because its modules are flat. |
| `ota/aebridge-helper.spec` | onedir → `AEBridgeHelper.app`, id `com.acohenvfx.aebridge.helper`. Bundles `dist/html` and the native probe. |
| `ota/build-helper.sh` | Isolated venv, builds the UI and probe, runs PyInstaller. |
| `ota/ci-sign-notarize-bundle.sh` | Temp keychain, inside-out signing, `notarytool --wait`, staple, Team ID assertion, `spctl`. |
| `ota/AEBridgeLauncher.sh` | Stable entry point: update check → download → **SHA-256 then Team ID** → atomic swap → exec. |
| `ota/com.acohenvfx.aebridge.helper.plist.template` | launchd job. Runs the *launcher*, not the helper, so the path stays stable across versions. |
| `installer/install-main.sh` | Installer body. Every target path is overridable, so the whole flow is testable into a temp dir. |
| `installer/make-dmg.sh` | Builds the installer `.app` and the DMG. |
| `native/aebridge-probe.swift` | AVFoundation metadata probe (see below). |

## Why there is no ffprobe

Return validation needs frame rate, resolution and frame count. Shipping
ffprobe meant redistributing FFmpeg: the readily available macOS builds are GPL
and dynamically linked (a Homebrew ffprobe is single-arch and breaks anywhere
without `/opt/homebrew`), so it carried both a licensing obligation and a
portability problem. `native/aebridge-probe.swift` uses AVFoundation instead —
part of macOS, a few hundred KB, universal2, signs with the bundle.

**The trap, found by comparing against ffprobe rather than assuming:** a
QuickTime edit list (`elst`) can present fewer frames than the container
stores. An Avid plate here stores 1071 samples but presents 1067, which is what
ffprobe and Avid both report. `AVAssetReaderSampleReferenceOutput` counts
stored samples — 1071 — even when constrained to the track's `timeRange`.
Validation compares frame counts for **exact equality**, so that would have
failed good renders. `track.timeRange` *is* edit-list aware, so the count comes
from presented duration × nominal rate. Verified frame-for-frame against
ffprobe across all 30 plates and renders on disk.

`probe_video` still falls back to ffprobe where it exists, and a count it
cannot determine is **omitted rather than zeroed**, so it reads as "not
checked" rather than a mismatch.

## Before the first real release

1. **Repo secrets** on `acohenvfx/AE_Bridge`. The six Apple ones are the same
   values DifferenceEngine uses. `RELEASES_REPO_PAT` must grant
   `Contents: write` on **AE_Bridge_Releases**, not DE's repo.
2. **Enable the `workers.dev` route** for the `ae-bridge` Worker. It is
   disabled by default, which is why `ae-bridge.andrewcohenvfx.workers.dev`
   404s.
3. **Then** set `AEBRIDGE_UI_ORIGIN` in the launcher to that workers.dev
   origin. **Not** the custom domain: `aebridge.andrewcoheneditor.com` serves
   Cloudflare's `challenge-platform` script, which Avid's WebView cannot
   complete. DifferenceEngine records the same rule for its own custom domain.
4. **Ship the signed `.avpi`**, not `dist/AEBridge.avpi` — the dev build points
   at `localhost:3010`. Pass `AEBRIDGE_AVPI=/path/to/signed.avpi`.
5. Set `AEBRIDGE_SIGN_IDENTITY` when running `make-dmg.sh`, or the installer
   app and DMG go out unsigned.

## Hosting note

AEBridge's hosted UI is a **Worker with a static Assets binding**, not a Pages
project — that is DifferenceEngine. So there is no `*.pages.dev` hostname, and
`wrangler.jsonc` exists here where DE has no wrangler config at all (it deploys
via `wrangler pages deploy` from a GitHub Action instead). Cloudflare Workers
Builds is Git-connected and builds on push to `main`.

## Testing without touching the system

```bash
# Installer, fully sandboxed
AEBRIDGE_INSTALL_RESOURCES=<dir> AEBRIDGE_INSTALL_APP_DIR=/tmp/x/Applications \
AEBRIDGE_INSTALL_SUPPORT_DIR=/tmp/x/Support AEBRIDGE_INSTALL_AGENTS_DIR=/tmp/x/Agents \
AEBRIDGE_INSTALL_AVID_DIR=/tmp/x/Avid AEBRIDGE_INSTALL_LOG_DIR=/tmp/x/Logs \
AEBRIDGE_INSTALL_SKIP_LAUNCHCTL=1 bash installer/install-main.sh

# Launcher against a local release server
AEBRIDGE_RELEASE_BASE=http://127.0.0.1:8799 AEBRIDGE_REQUIRE_TEAM_ID= \
AEBRIDGE_HELPER_DIR=/tmp/y/helper AEBRIDGE_HELPER_APP_PATH="/tmp/y/AEBridge Helper.app" \
bash ota/AEBridgeLauncher.sh
```

Both were used to verify: fresh install, no-op when current, update on a new
version, **refusal on checksum mismatch**, offline fallback to the installed
helper, clean exit when offline with nothing installed, no double-start when
port 8010 is held, and an idempotent re-install over an existing one.
