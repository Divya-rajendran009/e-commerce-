from django.test import SimpleTestCase
from rest_framework.test import APIClient


class AccountAuthenticationTests(SimpleTestCase):
    def test_profile_requires_authentication(self):
        client = APIClient()
        for method in ("get", "patch"):
            with self.subTest(method=method):
                response = getattr(client, method)("/api/v1/auth/me/", {}, format="json", secure=True)
                self.assertEqual(response.status_code, 401)
