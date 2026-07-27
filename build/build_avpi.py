#!/usr/bin/env python3
"""DEPRECATED — the AVPI build moved to the Node .mjs pipeline (EB convention).

Use instead:
    yarn build:panel            # dev profile   -> dist/AEBridge.avpi
    yarn build:avpi:release     # release profile (helper serves UI)

Which runs build/manifest.mjs + build/zip.mjs.
"""
import sys

print(__doc__)
sys.exit(1)
