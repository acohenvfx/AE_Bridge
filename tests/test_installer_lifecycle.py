"""Regression checks for the install-time Media Composer lifecycle."""
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INSTALLER = (ROOT / "installer" / "app-main.sh").read_text(encoding="utf-8")
DMG_BUILDER = (ROOT / "installer" / "make-dmg.sh").read_text(encoding="utf-8")
NATIVE_LAUNCHER = (ROOT / "installer" / "installer-launcher.swift").read_text(encoding="utf-8")
VERSIONING = ROOT / "installer" / "versioning.sh"


def test_installer_fully_quits_avid_before_copying_avpi():
    lifecycle = INSTALLER.index("prepare_avid_for_panel_install")
    lifecycle_call = INSTALLER.index("prepare_avid_for_panel_install", lifecycle + 1)
    avpi_copy = INSTALLER.index('cp "$AVPI_SRC"')
    assert lifecycle_call < avpi_copy
    assert "avid_pids" in INSTALLER
    assert 'tell application id "com.avid.mediacomposer" to quit' not in INSTALLER
    assert 'Closing only the project or its windows is not enough' in INSTALLER
    assert "A Mac restart is not required" in INSTALLER


def test_installer_offers_a_verified_relaunch():
    assert "offer_to_open_avid" in INSTALLER
    assert 'open "$AVID_APP_PATH"' in INSTALLER
    assert 'buttons {"Done", "Open Avid"}' in INSTALLER
    assert 'tell application "System Events"' not in INSTALLER


def test_installer_cannot_report_success_without_a_panel():
    assert 'die "the bundled Avid panel is missing from this installer"' in INSTALLER
    assert "no .avpi in the DMG; skipping panel install" not in INSTALLER


def test_release_uses_and_validates_the_signed_localhost_panel():
    assert 'dist/AEBridge_v1.0.0.avpi' in DMG_BUILDER
    assert 'dist/AEBridge_Remote.avpi' not in DMG_BUILDER.split('AVPI="', 1)[-1]
    for source in (DMG_BUILDER, INSTALLER):
        assert '"name": "com.acohenvfx.aebridge"' in source
        assert '"displayName": "AEBridge"' in source
        assert '"displayText": "AEBridge"' in source
        assert '"url": "http://localhost:8010/app"' in source
        assert "<ds:Signature " in source
        assert "<ds:X509Certificate>" in source


def test_installer_uses_the_same_native_app_shape_as_elemental_bender():
    assert '"installer/installer-launcher.swift"' in DMG_BUILDER
    assert "swiftc -O -target arm64-apple-macos13.0" in DMG_BUILDER
    assert "swiftc -O -target x86_64-apple-macos13.0" in DMG_BUILDER
    assert 'url(forResource: "installer-main", withExtension: "sh")' in NATIVE_LAUNCHER
    assert "NSApp.setActivationPolicy(.regular)" in NATIVE_LAUNCHER


def test_rc_marketing_version_has_numeric_apple_bundle_version():
    result = __import__("subprocess").run(
        [
            "bash",
            "-c",
            'source "$1"; aebridge_bundle_version 1.0.0-rc.1',
            "bash",
            str(VERSIONING),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == "1.0.0.1"
    assert "<key>CFBundleVersion</key><string>$BUNDLE_VERSION</string>" in DMG_BUILDER


def test_release_selects_and_revalidates_the_native_helper():
    assert 'SEED_ARCH="$(physical_arch)"' in INSTALLER
    assert 'helper/$SEED_ARCH/AEBridgeHelper.app' in INSTALLER
    assert 'validate_helper_bundle "$SEED_APP" "$SEED_ARCH"' in INSTALLER
    assert 'validate_helper_bundle "$APP_PATH" "$SEED_ARCH"' in INSTALLER
    assert 'validate_helper_seed arm64 "$HELPER_ARM64" "$HELPER_VERSION"' in DMG_BUILDER
    assert 'validate_helper_seed x86_64 "$HELPER_X86_64" "$HELPER_VERSION"' in DMG_BUILDER
    assert "CFBundleShortVersionString" in DMG_BUILDER


if __name__ == "__main__":
    test_installer_fully_quits_avid_before_copying_avpi()
    test_installer_offers_a_verified_relaunch()
    test_installer_cannot_report_success_without_a_panel()
    test_release_uses_and_validates_the_signed_localhost_panel()
    test_installer_uses_the_same_native_app_shape_as_elemental_bender()
    test_rc_marketing_version_has_numeric_apple_bundle_version()
    test_release_selects_and_revalidates_the_native_helper()
    print("INSTALLER LIFECYCLE TESTS PASSED")
