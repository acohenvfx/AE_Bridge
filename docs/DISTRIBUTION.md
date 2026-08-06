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

1. ~~Repo secrets on `acohenvfx/AE_Bridge`~~ — **DONE.** All 7 were set on
   2026-08-05/06 (`gh secret list --repo acohenvfx/AE_Bridge` confirms), and
   they demonstrably work: `helper-v0.0.3` signed and notarized with them on
   2026-08-06. The table below still documents which values are shared with
   DifferenceEngine, which matters when one is rotated.
2. ~~Enable the `workers.dev` route for the `ae-bridge` Worker~~ — **DONE,
   confirmed 2026-08-06.** `ae-bridge.andrewcohenvfx.workers.dev` now returns
   `200` and serves the real Nuxt build (`/app` → `/app/` → the panel HTML),
   verified against `wrangler deployments list --name ae-bridge`'s latest
   entry, not a stale cache. `ota/AEBridgeLauncher.sh` now defaults
   `AEBRIDGE_UI_ORIGIN` to this origin (was previously left empty with a TODO
   comment) — proxying through it was verified end-to-end on a throwaway
   local helper instance the same day. Set `AEBRIDGE_UI_ORIGIN=` (empty) to
   opt back out to the bundled local UI.
3. **Ship the signed `.avpi`**, not `dist/AEBridge.avpi` — the dev build points
   at `localhost:3010`. Pass `AEBRIDGE_AVPI=/path/to/signed.avpi`.
4. **Have working notary credentials before running `make-dmg.sh`.** Signing is
   now the default and the identity is auto-detected, so the only thing that
   needs arranging is the notary profile — see below.

## The DMG must be notarized, not just signed

**Signed-but-un-notarized is the dangerous shape.** It builds cleanly,
`codesign --verify` passes, and it is then rejected on any machine that did not
build it:

```
spctl --assess: rejected
source=Unnotarized Developer ID
```

Found on 2026-08-06 on a DMG that looked finished — `make-dmg.sh` signed the
installer app but never submitted it to Apple, unlike the helper, which
`ci-sign-notarize-bundle.sh` has always notarized. `codesign --verify` passing
is **not** the check that matters; it says the signature is intact, not that
Gatekeeper will allow the thing to run. Assert with `spctl --assess`.

`make-dmg.sh` now makes this unrepresentable: **signing implies notarizing**,
and it refuses to build rather than emit a signed DMG it cannot notarize. It
notarizes and staples the installer app *before* placing it in the image (so
the ticket travels inside), then signs, notarizes and staples the DMG itself,
then verifies both with `spctl` — the DMG directly and the installer app from
the *mounted* image, as the user will actually launch it. Stapling is what
makes it work **offline**: without a stapled ticket Gatekeeper must reach Apple
to discover the notarization, which an edit bay may not be able to do.

