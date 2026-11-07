"""Smoke test: exercise the route contract end to end without Avid or AE.

Run from the AE_Bridge dir:  python -m pytest tests/  (or python tests/test_smoke.py)
"""
import os
import tempfile
from pathlib import Path

# Point the helper at a throwaway home BEFORE importing the app.
#
# AEBRIDGE_HOME alone is NOT enough: export_root and watch_root default to
# ~/Desktop/AEBridge/{plates,render}, which is the user's REAL working folder,
# not something under base. Every root must be overridden or the tests write
# junk plates and renders into live editorial folders (they did — 2026-07-29).
_TMP = tempfile.mkdtemp(prefix="aebridge_test_")
os.environ["AEBRIDGE_HOME"] = _TMP
os.environ["AEBRIDGE_EXPORT_ROOT"] = str(Path(_TMP) / "plates")
os.environ["AEBRIDGE_WATCH_ROOT"] = str(Path(_TMP) / "render")
os.environ["AEBRIDGE_EDL_ROOT"] = str(Path(_TMP) / "edl")
os.environ["AEBRIDGE_TEMPLATE_ROOT"] = str(Path(_TMP) / "templates")
os.environ["AEBRIDGE_AEP_WORK_ROOT"] = str(Path(_TMP) / "aep_work")

# The /v1/aebridge routes are license-gated. These tests exercise the route
# contract, not licensing (that's test_licensing.py), so opt out of
# enforcement and point credential storage at an empty sandbox file. Without
# the file backend the gate reads the developer's REAL Keychain and, if it
# finds credentials, calls the production license service on every request.
os.environ["AEBRIDGE_LICENSE_ENFORCED"] = "0"
os.environ["AEBRIDGE_LICENSE_ENV"] = "local"
os.environ["AEBRIDGE_LICENSE_CREDENTIAL_BACKEND"] = "file"
os.environ["AEBRIDGE_LICENSE_SUPPORT_DIR"] = str(Path(_TMP) / "license")

from fastapi.testclient import TestClient as _StarletteTestClient  # noqa: E402

# The helper only answers requests addressed to loopback hostnames (DNS
# rebinding guard), and TestClient's default host is "testserver".
LOCAL_BASE_URL = "http://127.0.0.1:8010"


class _RawTestClient(_StarletteTestClient):
    def __init__(self, app, **kwargs):
        kwargs.setdefault("base_url", LOCAL_BASE_URL)
        super().__init__(app, **kwargs)


class _SessionTestClient(_RawTestClient):
    def __enter__(self):
        client = super().__enter__()
        response = client.get("/v1/session")
        assert response.status_code == 200, response.text
        return client


TestClient = _SessionTestClient

from service.app import app  # noqa: E402
from service.config import settings  # noqa: E402
import service.integrations.ae as _ae  # noqa: E402
from service.routers import aebridge as _aebridge  # noqa: E402

# Fail loudly rather than touch anything real. This runs at import time, before
# any test can write a file.
for _r in settings.roots.all_roots():
    assert str(_r).startswith(_TMP), (
        f"REFUSING TO RUN: root {_r} is outside the test sandbox {_TMP}. "
        "A test would write into the user's real plates/render folders."
    )

# No After Effects / ffmpeg in CI: stub the OS-facing calls so the route
# contract is exercisable. (These are proven separately on macOS.)
_ae.launch_ae = lambda *a, **k: None
_ae.make_placeholder_plate = lambda *a, **k: False
# Route smoke tests use placeholder bytes instead of a real movie. The actual
# ffprobe parsing and mismatch behavior live in test_media_validation.py.
_aebridge.probe_video = lambda *a, **k: {
    "frame_rate": 23.976,
    "frame_rate_raw": "24000/1001",
    "width": 1920,
    "height": 1080,
    "frame_count": 90,
}

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


def test_protected_routes_require_session():
    with _RawTestClient(app) as c:
        assert c.get("/v1/aebridge/jobs").status_code == 401
        assert c.get("/healthz").status_code == 200


def test_non_loopback_host_rejected():
    """A page whose hostname was rebound to 127.0.0.1 must not get a session
    or reach the API: its requests carry its own hostname in Host."""
    with _RawTestClient(app, base_url="http://attacker.example:8010") as c:
        assert c.get("/v1/session").status_code == 400
        assert c.get("/v1/aebridge/jobs").status_code == 400
        assert c.get("/healthz").status_code == 400
    for base in ("http://localhost:8010", "http://127.0.0.1:8010"):
        with _RawTestClient(app, base_url=base) as c:
            assert c.get("/healthz").status_code == 200
            assert c.get("/v1/session").status_code == 200


