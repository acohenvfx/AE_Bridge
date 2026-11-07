"""Signed trial leases must expire and belong to AE Bridge on this device."""
import base64
import json
import os
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from service import licensing

def encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b'=').decode()

class LicenseTests(unittest.TestCase):
    def setUp(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        numbers = self.key.public_key().public_numbers()
        self.jwk = json.dumps({'kty': 'EC', 'crv': 'P-256', 'x': encode(numbers.x.to_bytes(32, 'big')), 'y': encode(numbers.y.to_bytes(32, 'big'))})
        self.environment = patch.dict(os.environ, {'AEBRIDGE_LICENSE_PUBLIC_JWK': self.jwk}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def lease(self, **changes):
        payload = dict(version=1, leaseId='lease', customerId='customer', productId='ae_bridge', deviceId='mac', subscriptionState='trialing', issuedAt=900, expiresAt=1100, features=['ae_bridge'])
        payload.update(changes)
        content = encode(json.dumps({'alg': 'ES256', 'typ': 'AVID-LICENSE', 'kid': 'v1'}).encode()) + '.' + encode(json.dumps(payload).encode())
        r, s = decode_dss_signature(self.key.sign(content.encode(), ec.ECDSA(hashes.SHA256())))
        return content + '.' + encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))

    def test_valid_trial(self):
        self.assertEqual(licensing.verify_lease(self.lease(), expected_device_id='mac', now=1000)['subscriptionState'], 'trialing')

    def test_trial_expires_at_boundary(self):
        with self.assertRaises(licensing.LicenseError):
            licensing.verify_lease(self.lease(), now=1100)

    def test_other_product_rejected(self):
        with self.assertRaises(licensing.LicenseError):
            licensing.verify_lease(self.lease(productId='elemental_bender'), now=1000)

    def test_other_device_rejected(self):
        with self.assertRaises(licensing.LicenseError):
            licensing.verify_lease(self.lease(), expected_device_id='another-mac', now=1000)

    def test_invalid_signature_rejected(self):
        lease = self.lease()
        with self.assertRaises(licensing.LicenseError):
            licensing.verify_lease(lease.rsplit('.', 1)[0] + '.' + encode(bytes(64)), now=1000)

    def test_unconfigured_fails_closed(self):
        self.assertFalse(licensing.license_status()['usable'])

    def test_api_requires_local_session(self):
        from fastapi.testclient import TestClient
        from service.app import app
        client = TestClient(app)
        self.assertEqual(client.post('/v1/license/activate', json={'activationCode': 'test'}).status_code, 401)
        client.get('/v1/session')
        self.assertEqual(client.get('/v1/license/status').status_code, 200)
        self.assertEqual(client.get('/v1/aebridge/jobs').status_code, 403)