**Signing is the default and the identity is auto-detected** (the same approach
as ElementalBender's `ota/sign-dmg.sh`). Producing something distributable must
not depend on remembering a variable, so the *unsafe* path is the one you ask
for: `AEBRIDGE_UNSIGNED=1` builds an unsigned DMG for local testing and says
plainly it must not be distributed.

```bash
# Create once; the password never enters the environment, a script, or history.
xcrun notarytool store-credentials ACNOTARY \
  --apple-id <apple-developer-id> --team-id RRD4N3SXSG

AEBRIDGE_AVPI=/path/to/signed.avpi bash installer/make-dmg.sh
```

Credentials, in precedence order: `AEBRIDGE_NOTARY_PROFILE` → the CI trio
`MAC_NOTARY_APPLE_ID` + `MAC_NOTARY_PASSWORD` + `MAC_NOTARY_TEAM_ID` (the same
variables `ci-sign-notarize-bundle.sh` uses, so a workflow that can release the
helper can build the DMG with no new secrets) → the shared `ACNOTARY` keychain
profile.

**Why one shared profile name.** An app-specific password is tied to the
**Apple ID, not a product**, so a single profile serves AEBridge,
DifferenceEngine and ElementalBender. The sister projects each invented their
own — `EB Notary`, `DE_NOTARY`, `difference-engine-notary` — which means a
rotated password must be re-stored three times. On 2026-08-06 **all three were
stale (HTTP 401)** while the CI secret was still valid and notarizing helper
releases fine. Aligning them on `ACNOTARY` is a one-line change in each.

**The credentials are checked before the build**, not after — `notarytool
history` runs in the preflight, so a revoked password fails in seconds instead
of after a full build. A 401 means the app-specific password is wrong or
rotated, **not** that the Apple ID is unregistered; "No Keychain password item"
means the profile was never created. An app-specific password is **not** the
Apple ID password — `notarytool` cannot complete a 2FA challenge, so only an
app-specific password (or an App Store Connect API key) works.

**The Apple ID is `andrewrcohen@…`, NOT the `andrewcohenvfx@…` GitHub
address.** They are different accounts and the wrong one fails
`store-credentials` at validation — which stores nothing, so the symptom is a
profile that simply does not exist rather than an error you can find later.
(Left as a placeholder in the command above on purpose: this repo is public.)

**VERIFIED 2026-08-06.** First fully notarized DMG built end to end:
`dist/AEBridge-0.0.3.dmg`, containing `AE_Bridge_0.0.1.avpi` and the real
signed `helper-v0.0.3` as the seed. Both notary submissions Accepted, both
stapled. Checked the way an artist actually receives it — a copy marked with
a Safari `com.apple.quarantine` attribute still reported `accepted /
source=Notarized Developer ID` for the DMG, for the installer app on the
mounted image, and for the seeded helper inside it.

**Seed the DMG with a real released helper, not `dist/AEBridgeHelper.app` as
left by a local build** — that one is unsigned dev debris (it was version
`0.0.1` with `TeamIdentifier=not set` as of 2026-08-06). Download the release
asset and unpack it to `dist/AEBridgeHelper.app` first, or the DMG ships an
unsigned helper inside a notarized wrapper.

## Secrets: what is shared with DifferenceEngine and what is not

GitHub secrets are **per repository**. Nothing is inherited from
DifferenceEngine — every value below has to be set on `acohenvfx/AE_Bridge`
even where the value itself is identical.

| Secret | Same value as DE? | Why |
| --- | --- | --- |
| `MAC_CERT_P12_BASE64` | **Yes** | A Developer ID Application certificate is issued per *team*, not per app. One cert signs both products. |
| `MAC_CERT_PASSWORD` | **Yes** | Password for that same `.p12`. |
| `MAC_DEVELOPER_ID` | **Yes** | The identity string, e.g. `Developer ID Application: … (RRD4N3SXSG)`. |
| `MAC_NOTARY_APPLE_ID` | **Yes** | Same Apple ID. |
| `MAC_NOTARY_PASSWORD` | **Yes** | See the note below — this is the one that looks product-specific and is not. |
| `MAC_NOTARY_TEAM_ID` | **Yes** | Same team. |
| `RELEASES_REPO_PAT` | **NO** | Must grant `Contents: write` on **AE_Bridge_Releases**. A fine-grained PAT is repo-scoped, so DE's token will 403 here. Either mint a new one or add this repo to the existing token's access list. |
| `CLOUDFLARE_*` | **Not needed** | DE deploys Pages from a GitHub Action. AEBridge's UI deploys through Cloudflare's own Git-connected Workers Builds, which needs no Actions secret. |

**On `MAC_NOTARY_PASSWORD`.** An Apple *app-specific password* is tied to the
**Apple ID**, not to a product — "app-specific" means "specific to the
third-party tool you hand it to", so it can be revoked individually. It is not
bound to a bundle identifier. `notarytool` authenticates as Apple ID + team and
reads the bundle id from the submitted binary, so **AEBridge does not need its
own**. Generating a separate one labelled for AEBridge is reasonable if you
want to revoke one product's access without disturbing the other; Apple caps
you at 25 active passwords.

Set them without putting values through a terminal history or a chat window:

```bash
# prompts interactively for the value
gh secret set MAC_NOTARY_PASSWORD --repo acohenvfx/AE_Bridge

# or read from a file, for long values like the base64 cert
gh secret set MAC_CERT_P12_BASE64 --repo acohenvfx/AE_Bridge < cert-base64.txt
```

`gh secret list --repo acohenvfx/AE_Bridge` shows names and dates only —
GitHub never exposes stored values, so secrets cannot be copied between repos
programmatically.

The release workflow checks for the critical ones up front, so a missing secret
fails in seconds with a named error rather than partway through a notarization
submission.

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