def test_job_id_cannot_escape_job_roots():
    _seed_template()
    with TestClient(app) as c:
        response = c.post(
            "/v1/aebridge/send",
            json={"template_id": "__blank__", "job_id": "../../outside"},
        )
        assert response.status_code == 400


def test_prepare_allocates_isolated_export_directories():
    with TestClient(app) as c:
        first = c.post("/v1/aebridge/prepare", json={"name": "SHOT_010"}).json()
        second = c.post("/v1/aebridge/prepare", json={"name": "SHOT_010"}).json()
        assert first["job_id"] != second["job_id"]
        assert Path(first["export_dir"]).parent == settings.roots.export_root.resolve()
        assert Path(second["export_dir"]).parent == settings.roots.export_root.resolve()


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


def test_specific_render_validation_does_not_close_job():
    """Loose render versions validate against the sidecar without changing job state."""
    _seed_template()
    with TestClient(app) as c:
        r = c.post(
            "/v1/aebridge/send",
            json={
                "template_id": "__blank__",
                "shot": {"shot_name": "SHOT_VALIDATE", "frame_rate": "23.976", "frame_count": 90},
            },
        )
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]
        render = settings.roots.watch_root / f"{job_id}_v2.mov"
        render.write_bytes(b"RENDER")

        r = c.post(
            f"/v1/aebridge/return/{job_id}/validate-render",
            json={"path": str(render)},
        )
        assert r.status_code == 200, r.text
        assert r.json()["rate_ok"] is True
        assert _get_job(job_id).state == _JobState.ready_in_ae


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
        assert r.json()["aep_path"] == str(picked.resolve())


def test_multi_plate_send():
    _seed_template()
    with TestClient(app) as c:
        # Panel exported two plates (V1 base + V2 layer) into the plates folder.
        settings.roots.export_root.mkdir(parents=True, exist_ok=True)
        base = settings.roots.export_root / "SHOT_010.mov"
        top = settings.roots.export_root / "SHOT_010_pl02.mov"
        base.write_bytes(b"PLATE1")
        top.write_bytes(b"PLATE2")
        r = c.post(
            "/v1/aebridge/send",
            json={
                "template_id": "__blank__",
                "shot": {"shot_name": "SHOT_010"},
                "reference_path": str(base),
                "plates": [
                    {"name": "SHOT_010", "file": str(base), "track": 1, "order": 1, "offset_frames": 0},
                    {"name": "SHOT_010_pl02", "file": str(top), "track": 2, "order": 2, "offset_frames": -8},
                ],
            },
        )
        assert r.status_code == 200, r.text
        job = r.json()
        # Sidecar records the stack; the build script gets both plates.
        import json as _json
        sc = _json.loads(Path(job["sidecar_path"]).read_text())
        assert [p["name"] for p in sc["plates"]] == ["SHOT_010", "SHOT_010_pl02"]
        assert sc["plates"][1]["offset_frames"] == -8
        jsx = (Path(job["aep_path"]).parent / "build.jsx").read_text()
        assert "SHOT_010_pl02" in jsx

        # A plate outside export_root must be rejected.
        r = c.post(
            "/v1/aebridge/send",
            json={
                "template_id": "__blank__",
                "shot": {"shot_name": "SHOT_011"},
                "plates": [{"name": "evil", "file": "/etc/passwd", "track": 1, "order": 1}],
            },
        )
        assert r.status_code == 400


def test_path_escape_rejected():
    _seed_template()
    with TestClient(app) as c:
        # A non-.aep selection must be rejected by the picker.
        bad = Path(_TMP) / "notaproject.txt"
        bad.write_bytes(b"x")
        r = c.post("/v1/aebridge/pick-project", params={"path": str(bad)})
        assert r.status_code == 400


_EDL_TEXT = (
    "TITLE: STACK_TEST\n"
    "001  AX  V   C  01:00:00:00 01:00:01:00 01:00:00:00 01:00:01:00\n"
    "* FROM CLIP NAME: BASE\n"
)


