from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from apps.catalog.models import Category, Product
from .models import InventoryAdjustment


class CategoryStockTests(APITestCase):
    url = "/api/v1/admin/inventory/stock/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(email="stock@example.test", password="test", phone="9876500070", role="inventory_manager", is_staff=True, admin_modules=["inventory"])
        self.client.force_authenticate(self.user)
        self.category = Category.objects.create(name="Food", slug="food", is_active=False)
        Category.objects.create(name="Empty", slug="empty")
        self.products = [Product.objects.create(category=self.category, name=f"Rice {i}", slug=f"rice-{i}", sku=f"R-{i}", stock=i, price=10, is_active=False) for i in range(25)]

    def change(self, product, stock, expected=None):
        return {"id": product.pk, "stock": stock, "expected_stock": product.stock if expected is None else expected}

    def test_lists_all_categories_and_products_including_inactive(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        response = self.client.get(self.url, {"category": self.category.pk})
        self.assertEqual(response.data["count"], 25)
        self.assertEqual(len(response.data["results"]), 25)
        self.assertIn("sku", response.data["results"][0])

    def test_single_and_batch_replacement_record_adjustments(self):
        response = self.client.post(self.url, {"changes": [self.change(self.products[0], 50)]}, format="json")
        self.assertEqual(response.status_code, 200)
        response = self.client.post(self.url, {"changes": [self.change(self.products[1], 0), self.change(self.products[2], 10)]}, format="json")
        self.assertEqual(response.status_code, 200)
        self.products[1].refresh_from_db()
        self.assertEqual(self.products[1].stock, 0)
        self.assertEqual(InventoryAdjustment.objects.count(), 3)

    def test_stale_batch_is_atomic(self):
        response = self.client.post(self.url, {"changes": [self.change(self.products[0], 50), self.change(self.products[1], 60, expected=999)]}, format="json")
        self.assertEqual(response.status_code, 409)
        self.products[0].refresh_from_db()
        self.assertEqual(self.products[0].stock, 0)
        self.assertEqual(InventoryAdjustment.objects.count(), 0)

    def test_invalid_quantities_duplicates_and_permissions(self):
        for value in [-1, 1.5, True, "2", 2147483648]:
            response = self.client.post(self.url, {"changes": [self.change(self.products[0], value)]}, format="json")
            self.assertEqual(response.status_code, 400)
        item = self.change(self.products[0], 5)
        self.assertEqual(self.client.post(self.url, {"changes": [item, item]}, format="json").status_code, 400)
        self.user.admin_modules = []
        self.user.save()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url, {"changes": [item]}, format="json").status_code, 403)
