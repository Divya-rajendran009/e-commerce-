from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.orders.models import Order
from .models import ReferralProgram, Referral, ReferralReward, WalletLedger
from .services import award_referral_for_order, settle_pending_commissions, reverse_referral_rewards_for_order


class PendingCommissionTests(APITestCase):
    def setUp(self):
        self.program = ReferralProgram.current()
        self.program.qualification_threshold = Decimal("1000")
        self.program.qualification_period = "rolling_days"
        self.program.qualification_period_days = 30
        self.program.reward_referred_customer = False
        self.program.save()
        User = get_user_model()
        self.owner = User.objects.create_user(email="pending@example.test", phone="9876500050", password="test")
        self.buyer = User.objects.create_user(email="pending-buyer@example.test", phone="9876500051", password="test")
        Referral.objects.create(referrer=self.owner, referred=self.buyer)
        WalletLedger.objects.create(customer=self.owner, amount=Decimal("125"), transaction_type="adjustment", description="Previously earned funds")
        self.order = self.delivered(self.buyer)
        award_referral_for_order(self.order)
        self.reward = ReferralReward.objects.get(order=self.order, recipient=self.owner)
        self.client.force_authenticate(self.owner)

    def delivered(self, customer):
        return Order.objects.create(customer=customer, customer_name="Test", phone=customer.phone, address="Test", status="delivered", subtotal=Decimal("1000"), total=Decimal("1000"))

    def test_pending_is_separate_and_releases_once_on_own_delivery(self):
        self.assertEqual(self.reward.status, "pending")
        response = self.client.get("/api/v1/referrals/me/wallet/")
        self.assertEqual(Decimal(str(response.data["balance"])), Decimal("125"))
        self.assertEqual(Decimal(str(response.data["pending_commissions"])), Decimal("10"))
        own_order = self.delivered(self.owner)
        award_referral_for_order(own_order)
        settle_pending_commissions(self.owner)
        settle_pending_commissions(self.owner)
        self.reward.refresh_from_db()
        self.assertEqual(self.reward.status, "credited")
        self.assertEqual(WalletLedger.objects.filter(reward=self.reward, transaction_type="credit").count(), 1)
        response = self.client.get("/api/v1/referrals/me/wallet/")
        self.assertEqual(Decimal(str(response.data["balance"])), Decimal("135"))
        self.assertEqual(Decimal(str(response.data["pending_commissions"])), 0)

    def test_expiry_keeps_existing_balance_and_cannot_be_revived(self):
        with patch("django.utils.timezone.now", return_value=self.reward.pending_expires_at):
            self.delivered(self.owner)
            response = self.client.get("/api/v1/referrals/me/wallet/")
            self.assertEqual(Decimal(str(response.data["balance"])), Decimal("125"))
            self.assertEqual(Decimal(str(response.data["pending_commissions"])), 0)
            settle_pending_commissions(self.owner)
        self.reward.refresh_from_db()
        self.assertEqual(self.reward.status, "expired")
        self.assertFalse(WalletLedger.objects.filter(reward=self.reward).exists())

    def test_reversal_of_pending_does_not_debit_wallet(self):
        reverse_referral_rewards_for_order(self.order, reason="Returned")
        self.reward.refresh_from_db()
        self.assertEqual(self.reward.status, "reversed")
        self.assertFalse(WalletLedger.objects.filter(reward=self.reward).exists())

    def test_calendar_pending_expires_at_next_month(self):
        self.program.qualification_period = "calendar_month"
        self.program.reward_on_first_qualifying_order_only = False
        self.program.save()
        order = self.delivered(self.buyer)
        award_referral_for_order(order)
        reward = ReferralReward.objects.get(order=order, recipient=self.owner)
        end = timezone.localtime(reward.pending_expires_at)
        self.assertEqual((end.day, end.hour, end.minute), (1, 0, 0))
        self.assertGreater(end, timezone.now())
