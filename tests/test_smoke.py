"""Smoke test: exercise the route contract end to end without Avid or AE.

Run from the AE_Bridge dir:  python -m pytest tests/  (or python tests/test_smoke.py)
"""
import os
import tempfile
from pathlib import Path

# Point the helper at a throwaway home BEFORE importing the app.
_TMP = tempfile.mkdtemp(prefix="aebridge_test_")
os.environ["AEBRIDGE_HOME"] = _TMP

from fastapi.testclient import TestClient  # noqa: E402

from service.app import app  # noqa: E402
from service.config import settings  # noqa: E402
import service.integrations.ae as _ae  # noqa: E402

# No After Effects / ffmpeg in CI: stub the OS-facing calls so the route
# contract is exercisable. (These are proven separately on macOS.)
_ae.launch_ae = lambda *a, **k: None
_ae.make_placeholder_plate = lambda *a, **k: False

client = TestClient(app)


def _seed_template():
    settings.roots.ensure()
    (settings.roots.template_root / "lower_third_v2.aep").write_bytes(b"TEMPLATE")


def test_version_and_templates():
    _seed_template()
    with TestClient(app) as c:  # triggers startup
        r = c.get("/v1/version")
        assert r.status_code == 200
        assert "aebridge" in r.json()["feature_ids"]

        r = c.get("/v1/aebridge/templates")
        assert r.status_code == 200
        assert any(t["id"] == "lower_third_v2" for t in r.json())


def test_new_per_shot_roundtrip():
    _seed_template()
    with TestClient(app) as c:
        r = c.post("/v1/aebridge/send", json={"template_id": "lower_third_v2", "handles": 8})
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["state"] == "ready_in_ae"
        assert job["project_mode"] == "new_per_shot"
        job_id = job["job_id"]

        # Simulate AE finishing a render into watch_root.
        job_obj = _get_job(job_id)
        ret = settings.roots.watch_root / f"{job_id}.mov"
        ret.write_bytes(b"RENDER")
        job_obj.return_path = ret
        job_obj.state = _JobState.returned

        r = c.post(f"/v1/aebridge/return/{job_id}/import", json={})
        assert r.status_code == 200, r.text
        assert r.json()["state"] == "validated"

        r = c.post(f"/v1/aebridge/return/{job_id}/swap")
        assert r.status_code == 200, r.text
        assert r.json()["state"] == "done"


def test_existing_project_requires_token():
    _seed_template()
    with TestClient(app) as c:
        r = c.post(
            "/v1/aebridge/send",
            json={"template_id": "lower_third_v2", "project_mode": "existing_project"},
        )
        assert r.status_code == 400


def test_existing_project_via_picked_token():
    _seed_template()
    with TestClient(app) as c:
        # Editor "picks" an .aep (injected path stands in for the native dialog).
        picked = Path(_TMP) / "Reel2_Temps.aep"
        picked.write_bytes(b"PROJECT")
        r = c.post("/v1/aebridge/pick-project", params={"path": str(picked)})
        assert r.status_code == 200, r.text
        token = r.json()["target_project_token"]
        assert r.json()["label"] == "Reel2_Temps.aep"

        r = c.post(
            "/v1/aebridge/send",
            json={
                "template_id": "lower_third_v2",
                "project_mode": "existing_project",
                "target_project_token": token,
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["aep_path"] == str(picked)


def test_path_escape_rejected():
    _seed_template()
    with TestClient(app) as c:
        # A non-.aep selection must be rejected by the picker.
        bad = Path(_TMP) / "notaproject.txt"
        bad.write_bytes(b"x")
        r = c.post("/v1/aebridge/pick-project", params={"path": str(bad)})
        assert r.status_code == 400


# --- helpers to reach into the in-memory store for simulation ---
from service.jobs import store as _store  # noqa: E402
from service.models import JobState as _JobState  # noqa: E402


def _get_job(job_id):
    return _store.get(job_id)


if __name__ == "__main__":
    test_version_and_templates()
    test_new_per_shot_roundtrip()
    test_existing_project_requires_token()
    test_existing_project_via_picked_token()
    test_path_escape_rejected()
    print("ALL SMOKE TESTS PASSED")