def test_parse_edl_deletes_avid_generated_scratch():
    """The EDL is pure scratch once parsed — leaving it behind is what fills
    Avid's three-digit filename counter (ErrorType 1000, see HANDOFF.md).
    A file that looks like Avid's own export must be gone after a successful
    parse, whether ExportEDL returned it directly or it came back through the
    error-1000 recovery path (which archives it into edl_root first)."""
    import service.edl_recovery as _edl_recovery

    fake_avid_root = Path(_TMP) / "fake_avid_edl_exports"
    fake_avid_root.mkdir(parents=True, exist_ok=True)
    previous_recovery = _edl_recovery.AVID_GENERATED_EDL_ROOT
    previous_router = _aebridge.AVID_GENERATED_EDL_ROOT
    _edl_recovery.AVID_GENERATED_EDL_ROOT = fake_avid_root
    _aebridge.AVID_GENERATED_EDL_ROOT = fake_avid_root
    try:
        edl_path = fake_avid_root / "STACK_TEST.001.edl"
        edl_path.write_text(_EDL_TEXT, encoding="utf-8")
        with TestClient(app) as c:
            r = c.post("/v1/aebridge/parse-edl", json={"edl_path": str(edl_path)})
        assert r.status_code == 200, r.text
        clips = r.json()["clips"]
        assert [clip["clip_name"] for clip in clips] == ["BASE"]
        # Archived into edl_root by archive_generated_edl, then deleted as
        # scratch — nothing should be left at either location.
        assert not edl_path.exists()
        assert not any(settings.roots.edl_root.glob("STACK_TEST*.edl"))
    finally:
        _edl_recovery.AVID_GENERATED_EDL_ROOT = previous_recovery
        _aebridge.AVID_GENERATED_EDL_ROOT = previous_router


def test_parse_edl_can_preserve_archived_scratch_for_local_diagnosis(monkeypatch):
    """The opt-in debug flag keeps the archived EDL without changing the
    release default or leaving a file in Avid's filename-counter directory."""
    import service.edl_recovery as _edl_recovery

    fake_avid_root = Path(_TMP) / "fake_avid_edl_debug_exports"
    fake_avid_root.mkdir(parents=True, exist_ok=True)
    previous_recovery = _edl_recovery.AVID_GENERATED_EDL_ROOT
    previous_router = _aebridge.AVID_GENERATED_EDL_ROOT
    _edl_recovery.AVID_GENERATED_EDL_ROOT = fake_avid_root
    _aebridge.AVID_GENERATED_EDL_ROOT = fake_avid_root
    monkeypatch.setenv("AEBRIDGE_KEEP_EDL", "1")
    try:
        edl_path = fake_avid_root / "STACK_EFFECT_TEST.001.edl"
        edl_path.write_text(_EDL_TEXT.replace("STACK_TEST", "STACK_EFFECT_TEST"), encoding="utf-8")
        with TestClient(app) as c:
            r = c.post("/v1/aebridge/parse-edl", json={"edl_path": str(edl_path)})
        assert r.status_code == 200, r.text
        assert not edl_path.exists()
        archived = list(settings.roots.edl_root.glob("STACK_EFFECT_TEST*.edl"))
        assert len(archived) == 1
        archived[0].unlink()
    finally:
        _edl_recovery.AVID_GENERATED_EDL_ROOT = previous_recovery
        _aebridge.AVID_GENERATED_EDL_ROOT = previous_router


def test_parse_edl_rejects_a_manual_edl_outside_allowed_roots():
    """EDL parsing is limited to Avid/helper-owned roots."""
    manual = Path(_TMP) / "manual_edls" / "hand_made.edl"
    manual.parent.mkdir(parents=True, exist_ok=True)
    manual.write_text(_EDL_TEXT, encoding="utf-8")
    with TestClient(app) as c:
        r = c.post("/v1/aebridge/parse-edl", json={"edl_path": str(manual)})
    assert r.status_code == 400, r.text
    assert manual.exists()


# --- helpers to reach into the in-memory store for simulation ---
from service.jobs import store as _store  # noqa: E402
from service.models import JobState as _JobState  # noqa: E402


def _get_job(job_id):
    return _store.get(job_id)


def test_renders_feature_is_advertised():
    """Every route the panel calls blindly must be behind a feature id, or a
    stale helper (it never hot-reloads) gives the panel a raw 404 to swallow."""
    with TestClient(app) as c:
        ids = c.get("/v1/version").json()["feature_ids"]
        assert "aebridge.renders" in ids, ids


def test_missing_plate_reported():
    """Deleting a plate off disk must surface on the job, so the panel can
    offer to drop a job that can never be re-rendered."""
    _seed_template()
    with TestClient(app) as c:
        settings.roots.export_root.mkdir(parents=True, exist_ok=True)
        plate = settings.roots.export_root / "GONE_010.mov"
        plate.write_bytes(b"PLATE")
        r = c.post(
            "/v1/aebridge/send",
            json={
                "template_id": "__blank__",
                "shot": {"shot_name": "GONE_010"},
                "reference_path": str(plate),
            },
        )
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]
        assert r.json()["plates_missing"] == []

        plate.unlink()  # editor cleaned out the plates folder
        jobs = c.get("/v1/aebridge/jobs").json()
        me = next(j for j in jobs if j["job_id"] == job_id)
        assert me["plates_missing"] == ["GONE_010.mov"], me


