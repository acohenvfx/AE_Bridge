"""Device-bound AE Bridge licensing with offline signed leases.

Only explicit licensing metadata leaves the Mac. Refresh credentials are kept
in macOS Keychain and are never returned by the localhost helper API.
"""
from __future__ import annotations

import base64
import json
import os
import platform
import re
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    encode_dss_signature,
)

PRODUCT_ID = 'ae_bridge'
DEFAULT_API_URL = 'https://avid-license-service.andrewcohenvfx.workers.dev'
# Public verification key shared by the existing production licensing service.
DEFAULT_PUBLIC_JWK = '{"kty":"EC","crv":"P-256","x":"ihmeRCjNJm84FHUZGT9qLsEjQwXL2Hl16Wa0wRw7mFc","y":"EowOyBwsMKUasbM7GJrF1xjHzkr__QIhuFiydlEUknk"}'
KEYCHAIN_SERVICE = 'com.acohenvfx.aebridge.license'
KEYCHAIN_ACCOUNT = 'device-credentials-v1'
MAX_RESPONSE_BYTES = 64 * 1024
MAX_LEASE_BYTES = 16 * 1024
REMOTE_CHECK_TTL_SECONDS = 300
USABLE_SUBSCRIPTION_STATES = frozenset({'active', 'trialing', 'past_due'})
_remote_checked_at = 0.0
_remote_state: dict[str, Any] | None = None
CREDENTIAL_CACHE_TTL_SECONDS = 60
# (cache key, monotonic expiry, credentials or None)
_credential_cache: tuple[tuple[str, str], float, dict[str, str] | None] | None = None


class LicenseError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def _support_dir() -> Path:
    override = os.environ.get('AEBRIDGE_LICENSE_SUPPORT_DIR', '').strip()
    return Path(override).expanduser() if override else (
        Path.home() / 'Library' / 'Application Support' / 'AE Bridge'
    )


def _private_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    try:
        temporary.write_text(text, encoding='utf-8')
        temporary.chmod(0o600)
        temporary.replace(path)
        path.chmod(0o600)
    finally:
        temporary.unlink(missing_ok=True)


def _installation_id() -> str:
    path = _support_dir() / 'installation-id'
    try:
        value = path.read_text(encoding='utf-8').strip()
        return str(uuid.UUID(value))
    except (FileNotFoundError, ValueError):
        value = str(uuid.uuid4())
        _private_write(path, value)
        return value


def _file_credentials_allowed() -> bool:
    return (
        os.environ.get('AEBRIDGE_LICENSE_ENV', '').strip() == 'local'
        and os.environ.get('AEBRIDGE_LICENSE_CREDENTIAL_BACKEND', '').strip() == 'file'
    )


def _credentials_path() -> Path:
    return _support_dir() / 'local-test-credentials.json'


