from decimal import Decimal
from uuid import uuid4
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.catalog.models import Category, Product
from apps.referrals.models import ReferralProgram, WalletLedger, Referral
from apps.referrals.wallet import balance, restore_order_wallet
from apps.referrals.services import effective_commission_rates, _eligible_item_amounts
from apps.customer_services.models import Refund
from .models import Order
from .services import place_order, change_order_status


class WalletCheckoutTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="wallet@example.com", password="test", phone="9000000001")
        self.category = Category.objects.create(name="Rice", slug="rice")
        self.product = Product.objects.create(category=self.category, name="Rice", slug="rice", sku="RICE", price=600, stock=30)
        self.program = ReferralProgram.current()
        self.program.wallet_spending_enabled = True
        self.program.save()
        WalletLedger.objects.create(customer=self.user, amount=120, transaction_type="credit", description="Reward")
        self.payload = dict(customer_name="Customer", phone="9000000001", address="Test address", delivery_pin_code="625531", items=[{"product_id": self.product.pk, "quantity": 1}], use_wallet=True, checkout_key=uuid4())
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_payment_split_retry_and_stock(self):
        order = place_order(customer=self.user, payload=self.payload)
        retry = place_order(customer=self.user, payload=self.payload)
        self.assertEqual(order.pk, retry.pk)
        self.assertEqual(order.total, Decimal("630"))
        self.assertEqual(order.wallet_amount, Decimal("120"))
        self.assertEqual(order.payment_transactions.get().amount, Decimal("510"))
        self.assertEqual(balance(self.user), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 29)

    def test_changed_payload_reusing_key_rejected(self):
        place_order(customer=self.user, payload=self.payload)
        response = self.client.post('/api/v1/orders/', {**self.payload, "address": "Different address"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_wallet_disabled_is_rejected_without_debit(self):
        self.program.wallet_spending_enabled = False
        self.program.save()
        response = self.client.post('/api/v1/orders/', self.payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(balance(self.user), 120)
        self.assertEqual(Order.objects.count(), 0)

    def test_cancel_restores_once(self):
        order = place_order(customer=self.user, payload=self.payload)
        change_order_status(order=order, new_status="cancelled")
        restore_order_wallet(order, full=True)
        self.assertEqual(balance(self.user), 120)
        self.assertEqual(WalletLedger.objects.filter(transaction_type="restore").count(), 1)

    def test_full_wallet_payment(self):
        WalletLedger.objects.create(customer=self.user, amount=1000, transaction_type="credit", description="Reward")
        order = place_order(customer=self.user, payload=self.payload)
        self.assertEqual(order.wallet_amount, order.total)
        self.assertEqual(order.payment_status, "paid")
        self.assertFalse(order.payment_transactions.exists())

    def test_partial_refund_restores_proportionally_without_duplicate(self):
        order = place_order(customer=self.user, payload=self.payload)
        Refund.objects.create(order=order, amount=315, status="recorded", reason="Half return", created_by=self.user, updated_by=self.user)
        restore_order_wallet(order)
        restore_order_wallet(order)
        self.assertEqual(balance(self.user), 60)
        restore_order_wallet(order, full=True)
        self.assertEqual(balance(self.user), 120)

    def test_snapshot_survives_category_reassignment(self):
        order = place_order(customer=self.user, payload=self.payload)
        self.product.category = Category.objects.create(name="Other", slug="other")
        self.product.save()
        self.assertIn(self.category.pk, _eligible_item_amounts(order))

    def test_category_filter_excludes_other_categories(self):
        other = Category.objects.create(name="Milk", slug="milk")
        Product.objects.create(category=other, name="Milk", slug="milk", sku="MILK", price=50, stock=3)
        response = self.client.get('/api/v1/products/', {"category": other.pk})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["sku"], "MILK")

    def test_pagination_and_empty_fast_moving(self):
        for index in range(13):
            Product.objects.create(category=self.category, name=f"Item {index}", slug=f"item-{index}", sku=f"ITEM{index}", price=50, stock=3)
        response = self.client.get('/api/v1/products/')
        self.assertEqual(len(response.data["results"]), 12)
        self.assertIsNotNone(response.data["next"])
        self.assertEqual(self.client.get('/api/v1/products/?page=2').data["count"], 14)
        self.assertEqual(self.client.get('/api/v1/products/?collection=fast-moving').data["count"], 0)

    def test_disabled_category_not_advertised(self):
        self.category.referral_rewards_enabled = False
        self.category.save()
        self.assertEqual(effective_commission_rates(self.program), [])
        self.assertEqual(self.client.get('/api/v1/products/?collection=referral').data['count'], 0)

    def test_network_scope_depth_and_privacy(self):
        child = User.objects.create_user(email="child@example.com", password="test", phone="9000000002", first_name="Child")
        grandchild = User.objects.create_user(email="grandchild@example.com", password="test", phone="9000000003")
        Referral.objects.create(referrer=self.user, referred=child)
        Referral.objects.create(referrer=child, referred=grandchild)
        self.program.max_depth = 1
        self.program.save()
        response = self.client.get('/api/v1/referrals/me/network/')
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'Child')
        self.assertNotIn('email', response.data['results'][0])
        self.assertEqual(self.client.get('/api/v1/referrals/me/network/?level=2').status_code, 400)
        self.assertEqual(self.client.get('/api/v1/admin/dashboard/').status_code, 403)

    def test_admin_wallet_totals(self):
        place_order(customer=self.user, payload=self.payload)
        admin = User.objects.create_user(email="admin-wallet@example.com", password="test", phone="9000000004", role="super_admin", is_staff=True)
        self.client.force_authenticate(admin)
        response = self.client.get('/api/v1/admin/dashboard/?period=today')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['referral_financials']['wallet_redeemed'], 120)
        self.assertEqual(response.data['cash_collected'], 0)
        self.assertEqual(response.data['delivered_sales'], 0)
