from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from apps.orders.models import Order
from .models import ReferralProgram, Referral, ReferralReward
from .services import qualifying_self_purchase_total, qualification_window, award_referral_for_order


class QualificationPeriodTests(APITestCase):
    def setUp(self):
        self.program = ReferralProgram.current()
        self.program.qualification_period = "calendar_month"
        self.program.qualification_threshold = Decimal("1000")
        self.program.reward_referred_customer = False
        self.program.save()
        self.owner = get_user_model().objects.create_user(email="period@example.test", phone="9876500060", password="test")
        self.now = timezone.make_aware(datetime(2026, 10, 15, 12))

    def order(self, customer, at, amount="1000"):
        order = Order.objects.create(customer=customer, customer_name="Test", phone=customer.phone, address="Test", status="delivered", subtotal=Decimal(amount), total=Decimal(amount))
        Order.objects.filter(pk=order.pk).update(created_at=at)
        return order

    def test_calendar_boundaries_and_reset(self):
        start, end = qualification_window(self.program, self.now)
        self.order(self.owner, start - timedelta(seconds=1), "5000")
        self.order(self.owner, start, "1000")
        self.order(self.owner, end, "2000")
        self.assertEqual(qualifying_self_purchase_total(self.owner, self.program, self.now), Decimal("1000"))
        self.assertEqual(qualifying_self_purchase_total(self.owner, self.program, end + timedelta(seconds=1)), Decimal("2000"))

    def test_rolling_purchases_expire(self):
        self.program.qualification_period = "rolling_days"
        self.program.qualification_period_days = 30
        self.order(self.owner, self.now - timedelta(days=30))
        self.assertEqual(qualifying_self_purchase_total(self.owner, self.program, self.now), Decimal("1000"))
        self.assertEqual(qualifying_self_purchase_total(self.owner, self.program, self.now + timedelta(seconds=1)), Decimal("0"))

    def test_admin_threshold_and_customer_remaining(self):
        admin = get_user_model().objects.create_superuser(email="period-admin@example.test", phone="9876500061", password="test")
        self.client.force_authenticate(admin)
        response = self.client.patch("/api/v1/admin/referral-settings/", {"qualification_threshold": "5000.00", "qualification_period": "rolling_days", "qualification_period_days": 7}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.order(self.owner, self.now - timedelta(days=1), "1200")
        self.client.force_authenticate(self.owner)
        with patch("django.utils.timezone.now", return_value=self.now):
            response = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["qualification_remaining"], "3800.00")
        self.assertFalse(response.data["is_qualified"])
        self.client.force_authenticate(admin)
        for days in [0, -1, 3651]:
            self.assertEqual(self.client.patch("/api/v1/admin/referral-settings/", {"qualification_period_days": days}, format="json").status_code, 400)

    def test_old_purchases_do_not_award_commissions(self):
        purchaser = get_user_model().objects.create_user(email="period-buyer@example.test", phone="9876500062", password="test")
        Referral.objects.create(referrer=self.owner, referred=purchaser)
        start, _ = qualification_window(self.program, self.now)
        self.order(self.owner, start - timedelta(days=1), "5000")
        referred_order = self.order(purchaser, self.now - timedelta(hours=1))
        with patch("django.utils.timezone.now", return_value=self.now):
            self.assertFalse(award_referral_for_order(referred_order))
            self.order(self.owner, self.now - timedelta(minutes=30))
            self.assertTrue(award_referral_for_order(referred_order))
        self.assertEqual(ReferralReward.objects.filter(recipient=self.owner).count(), 1)