def _store_credentials(credentials: dict[str, str]) -> None:
    _invalidate_credential_cache()
    encoded = json.dumps(credentials, separators=(',', ':'), sort_keys=True)
    if _file_credentials_allowed():
        _private_write(_credentials_path(), encoded)
        return
    if platform.system().lower() != 'darwin':
        raise LicenseError(501, 'keychain_unavailable', 'macOS Keychain is required')
    result = subprocess.run(
        [
            '/usr/bin/security',
            'add-generic-password',
            '-U',
            '-s',
            KEYCHAIN_SERVICE,
            '-a',
            KEYCHAIN_ACCOUNT,
            '-w',
            encoded,
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=15,
    )
    if result.returncode != 0:
        raise LicenseError(500, 'keychain_write_failed', 'Could not save license credentials')


class _TransientCredentialError(Exception):
    """The credential store could not be read right now; don't cache that."""


def _credential_cache_key() -> tuple[str, str]:
    if _file_credentials_allowed():
        return ('file', str(_credentials_path()))
    return ('keychain', f'{KEYCHAIN_SERVICE}/{KEYCHAIN_ACCOUNT}')


def _invalidate_credential_cache() -> None:
    global _credential_cache
    _credential_cache = None


def _load_credentials() -> dict[str, str] | None:
    """Stored device credentials, cached briefly in memory.

    Every license-gated request and every render-watcher tick asks for these.
    Uncached, each ask spawned `/usr/bin/security` (twice per request). The
    helper is the only writer and invalidates on store/delete, so a short TTL
    only bounds how long an out-of-band Keychain edit goes unnoticed.
    """
    global _credential_cache
    key = _credential_cache_key()
    now = time.monotonic()
    cached = _credential_cache
    if cached is not None and cached[0] == key and now < cached[1]:
        return dict(cached[2]) if cached[2] is not None else None
    try:
        value = _read_credentials()
    except _TransientCredentialError:
        return None
    _credential_cache = (key, now + CREDENTIAL_CACHE_TTL_SECONDS, value)
    return dict(value) if value is not None else None


def _read_credentials() -> dict[str, str] | None:
    if _file_credentials_allowed():
        try:
            value = json.loads(_credentials_path().read_text(encoding='utf-8'))
        except (FileNotFoundError, json.JSONDecodeError):
            return None
    else:
        if platform.system().lower() != 'darwin':
            return None
        try:
            result = subprocess.run(
                [
                    '/usr/bin/security',
                    'find-generic-password',
                    '-s',
                    KEYCHAIN_SERVICE,
                    '-a',
                    KEYCHAIN_ACCOUNT,
                    '-w',
                ],
                capture_output=True,
                text=True,
                check=False,
                timeout=15,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            # Previously an uncaught TimeoutExpired surfaced as a 500.
            raise _TransientCredentialError() from exc
        if result.returncode != 0:
            return None
        try:
            value = json.loads(result.stdout)
        except json.JSONDecodeError:
            return None
    if not isinstance(value, dict):
        return None
    device_id = value.get('deviceId')
    refresh_token = value.get('refreshToken')
    if not isinstance(device_id, str) or not isinstance(refresh_token, str):
        return None
    return {'deviceId': device_id, 'refreshToken': refresh_token}


def _delete_credentials() -> None:
    _invalidate_credential_cache()
    if _file_credentials_allowed():
        _credentials_path().unlink(missing_ok=True)
        return
    if platform.system().lower() == 'darwin':
        subprocess.run(
            [
                '/usr/bin/security',
                'delete-generic-password',
                '-s',
                KEYCHAIN_SERVICE,
                '-a',
                KEYCHAIN_ACCOUNT,
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )


def _decode_segment(value: str) -> bytes:
    if not value or re.fullmatch(r'[A-Za-z0-9_-]+', value) is None:
        raise LicenseError(401, 'invalid_lease', 'License lease is malformed')
    try:
        padding = '=' * (-len(value) % 4)
        return base64.urlsafe_b64decode((value + padding).encode('ascii'))
    except Exception as exc:
        raise LicenseError(401, 'invalid_lease', 'License lease is malformed') from exc


def _pinned_public_jwk() -> dict[str, Any]:
    raw = os.environ.get('AEBRIDGE_LICENSE_PUBLIC_JWK', DEFAULT_PUBLIC_JWK).strip()
    if not raw:
        raise LicenseError(503, 'license_not_configured', 'License public key is not configured')
    try:
        key = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LicenseError(503, 'license_not_configured', 'License public key is invalid') from exc
    if not isinstance(key, dict) or key.get('kty') != 'EC' or key.get('crv') != 'P-256':
        raise LicenseError(503, 'license_not_configured', 'License public key is invalid')
    if not isinstance(key.get('x'), str) or not isinstance(key.get('y'), str):
        raise LicenseError(503, 'license_not_configured', 'License public key is invalid')
    return key


def verify_lease(
    lease: str,
    *,
    expected_device_id: str | None = None,
    now: int | None = None,
) -> dict[str, Any]:
    if not isinstance(lease, str) or len(lease.encode('utf-8')) > MAX_LEASE_BYTES:
        raise LicenseError(401, 'invalid_lease', 'License lease is invalid')
    parts = lease.split('.')
    if len(parts) != 3 or not all(parts):
        raise LicenseError(401, 'invalid_lease', 'License lease is malformed')
    try:
        header = json.loads(_decode_segment(parts[0]))
        payload = json.loads(_decode_segment(parts[1]))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise LicenseError(401, 'invalid_lease', 'License lease is malformed') from exc
    if not isinstance(header, dict) or not isinstance(payload, dict):
        raise LicenseError(401, 'invalid_lease', 'License lease is malformed')
    if (
        header.get('alg') != 'ES256'
        or header.get('typ') != 'AVID-LICENSE'
        or header.get('kid') != 'v1'
    ):
        raise LicenseError(401, 'invalid_lease', 'License lease header is invalid')

    jwk = _pinned_public_jwk()
    try:
        x_bytes = _decode_segment(jwk['x'])
        y_bytes = _decode_segment(jwk['y'])
        if len(x_bytes) != 32 or len(y_bytes) != 32:
            raise ValueError('invalid P-256 coordinate length')
        x = int.from_bytes(x_bytes, 'big')
        y = int.from_bytes(y_bytes, 'big')
        public_key = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1()).public_key()
    except (LicenseError, ValueError) as exc:
        raise LicenseError(503, 'license_not_configured', 'License public key is invalid') from exc
    signature = _decode_segment(parts[2])
    if len(signature) != 64:
        raise LicenseError(401, 'invalid_lease', 'License signature is invalid')
    der_signature = encode_dss_signature(
        int.from_bytes(signature[:32], 'big'),
        int.from_bytes(signature[32:], 'big'),
    )
    try:
        public_key.verify(
            der_signature,
            f'{parts[0]}.{parts[1]}'.encode('ascii'),
            ec.ECDSA(hashes.SHA256()),
        )
    except InvalidSignature as exc:
        raise LicenseError(401, 'invalid_lease', 'License signature is invalid') from exc

    current = int(time.time()) if now is None else now
    required_strings = ('leaseId', 'customerId', 'productId', 'deviceId', 'subscriptionState')
    if (
        payload.get('version') != 1
        or any(not isinstance(payload.get(name), str) or not payload[name] for name in required_strings)
        or payload.get('productId') != PRODUCT_ID
        or not isinstance(payload.get('issuedAt'), int)
        or payload['issuedAt'] > current + 60
        or not isinstance(payload.get('expiresAt'), int)
        or payload['expiresAt'] <= current
        or not isinstance(payload.get('features'), list)
        or PRODUCT_ID not in payload['features']
    ):
        raise LicenseError(403, 'license_inactive', 'License lease is expired or invalid')
    if expected_device_id and payload['deviceId'] != expected_device_id:
        raise LicenseError(401, 'invalid_lease', 'License belongs to another device')
    return payload


def _api_base_url() -> str:
    raw = os.environ.get('AEBRIDGE_LICENSE_API_URL', DEFAULT_API_URL).strip().rstrip('/')
    if not raw:
        raise LicenseError(503, 'license_not_configured', 'License service URL is not configured')
    parsed = urlparse(raw)
    loopback = parsed.hostname in ('localhost', '127.0.0.1', '::1')
    if (
        parsed.scheme not in ('http', 'https')
        or (parsed.scheme != 'https' and not loopback)
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise LicenseError(503, 'license_not_configured', 'License service URL is invalid')
    return raw


def _post_json(path: str, body: dict[str, Any]) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            with client.stream('POST', f'{_api_base_url()}{path}', json=body) as response:
                chunks = []
                total = 0
                for chunk in response.iter_bytes():
                    total += len(chunk)
                    if total > MAX_RESPONSE_BYTES:
                        raise LicenseError(502, 'license_service_error', 'License response is too large')
                    chunks.append(chunk)
                raw = b''.join(chunks)
    except LicenseError:
        raise
    except httpx.HTTPError as exc:
        raise LicenseError(503, 'license_service_unavailable', 'Could not reach license service') from exc
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise LicenseError(502, 'license_service_error', 'License service returned invalid data') from exc
    if not isinstance(data, dict):
        raise LicenseError(502, 'license_service_error', 'License service returned invalid data')
    if response.status_code >= 400:
        code = data.get('error') if isinstance(data.get('error'), str) else 'license_service_error'
        message = data.get('message') if isinstance(data.get('message'), str) else 'License request failed'
        raise LicenseError(response.status_code, code, message)
    return data


def _save_lease(lease: str, payload: dict[str, Any]) -> None:
    _private_write(
        _support_dir() / 'license-lease.json',
        json.dumps({'lease': lease, 'payload': payload}, separators=(',', ':'), sort_keys=True),
    )


def _load_verified_lease(credentials: dict[str, str] | None = None) -> dict[str, Any] | None:
    try:
        saved = json.loads((_support_dir() / 'license-lease.json').read_text(encoding='utf-8'))
        lease = saved['lease']
    except (FileNotFoundError, KeyError, TypeError, json.JSONDecodeError):
        return None
    expected = credentials['deviceId'] if credentials else None
    return verify_lease(lease, expected_device_id=expected)


def activate_license(activation_code: str, device_name: str | None = None) -> dict[str, Any]:
    code = activation_code.strip()
    if not code or len(code) > 128:
        raise LicenseError(400, 'invalid_request', 'Activation code is invalid')
    response = _post_json(
        '/v1/activations/redeem',
        {
            'activationCode': code,
            'productId': PRODUCT_ID,
            'deviceFingerprint': _installation_id(),
            'deviceName': (device_name or platform.node() or 'Mac').strip()[:128],
        },
    )
    device_id = response.get('deviceId')
    refresh_token = response.get('refreshToken')
    lease = response.get('lease')
    if not all(isinstance(value, str) and value for value in (device_id, refresh_token, lease)):
        raise LicenseError(502, 'license_service_error', 'Activation response is incomplete')
    payload = verify_lease(lease, expected_device_id=device_id)
    _store_credentials({'deviceId': device_id, 'refreshToken': refresh_token})
    _invalidate_credential_cache()  # drop any read that raced the write
    _save_lease(lease, payload)
    _invalidate_remote_status_cache()
    return _public_state(payload)


def refresh_license() -> dict[str, Any]:
    credentials = _load_credentials()
    if not credentials:
        raise LicenseError(401, 'not_activated', 'AE Bridge is not activated')
    response = _post_json(
        '/v1/license/check',
        {
            'deviceId': credentials['deviceId'],
            'refreshToken': credentials['refreshToken'],
            'productId': PRODUCT_ID,
        },
    )
    lease = response.get('lease')
    if not isinstance(lease, str) or not lease:
        raise LicenseError(502, 'license_service_error', 'License response is incomplete')
    payload = verify_lease(lease, expected_device_id=credentials['deviceId'])
    _save_lease(lease, payload)
    _invalidate_remote_status_cache()
    return _public_state(payload)


def deactivate_license() -> dict[str, bool]:
    credentials = _load_credentials()
    already_deactivated = False
    if credentials:
        try:
            _post_json(
                '/v1/license/deactivate',
                {
                    'deviceId': credentials['deviceId'],
                    'refreshToken': credentials['refreshToken'],
                },
            )
        except LicenseError as exc:
            # Deactivation is intentionally idempotent from the user's point
            # of view. A lost response, a prior account-side deactivation, or
            # a stale Keychain credential can leave the Worker already
            # rejecting the token. In each case the safe local result is the
            # same: remove the credential and cached lease.
            if exc.code in ('invalid_device_token', 'not_activated'):
                already_deactivated = True
            else:
                raise
    _delete_credentials()
    _invalidate_credential_cache()  # drop any read that raced the delete
    (_support_dir() / 'license-lease.json').unlink(missing_ok=True)
    _invalidate_remote_status_cache()
    return {'deactivated': True, 'alreadyDeactivated': already_deactivated}


def _public_state(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        'state': payload['subscriptionState'],
        'productId': payload['productId'],
        'deviceId': payload['deviceId'],
        'expiresAt': payload['expiresAt'],
        'offline': True,
        # The lease has already passed signature, product, feature, device,
        # and expiry validation. past_due remains usable only for the short
        # grace period encoded in the signed lease by the license service.
        'usable': payload['subscriptionState'] in USABLE_SUBSCRIPTION_STATES,
    }


def license_status() -> dict[str, Any]:
    configured = bool(
        os.environ.get('AEBRIDGE_LICENSE_API_URL', DEFAULT_API_URL).strip()
        and os.environ.get('AEBRIDGE_LICENSE_PUBLIC_JWK', DEFAULT_PUBLIC_JWK).strip()
    )
    # Fail closed unless a developer deliberately opts out for local testing.
    enforced = os.environ.get('AEBRIDGE_LICENSE_ENFORCED', '1').strip() == '1'
    if not configured:
        return {'state': 'not_configured', 'enforced': enforced, 'usable': not enforced}
    credentials = _load_credentials()
    if not credentials:
        return {'state': 'not_activated', 'enforced': enforced, 'usable': not enforced}
    try:
        payload = _load_verified_lease(credentials)
    except LicenseError as exc:
        return {'state': exc.code, 'enforced': enforced, 'usable': not enforced}
    if payload is None:
        return {'state': 'lease_missing', 'enforced': enforced, 'usable': not enforced}
    state = _public_state(payload)
    state['enforced'] = enforced
    return state


def _invalidate_remote_status_cache() -> None:
    global _remote_checked_at, _remote_state
    _remote_checked_at = 0.0
    _remote_state = None


def license_status_for_helper() -> dict[str, Any]:
    """Return local lease state and periodically confirm it with the Worker.

    A valid signed lease keeps the product usable during a short outage, but
    an online check every five minutes notices cancellation or deactivation
    promptly instead of waiting for the lease's offline TTL to end.
    """
    global _remote_checked_at, _remote_state
    local = license_status()
    if not local.get('enforced') or not _load_credentials():
        return local
    now = time.monotonic()
    if (
        _remote_state is not None
        and local.get('deviceId')
        and now - _remote_checked_at < REMOTE_CHECK_TTL_SECONDS
    ):
        return dict(_remote_state)
    try:
        refreshed = refresh_license()
        state = dict(refreshed)
        state['enforced'] = True
    except LicenseError as exc:
        if exc.code in ('license_inactive', 'invalid_device_token', 'not_activated'):
            state = {
                'state': 'license_inactive',
                'enforced': True,
                'usable': False,
                'reason': exc.message,
            }
        else:
            # Network failures do not immediately lock out a customer with a
            # still-valid signed lease; the lease expiry remains the final
            # offline boundary.
            state = dict(local)
            state['onlineCheck'] = 'unavailable'
    _remote_checked_at = now
    _remote_state = dict(state)
    return state
