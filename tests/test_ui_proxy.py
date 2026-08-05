"""Tests for the hosted-UI proxy (OTA panel updates without re-signing)."""
import service.routers.ui_proxy as ui_proxy
from service.routers.ui import CSP


def test_api_namespaces_are_never_proxied():
    """A stray proxy match would silently send API calls to the hosted origin."""
    for path in ("v1", "v1/version", "v1/aebridge/jobs", "healthz"):
        assert ui_proxy.is_local_only(path), path
    for path in ("app", "_nuxt/app.js", "", "favicon.ico", "v1x", "healthzz"):
        assert not ui_proxy.is_local_only(path), path


def test_request_headers_force_identity_encoding():
    """Avid's WebView advertises Brotli, but the proxy strips Content-Encoding
    from responses — so bytes and headers must agree via identity."""
    out = ui_proxy.filter_request_headers(
        {
            "accept-encoding": "gzip, br",
            "host": "localhost:8010",
            "content-length": "12",
            "connection": "keep-alive",
            "user-agent": "Avid",
        }
    )
    assert out["accept-encoding"] == "identity"
    # Host must not be forwarded: it belongs to the localhost hop and the
    # hosted origin would reject it.
    assert "host" not in out
    assert "content-length" not in out
    assert "connection" not in out
    assert out["user-agent"] == "Avid"


def test_response_headers_drop_hop_by_hop_and_replace_csp_on_html():
    upstream = {
        "content-encoding": "br",
        "transfer-encoding": "chunked",
        "content-length": "999",
        "strict-transport-security": "max-age=31536000",
        "content-security-policy": "script-src 'self'",  # hosted CSP, no unsafe-eval
        "cache-control": "public, max-age=0",
    }
    html = ui_proxy.filter_response_headers(upstream, is_html=True)
    for dropped in (
        "content-encoding",
        "transfer-encoding",
        "content-length",
        "strict-transport-security",
    ):
        assert dropped not in html
    # The panel's own CSP wins, so a hosted policy missing 'unsafe-eval'
    # cannot break the Nuxt 2 bundle that requires it.
    assert html["Content-Security-Policy"] == CSP
    assert "unsafe-eval" in html["Content-Security-Policy"]
    assert html["cache-control"] == "public, max-age=0"

    # Non-HTML (JS, CSS, images) gets no CSP of its own.
    asset = ui_proxy.filter_response_headers(upstream, is_html=False)
    assert "Content-Security-Policy" not in asset


def test_proxy_is_off_by_default_so_a_working_install_is_unchanged():
    """The hosted build can be stale or failing; opting in must be deliberate."""
    import os

    assert ui_proxy.UI_ORIGIN == os.environ.get("AEBRIDGE_UI_ORIGIN", "").strip().rstrip("/")
    if not os.environ.get("AEBRIDGE_UI_ORIGIN"):
        assert ui_proxy.UI_ORIGIN == ""
        # With it unset, app.py serves the local UI router instead.
        from service.app import app

        assert any(getattr(r, "path", None) == "/app" for r in app.routes)
