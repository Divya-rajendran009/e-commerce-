from django.test import SimpleTestCase


class ApiHealthTests(SimpleTestCase):
    def test_health_is_json_without_database_access(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "pandiyan-api"})
        self.assertIn("no-store", response.headers["Cache-Control"])

    def test_health_is_read_only(self):
        self.assertEqual(self.client.post("/api/health/").status_code, 405)
