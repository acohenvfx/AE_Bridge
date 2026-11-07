"""Regression checks for the helper OTA release contract."""
from pathlib import Path
import os
import subprocess


ROOT = Path(__file__).resolve().parent.parent
LAUNCHER = ROOT / "ota" / "AEBridgeLauncher.sh"
WORKFLOW = (ROOT / ".github" / "workflows" / "release-helper.yml").read_text(
    encoding="utf-8"
)


def _launcher(expression: str, **overrides: str) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ, AEBRIDGE_LAUNCHER_LIBRARY_ONLY="1")
    env.pop("AEBRIDGE_UI_ORIGIN", None)
    env["AEBRIDGE_UI_CHANNEL_FILE"] = os.devnull
    env.update(overrides)
    return subprocess.run(
        ["bash", "-c", f'source "$1"; {expression}', "bash", str(LAUNCHER)],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )


def test_launcher_uses_isolated_stable_channel():
    source = LAUNCHER.read_text(encoding="utf-8")
    assert "/releases/download/helper-latest" in source
    assert "releases/latest/download" not in source


def test_installed_launcher_defaults_to_bundled_ui(tmp_path):
    result = _launcher('printf %s "$AEBRIDGE_UI_ORIGIN"')
    assert result.returncode == 0
    assert result.stdout == ""

    channel = tmp_path / "ui-channel"
    channel.write_text("cloudflare\n", encoding="utf-8")
    result = _launcher(
        'printf %s "$AEBRIDGE_UI_ORIGIN"',
        AEBRIDGE_UI_CHANNEL_FILE=str(channel),
    )
    assert result.returncode == 0
    assert result.stdout == "https://ae-bridge.andrewcohenvfx.workers.dev"


def test_semver_orders_each_numeric_component():
    assert _launcher("semver_lt 0.3.9 0.3.16").returncode == 0
    assert _launcher("semver_lt 0.3.16 0.4.0").returncode == 0
    assert _launcher("semver_lt 1.0.0 0.99.99").returncode != 0
    assert _launcher("semver_lt 0.3.16 0.3.16").returncode != 0


def test_legacy_tag_state_normalizes_but_invalid_metadata_does_not():
    result = _launcher("normalize_local_version helper-v0.0.4")
    assert result.returncode == 0
    assert result.stdout.strip() == "0.0.4"
    assert _launcher("normalize_local_version 1.2.3").stdout.strip() == "1.2.3"
    assert _launcher("normalize_local_version helper-v1.2.3-rc1").returncode != 0


def test_ci_publishes_complete_immutable_and_stable_releases():
    assert "actions/upload-artifact@v4" in WORKFLOW
    assert "actions/download-artifact@v4" in WORKFLOW
    assert "tag_name: helper-latest" in WORKFLOW
    assert 'echo "version=${TAG#helper-v}"' in WORKFLOW
    assert 'printf \'%s\\n\' "${{ steps.ver.outputs.version }}" > out/version.txt' in WORKFLOW
    assert "make_latest: true" not in WORKFLOW
    assert "overwrite_files: true" in WORKFLOW
