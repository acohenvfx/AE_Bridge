# AE Bridge licensing rollout

October 8, 2026 — local implementation only, not a published release.

Stripe sandbox product `prod_pragmaticfox_ae_bridge` and one-time USD 49.99
price `price_1UOKX3BICQjHefUNhD4gklvP` are created and verified. The staging
Worker now uses that price (version `79db7597-e6b6-49b2-87ab-2d53a8e3e41c`).
No live Stripe price or production billing configuration was changed. AE Bridge
trial enablement remains false pending the release gates below.

The helper now uses device-bound ES256 leases for product `ae_bridge`, matching
the shared licensing backend. Credentials stay in macOS Keychain; only licensing
metadata goes to the service. Protected `/v1/aebridge` operations fail closed
without usable access. The return watcher pauses when the local lease expires.
Activation, refresh, and deactivation routes require the same local session as
other helper routes. `/license/` serves the activation interface, linked from the
panel header and the website account page.

Default service/key match the production BinCraft configuration. For staging,
set `AEBRIDGE_LICENSE_API_URL` to the staging Worker and
`AEBRIDGE_LICENSE_PUBLIC_JWK` to its public verification key. Never use a private
signing key. `AEBRIDGE_LICENSE_SUPPORT_DIR` isolates test state. File-backed
credentials are allowed only with `AEBRIDGE_LICENSE_ENV=local` and
`AEBRIDGE_LICENSE_CREDENTIAL_BACKEND=file`. An explicit
`AEBRIDGE_LICENSE_ENFORCED=0` is a development bypass, not a release setting.

Before enabling the AE Bridge trial:

1. Create the sandbox and live one-time USD 49.99 Stripe prices and set each
   environment's `STRIPE_AE_BRIDGE_PRICE_ID`.
2. Ensure `ae_bridge` exists in D1 with a two-device limit.
3. Build the panel and helper with the updated dependency lock and bundled
   license UI. Run all existing regressions alongside `tests/test_licensing.py`.
4. Sign, notarize, and validate a new installer; test clean installation and
   actual account-to-app activation against staging. Do not redistribute the
   existing beta DMG as a trial-enforcing build.
5. Upload the validated release under the private AE Bridge release prefix.
6. Only then set `AE_BRIDGE_TRIAL_ENABLED=true`, add the AE Bridge trial entry
   to the website map, and publish the matching website/backend.

Existing installed helpers and published binaries are unchanged. The seven
focused licensing tests passed locally; full app/release validation remains.
