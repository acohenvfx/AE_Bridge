# AEBridge Cloudflare deployment

AEBridge follows the same split as Elemental Bender and Difference Engine:
Cloudflare hosts only the panel UI, while the signed AVPI and the helper stay
local to the editor's Mac.

```text
GitHub push
   └─ Cloudflare Workers Builds → Cloudflare Worker (static panel only)

Signed AVPI → localhost:8010/app
                 ├─ local FastAPI API + local editorial data
                 └─ helper proxy → https://aebridge.andrewcoheneditor.com
```

The production Worker is `ae-bridge` in account
`0833451ced0fc7c32509e9a3981e6161`, with the custom domain
`https://aebridge.andrewcoheneditor.com`. The Worker serves `dist/html` using
`wrangler.jsonc` and never receives the local API, media, AEP files, sidecars,
sequence names, or MCAPI results.

## Worker build setup

The Worker is connected to `acohenvfx/AE_Bridge` on the `main` branch. Its
Cloudflare Workers Builds settings are:

- Build command: `yarn build:cloudflare`
- Deploy command: `npx wrangler deploy`
- Non-production branch deploy command: `npx wrangler versions upload`
- Root directory: `/`
- Build variables: `NODE_VERSION=22.16.0`, `YARN_VERSION=1.22.22`, and
  `NODE_OPTIONS=--openssl-legacy-provider`

The build variables are build-only. Node 16/Yarn 1 remain the local development
toolchain, while the Cloudflare build image uses Node 22/Yarn 1 and Wrangler
deploys the Worker defined in `wrangler.jsonc`.

## Helper connection

Production helper installs use:

```text
AEBRIDGE_UI_ORIGIN=https://aebridge.andrewcoheneditor.com
```

The helper proxies `/app`, `/_nuxt/*`, and the other static UI paths through
localhost. It rejects `/v1/*` and never sends media or editorial metadata to
Cloudflare. The helper remains on `127.0.0.1:8010`, separate from Elemental
Bender's `8000` and Difference Engine's `8800`.

For local development before the Worker is deployed, use:

```bash
AEBRIDGE_SERVE_LOCAL_UI=1 PYTHONPATH=. python -m service.app
```

To proxy a running Nuxt dev server instead:

```bash
AEBRIDGE_DEV=1 PYTHONPATH=. python -m service.app
```

Do not use a Cloudflare Tunnel for the helper. A tunnel would expose the
media-capable local API to the network and is not part of this product's
distribution model.

## Release order

1. Publish and verify any helper/native update first.
2. Confirm `/v1/version` advertises the routes the panel uses.
3. Merge the panel change to `main` and wait for the Workers Build to pass.
4. Reload the panel in Media Composer.

If the helper API or AVPI manifest changes, follow the existing signed helper
and Avid certification process. A normal static UI update does not change the
AVPI.
