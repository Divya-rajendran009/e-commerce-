from decimal import Decimal
from uuid import uuid4
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from apps.accounts.models import User
from apps.catalog.models import Category, Product
from apps.customer_services.models import DeliveryAssignment, Refund, SystemSettings
from apps.referrals.models import ReferralProgram, WalletLedger
from apps.referrals.wallet import balance, restore_order_wallet
from .models import OrderInvoice, InventoryMovement
from .services import place_order, change_order_status, reopen_order


class OrderTrackingTests(TestCase):
    def test_invoice_fonts_cover_english_tamil_and_currency(self):
        from .invoices import pdfmetrics

        for name in ("Invoice", "InvoiceBold"):
            font = pdfmetrics.getFont(name)
            for character in "Pandiyan Stores தமிழ் ₹0123456789":
                self.assertIn(ord(character), font.face.charToGlyph, character)

    def setUp(self):
        self.customer = User.objects.create_user(
            email="tracking@example.test", phone="9000000010", password="test"
        )
        self.other = User.objects.create_user(
            email="other-tracking@example.test", phone="9000000011", password="test"
        )
        self.admin = User.objects.create_user(
            email="tracking-admin@example.test",
            phone="9000000012",
            password="test",
            role="super_admin",
            is_staff=True,
        )
        category = Category.objects.create(name="Care", slug="tracking-care")
        self.product = Product.objects.create(
            name="சக்தி மஞ்சள் தூள் / Turmeric",
            slug="tracking-item",
            sku="TRACK-1",
            category=category,
            stock=10,
            price=Decimal("600"),
        )
        self.payload = dict(
            customer_name="Test Customer",
            phone=self.customer.phone,
            address="1 Test Street\nTheni",
            delivery_pin_code="625531",
            items=[{"product_id": self.product.pk, "quantity": 1}],
        )
        self.order = place_order(customer=self.customer, payload=self.payload)
        self.client = APIClient()

    def cancel(self, order=None):
        return change_order_status(
            order=order or self.order, new_status="cancelled", actor=self.admin
        )

    def test_repeat_cancel_restore_preserves_stock_and_history(self):
        for cycle in range(3):
            order = self.cancel()
            self.product.refresh_from_db()
            self.assertEqual(self.product.stock, 10)
            order = reopen_order(
                order=order, actor=self.admin, expected_version=order.status_version
            )
            self.product.refresh_from_db()
            self.assertEqual(self.product.stock, 9)
            self.assertEqual(order.status, "pending")
            self.assertEqual(order.fulfilment_cycle, cycle + 1)
        self.assertEqual(self.order.status_events.count(), 7)
        self.assertEqual(
            InventoryMovement.objects.filter(order=self.order, kind="restock").count(),
            3,
        )

    def test_restore_insufficient_stock_rolls_back(self):
        order = self.cancel()
        self.product.stock = 0
        self.product.save()
        with self.assertRaises(ValidationError):
            reopen_order(order=order, actor=self.admin)
        order.refresh_from_db()
        self.assertEqual(order.status, "cancelled")
        self.assertEqual(order.fulfilment_cycle, 0)

    def test_wallet_recharged_and_refunded_each_cycle(self):
        program = ReferralProgram.current()
        program.wallet_spending_enabled = True
        program.save()
        WalletLedger.objects.create(
            customer=self.customer,
            amount=1000,
            transaction_type="credit",
            description="Test reward",
        )
        order = place_order(
            customer=self.customer,
            payload={**self.payload, "use_wallet": True, "checkout_key": uuid4()},
        )
        for _ in range(3):
            order = self.cancel(order)
            restore_order_wallet(order, full=True)
            self.assertEqual(balance(self.customer), Decimal("1000"))
            order = reopen_order(order=order, actor=self.admin)
            self.assertEqual(balance(self.customer), Decimal("370"))
            self.assertEqual(order.payment_status, "paid")

    def test_spent_wallet_credit_blocks_restore_without_stock_change(self):
        program = ReferralProgram.current()
        program.wallet_spending_enabled = True
        program.save()
        WalletLedger.objects.create(
            customer=self.customer,
            amount=120,
            transaction_type="credit",
            description="Test",
        )
        order = place_order(
            customer=self.customer,
            payload={**self.payload, "use_wallet": True, "checkout_key": uuid4()},
        )
        order = self.cancel(order)
        WalletLedger.objects.create(
            customer=self.customer,
            amount=-120,
            transaction_type="adjustment",
            description="Spent elsewhere",
        )
        self.product.refresh_from_db()
        before = self.product.stock
        with self.assertRaises(ValidationError):
            reopen_order(order=order, actor=self.admin)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, before)
        self.assertEqual(balance(self.customer), 0)

    def test_restore_is_admin_only_and_rejects_stale_versions(self):
        order = self.cancel()
        url = f"/api/v1/admin/orders/{order.pk}/restore/"
        self.client.force_authenticate(self.customer)
        self.assertEqual(
            self.client.post(
                url, {"expected_version": order.status_version}
            ).status_code,
            403,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post(url, {"expected_version": 0}).status_code, 400
        )
        self.assertEqual(
            self.client.post(
                url, {"expected_version": order.status_version}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                url, {"expected_version": order.status_version}
            ).status_code,
            400,
        )

    def test_refund_blocks_restore(self):
        order = self.cancel()
        Refund.objects.create(
            order=order,
            amount=10,
            reason="Test",
            status="recorded",
            created_by=self.admin,
        )
        with self.assertRaises(ValidationError):
            reopen_order(order=order, actor=self.admin)

    def test_private_notes_are_admin_only_and_audited(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/v1/admin/orders/{self.order.pk}/",
            {"private_note": "Staff-only note", "expected_version": 0},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["private_note"], "Staff-only note")
        self.client.force_authenticate(self.customer)
        detail = self.client.get(f"/api/v1/orders/{self.order.pk}/")
        self.assertNotIn("private_note", detail.data)
        self.assertNotIn("actor", detail.data["status_events"][0])

    def test_history_and_customer_scope(self):
        change_order_status(order=self.order, new_status="confirmed", actor=self.admin)
        self.client.force_authenticate(self.customer)
        response = self.client.get(f"/api/v1/orders/{self.order.pk}/")
        self.assertEqual(
            [e["status"] for e in response.data["status_events"]],
            ["pending", "confirmed"],
        )
        self.client.force_authenticate(self.other)
        self.assertEqual(
            self.client.get(f"/api/v1/orders/{self.order.pk}/").status_code, 404
        )

    def test_delivery_updates_sync_order_and_history(self):
        order = change_order_status(
            order=self.order, new_status="confirmed", actor=self.admin
        )
        delivery = DeliveryAssignment.objects.get(order=order)
        url = f"/api/v1/admin/delivery-assignments/{delivery.pk}/"
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.patch(url, {"status": "dispatched"}).status_code, 400
        )
        for status in ("processing", "packed", "picked_up"):
            order = change_order_status(
                order=order, new_status=status, actor=self.admin
            )
        self.assertEqual(
            self.client.patch(url, {"status": "dispatched"}).status_code, 200
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "out_for_delivery")
        self.assertEqual(
            self.client.patch(url, {"status": "delivered"}).status_code, 200
        )
        order.refresh_from_db()
        self.assertEqual(order.status, "delivered")
        self.assertEqual(order.status_events.last().status, "delivered")

    def test_cancelled_delivery_is_locked_and_customer_event_is_labelled(self):
        order = change_order_status(
            order=self.order, new_status="confirmed", actor=self.admin
        )
        delivery = DeliveryAssignment.objects.get(order=order)
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            f"/api/v1/orders/{order.pk}/cancel/",
            {"expected_version": order.status_version},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["status_events"][-1]["kind"], "customer_cancelled"
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/admin/delivery-assignments/{delivery.pk}/",
                {"delivery_note": "Cannot change"},
            ).status_code,
            400,
        )

    def test_customer_cannot_cancel_dispatched_order_admin_can(self):
        order = self.order
        for status in [
            "confirmed",
            "processing",
            "packed",
            "picked_up",
            "out_for_delivery",
        ]:
            order = change_order_status(
                order=order, new_status=status, actor=self.admin
            )
        self.client.force_authenticate(self.customer)
        self.assertEqual(
            self.client.post(f"/api/v1/orders/{order.pk}/cancel/", {}).status_code, 400
        )
        order = self.cancel(order)
        self.assertEqual(order.status, "cancelled")

    def test_invoice_permissions_snapshot_and_repeat_download(self):
        url = f"/api/v1/orders/{self.order.pk}/invoice/"
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(OrderInvoice.objects.count(), 0)
        self.client.force_authenticate(self.customer)
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.product.price = 900
        self.product.save()
        settings = SystemSettings.current()
        settings.store_name = "Changed name"
        settings.save()
        self.assertEqual(self.client.get(url).content, response.content)
        self.assertEqual(OrderInvoice.objects.count(), 1)
        invoice = OrderInvoice.objects.get()
        self.assertEqual(invoice.snapshot["items"][0]["unit_price"], "600.00")
        self.assertNotIn("private_note", invoice.snapshot)
        self.client.force_authenticate(self.admin)
        admin_url = f"/api/v1/admin/orders/{self.order.pk}/invoice/"
        self.assertEqual(
            self.client.post(admin_url, {"include_qr": False}, format="json").content,
            response.content,
        )

    def test_admin_invoice_qr_option_and_module_permissions(self):
        self.client.force_authenticate(self.admin)
        url = f"/api/v1/admin/orders/{self.order.pk}/invoice/"
        self.assertEqual(
            self.client.post(url, {"include_qr": False}, format="json").status_code, 200
        )
        self.assertFalse(OrderInvoice.objects.get().include_qr)
        staff = User.objects.create_user(
            email="products-only@example.test",
            phone="9000000019",
            role="product_manager",
            is_staff=True,
            admin_modules=["products"],
        )
        self.client.force_authenticate(staff)
        self.assertEqual(self.client.get(url).status_code, 403)
