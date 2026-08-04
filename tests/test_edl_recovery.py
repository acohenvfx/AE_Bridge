"""Regression coverage for Avid's write-then-error ExportEDL behavior."""
from pathlib import Path
from tempfile import TemporaryDirectory
import time

from service import edl_recovery
from service.edl_recovery import archive_generated_edl, find_recent_edl


def test_finds_only_the_fresh_matching_sequence_edl():
    with TemporaryDirectory() as raw:
        root = Path(raw)
        old = root / "OLD.edl"
        old.write_text("TITLE: DE_DEMO_NEW\n", encoding="utf-8")
        unrelated = root / "OTHER.edl"
        unrelated.write_text("TITLE: OTHER_SEQUENCE\n", encoding="utf-8")
        since_ms = int(time.time() * 1000)
        fresh = root / "DE_DEMO_NEW.edl"
        fresh.write_text("TITLE: DE_DEMO_NEW\n001 AX V C 00:00:00:00 00:00:01:00 01:00:00:00 01:00:01:00\n", encoding="utf-8")

        assert find_recent_edl("DE_DEMO_NEW", since_ms, [root]) == fresh.resolve()
        assert find_recent_edl("MISSING", since_ms, [root]) is None


def test_archives_only_avid_generated_edls():
    with TemporaryDirectory() as raw:
        base = Path(raw)
        avid_root = base / "Avid Users"
        destination = base / "Desktop" / "AEBridge" / "edl"
        avid_root.mkdir()
        generated = avid_root / "SEQUENCE.edl"
        generated.write_text("TITLE: SEQUENCE\n", encoding="utf-8")
        previous = edl_recovery.AVID_GENERATED_EDL_ROOT
        edl_recovery.AVID_GENERATED_EDL_ROOT = avid_root
        try:
            archived = archive_generated_edl(generated, destination)
        finally:
            edl_recovery.AVID_GENERATED_EDL_ROOT = previous
        assert archived.parent == destination.resolve()
        assert archived.read_text(encoding="utf-8") == "TITLE: SEQUENCE\n"
        assert not generated.exists()


if __name__ == "__main__":
    test_finds_only_the_fresh_matching_sequence_edl()
    test_archives_only_avid_generated_edls()
    print("EDL RECOVERY TESTS PASSED")
