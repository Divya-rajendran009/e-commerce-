from decimal import Decimal
from tempfile import TemporaryDirectory

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Category, Product

User = get_user_model()


class CatalogVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Category.objects.create(name="Fresh goods", slug="fresh-goods")
        self.product = Product.objects.create(
            category=self.category,
            name="Available tomato",
            slug="available-tomato",
            sku="TOMATO-AVAILABLE",
            price=Decimal("350.00"),
            stock=4,
        )

    def create_admin(self):
        return User.objects.create_user(
            email="catalog-admin@example.test",
            password="Test-password-123!",
            phone="9876500001",
            role=User.Role.ADMIN,
            is_staff=True,
        )

    def test_active_in_stock_products_and_nonempty_categories_are_public(self):
        products = self.client.get("/api/v1/products/")
        categories = self.client.get("/api/v1/categories/")
        self.assertEqual(products.status_code, 200)
        self.assertEqual([item["id"] for item in products.data["results"]], [self.product.pk])
        self.assertEqual([item["id"] for item in categories.data], [self.category.pk])

    def test_hidden_inactive_category_and_zero_stock_products_are_not_public(self):
        hidden_product = Product.objects.create(
            category=self.category,
            name="Hidden bean",
            slug="hidden-bean",
            sku="BEAN-HIDDEN",
            price=Decimal("350.00"),
            stock=5,
            is_active=False,
        )
        zero_stock = Product.objects.create(
            category=self.category,
            name="Sold out pea",
            slug="sold-out-pea",
            sku="PEA-SOLD-OUT",
            price=Decimal("350.00"),
            stock=0,
        )
        inactive_category = Category.objects.create(
            name="Seasonal goods",
            slug="seasonal-goods",
            is_active=False,
        )
        inactive_category_product = Product.objects.create(
            category=inactive_category,
            name="Seasonal mango",
            slug="seasonal-mango",
            sku="MANGO-SEASONAL",
            price=Decimal("350.00"),
            stock=4,
        )

        products = self.client.get("/api/v1/products/")
        categories = self.client.get("/api/v1/categories/")
        self.assertEqual([item["id"] for item in products.data["results"]], [self.product.pk])
        self.assertEqual([item["id"] for item in categories.data], [self.category.pk])
        for product in (hidden_product, zero_stock, inactive_category_product):
            self.assertEqual(self.client.get(f"/api/v1/products/{product.pk}/").status_code, 404)

    def test_restocking_makes_active_product_and_category_public_again(self):
        self.product.stock = 0
        self.product.save(update_fields=["stock"])
        self.assertEqual(self.client.get("/api/v1/products/").data["count"], 0)
        self.assertEqual(self.client.get("/api/v1/categories/").data, [])

        self.product.stock = 2
        self.product.save(update_fields=["stock"])
        self.assertEqual(self.client.get("/api/v1/products/").data["count"], 1)
        self.assertEqual(len(self.client.get("/api/v1/categories/").data), 1)

    def test_admin_can_manage_inactive_and_out_of_stock_records(self):
        self.product.stock = 0
        self.product.is_active = False
        self.product.save(update_fields=["stock", "is_active"])
        self.category.is_active = False
        self.category.save(update_fields=["is_active"])
        self.client.force_authenticate(self.create_admin())

        products = self.client.get("/api/v1/admin/products/")
        categories = self.client.get("/api/v1/admin/categories/")
        self.assertEqual(products.status_code, 200)
        self.assertEqual(categories.status_code, 200)
        product_results = products.data["results"] if isinstance(products.data, dict) else products.data
        category_results = categories.data["results"] if isinstance(categories.data, dict) else categories.data
        self.assertEqual(product_results[0]["stock"], 0)
        self.assertFalse(product_results[0]["is_active"])
        self.assertFalse(category_results[0]["is_active"])

    def test_only_authorized_admin_can_change_visibility(self):
        customer = User.objects.create_user(
            email="catalog-customer@example.test",
            password="Test-password-123!",
            phone="9876500002",
        )
        self.client.force_authenticate(customer)
        product_change = self.client.patch(
            f"/api/v1/admin/products/{self.product.pk}/",
            {"is_active": False},
            format="json",
        )
        category_change = self.client.patch(
            f"/api/v1/admin/categories/{self.category.pk}/",
            {"is_active": False, "referral_rewards_enabled": False},
            format="json",
        )
        self.assertEqual(product_change.status_code, 403)
        self.assertEqual(category_change.status_code, 403)
        self.product.refresh_from_db()
        self.category.refresh_from_db()
        self.assertTrue(self.product.is_active)
        self.assertTrue(self.category.is_active)
        self.assertIsNone(self.category.referral_rewards_enabled)

    def test_admin_can_override_category_referral_eligibility(self):
        self.client.force_authenticate(self.create_admin())
        response = self.client.patch(
            f"/api/v1/admin/categories/{self.category.pk}/",
            {"referral_rewards_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.category.refresh_from_db()
        self.assertFalse(self.category.referral_rewards_enabled)

    def test_admin_can_upload_product_image_and_public_api_returns_its_url(self):
        with TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.force_authenticate(self.create_admin())
            image = SimpleUploadedFile(
                "tomato.png",
                b"\x89PNG\r\n\x1a\n" + b"\x00" * 16,
                content_type="image/png",
            )
            response = self.client.patch(
                f"/api/v1/admin/products/{self.product.pk}/",
                {"image": image},
                format="multipart",
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("/media/products/tomato", response.data["image_url"])
            self.product.refresh_from_db()
            self.assertTrue(self.product.image.name.startswith("products/tomato"))
            public_image_url = self.client.get(f"/api/v1/products/{self.product.pk}/").data["image_url"]
            self.assertTrue(public_image_url.endswith(self.product.image.url))

    def test_product_image_upload_rejects_invalid_type_and_oversized_files(self):
        self.client.force_authenticate(self.create_admin())
        invalid = SimpleUploadedFile("not-image.png", b"not an image", content_type="image/png")
        response = self.client.patch(
            f"/api/v1/admin/products/{self.product.pk}/",
            {"image": invalid},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)

        oversized = SimpleUploadedFile(
            "large.png",
            b"\x89PNG\r\n\x1a\n" + b"\x00" * (5 * 1024 * 1024),
            content_type="image/png",
        )
        response = self.client.patch(
            f"/api/v1/admin/products/{self.product.pk}/",
            {"image": oversized},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("image", response.data)

    def test_product_manager_cannot_change_category_referral_eligibility_without_grant(self):
        manager = User.objects.create_user(
            email="catalog-manager@example.test",
            password="Validation-Only-Strong-Password-987!",
            phone="9876500003",
            role="product_manager",
            is_staff=True,
            admin_modules=["products"],
        )
        self.client.force_authenticate(manager)
        response = self.client.patch(
            f"/api/v1/admin/categories/{self.category.pk}/",
            {"referral_rewards_enabled": False},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.category.refresh_from_db()
        self.assertIsNone(self.category.referral_rewards_enabled)
