"""Verify the served UI and that the packaged .avpi is well-formed."""
import json
import os
import tempfile
import zipfile
from pathlib import Path

os.environ["AEBRIDGE_HOME"] = tempfile.mkdtemp(prefix="aebridge_uitest_")

from fastapi.testclient import TestClient  # noqa: E402

from service.app import app  # noqa: E402
from service.config import settings  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def test_app_page_served():
    settings.roots.ensure()
    (settings.roots.template_root / "lower_third_v2.aep").write_bytes(b"T")
    with TestClient(app) as c:
        r = c.get("/app")
        assert r.status_code == 200
        assert "AEBridge" in r.text
        # Nuxt keeps application code in the referenced hashed chunks rather
        # than inline in the HTML shell.
        chunks = (ROOT / "dist" / "html" / "_nuxt").glob("*.js")
        assert any("/v1/aebridge/send" in p.read_text(errors="ignore") for p in chunks)
        assert "Content-Security-Policy" in r.headers
        assert "connect-src 'self'" in r.headers["Content-Security-Policy"]


def test_manifest_generated():
    # build/manifest.mjs writes the manifest to dist/app/.
    mpath = ROOT / "dist" / "app" / "avid-manifest.json"
    assert mpath.is_file(), "run `yarn build:panel` (or node build/manifest.mjs) first"
    manifest = json.loads(mpath.read_text())
    assert manifest["name"] == "com.acohenvfx.aebridge"
    url = manifest["uiItems"][0]["url"]
    assert url.endswith("/app")  # dev :3006 or release :8010
    assert any("8010" in d for d in manifest["allowedDomains"])


def test_avpi_archive_built():
    # build/zip.mjs should have produced dist/AEBridge.avpi
    avpi = ROOT / "dist" / "AEBridge.avpi"
    assert avpi.is_file(), "run `yarn build:panel` first"
    with zipfile.ZipFile(avpi) as z:
        names = set(z.namelist())
        assert "avid-manifest.json" in names
        assert "static/application.svg" in names
        json.loads(z.read("avid-manifest.json"))  # valid JSON


if __name__ == "__main__":
    test_app_page_served()
    test_manifest_generated()
    test_avpi_archive_built()
    print("UI + AVPI CHECKS PASSED")