def test_renders_listing_and_reset():
    """Every file in the render folder is listed - including extra versions AE
    emitted from one comp - with an imported flag, and hard reset clears the
    queue without touching files on disk."""
    _seed_template()
    with TestClient(app) as c:
        settings.roots.watch_root.mkdir(parents=True, exist_ok=True)
        v1 = settings.roots.watch_root / "SHOT_V.mov"
        v2 = settings.roots.watch_root / "SHOT_V_v2.mov"
        v1.write_bytes(b"RENDER1")
        v2.write_bytes(b"RENDER2")

        listed = c.get("/v1/aebridge/renders").json()
        names = {r["name"] for r in listed}
        assert {"SHOT_V.mov", "SHOT_V_v2.mov"} <= names, names
        assert all(r["imported"] is False for r in listed if r["name"] in names)

        # Marking one imported must stick, and only for that file.
        assert c.post("/v1/aebridge/renders/imported", json={"path": str(v2)}).status_code == 200
        by_name = {r["name"]: r for r in c.get("/v1/aebridge/renders").json()}
        assert by_name["SHOT_V_v2.mov"]["imported"] is True
        assert by_name["SHOT_V.mov"]["imported"] is False

        # A render outside watch_root must be refused.
        assert c.post("/v1/aebridge/renders/imported", json={"path": "/etc/passwd"}).status_code == 400

        # Hard reset drops jobs but leaves the media alone.
        c.post("/v1/aebridge/send", json={
            "template_id": "__blank__", "shot": {"shot_name": "STUCK_001"},
        })
        assert len(c.get("/v1/aebridge/jobs").json()) > 0
        c.post("/v1/aebridge/reset")
        assert c.get("/v1/aebridge/jobs").json() == []
        assert v1.exists() and v2.exists()

        # ...and imported renders STAY imported. They are in Avid whatever the
        # job queue says, and the editor may have moved the clip to another bin;
        # re-offering them would invite a duplicate import.
        by_name = {r["name"]: r for r in c.get("/v1/aebridge/renders").json()}
        assert by_name["SHOT_V_v2.mov"]["imported"] is True
        assert by_name["SHOT_V.mov"]["imported"] is False


def test_rerender_to_same_name_is_not_imported():
    """Deleting a render and re-rendering to the SAME filename must come back as
    new. Keying import history on the path alone made re-renders show as
    'in bin' forever, with no way to import the replacement."""
    import os
    import time as _time

    with TestClient(app) as c:
        settings.roots.watch_root.mkdir(parents=True, exist_ok=True)
        f = settings.roots.watch_root / "REDO_010.mov"
        f.write_bytes(b"FIRST RENDER")
        assert c.post("/v1/aebridge/renders/imported", json={"path": str(f)}).status_code == 200
        by_name = {r["name"]: r for r in c.get("/v1/aebridge/renders").json()}
        assert by_name["REDO_010.mov"]["imported"] is True

        # Editor deletes it and renders again to the same name.
        f.unlink()
        _time.sleep(0.01)
        f.write_bytes(b"SECOND RENDER, DIFFERENT LENGTH")
        os.utime(f, (_time.time() + 5, _time.time() + 5))  # ensure a distinct mtime

        by_name = {r["name"]: r for r in c.get("/v1/aebridge/renders").json()}
        assert by_name["REDO_010.mov"]["imported"] is False, "re-render still looked imported"

        # Importing the replacement marks the NEW file, not the old record.
        assert c.post("/v1/aebridge/renders/imported", json={"path": str(f)}).status_code == 200
        by_name = {r["name"]: r for r in c.get("/v1/aebridge/renders").json()}
        assert by_name["REDO_010.mov"]["imported"] is True


def test_imported_renders_survive_helper_restart():
    """Import history is persisted: a fresh Store (i.e. a helper restart) must
    still know what has already been pulled into Avid."""
    from service.jobs import Store

    with TestClient(app) as c:
        settings.roots.watch_root.mkdir(parents=True, exist_ok=True)
        f = settings.roots.watch_root / "PERSIST_ME.mov"
        f.write_bytes(b"RENDER")
        assert c.post("/v1/aebridge/renders/imported", json={"path": str(f)}).status_code == 200

    fresh = Store()  # stands in for a restarted helper
    assert fresh.is_render_imported(f), "import history did not persist"


if __name__ == "__main__":
    test_version_and_templates()
    test_new_per_shot_roundtrip()
    test_existing_project_requires_token()
    test_existing_project_via_picked_token()
    test_multi_plate_send()
    test_path_escape_rejected()
    test_parse_edl_deletes_avid_generated_scratch()
    test_parse_edl_leaves_a_manual_edl_alone()
    test_renders_feature_is_advertised()
    test_missing_plate_reported()
    test_renders_listing_and_reset()
    test_rerender_to_same_name_is_not_imported()
    test_imported_renders_survive_helper_restart()
    print("ALL SMOKE TESTS PASSED")
