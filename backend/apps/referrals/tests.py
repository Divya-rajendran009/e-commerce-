from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order
from .models import Referral, ReferralLevelRule, ReferralProgram, ReferralReward, WalletLedger
from .services import award_referral_for_order, reverse_referral_rewards_for_order

User = get_user_model()


class ReferralNetworkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = ReferralProgram.current()
        self.program.active = True
        self.program.max_depth = 6
        self.program.minimum_order_amount = Decimal("500.00")
        self.program.reward_on_first_qualifying_order_only = True
        self.program.save()
        self.program.level_rules.all().delete()
        for level in range(1, 7):
            ReferralLevelRule.objects.create(
                program=self.program,
                level=level,
                reward_type=ReferralLevelRule.RewardType.FIXED,
                amount=Decimal(str(110 - level * 10)),
            )

    def customer(self, serial, **fields):
        defaults = {
            "email": f"customer-{serial}@example.test",
            "phone": f"987650{serial:04d}",
            "first_name": f"Customer{serial}",
        }
        defaults.update(fields)
        return User.objects.create_user(password="S0mething-Strong!987", **defaults)

    def delivered_order(self, customer, *, total="1000.00"):
        return Order.objects.create(
            customer=customer,
            customer_name=customer.get_full_name(),
            phone=customer.phone,
            address="1 Market Road",
            status=Order.Status.DELIVERED,
            subtotal=Decimal(total),
            total=Decimal(total),
        )

    def make_chain(self, length):
        ancestors = [self.customer(index) for index in range(1, length + 1)]
        for upstream, downstream in zip(ancestors[1:], ancestors):
            Referral.objects.create(referrer=upstream, referred=downstream)
        purchaser = self.customer(length + 1)
        Referral.objects.create(referrer=ancestors[0], referred=purchaser)
        return ancestors, purchaser

    def test_ten_direct_referrals_and_level_two_are_persisted(self):
        referrer = self.customer(20)
        referrals = [self.customer(21 + index) for index in range(10)]
        Referral.objects.bulk_create([Referral(referrer=referrer, referred=member) for member in referrals])
        second_level = [self.customer(40 + index) for index in range(3)]
        Referral.objects.bulk_create([Referral(referrer=referrals[0], referred=member) for member in second_level])

        self.client.force_authenticate(referrer)
        response = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_counts"], [{"level": 1, "count": 10}, {"level": 2, "count": 3}, {"level": 3, "count": 0}, {"level": 4, "count": 0}, {"level": 5, "count": 0}, {"level": 6, "count": 0}])
        self.assertEqual(response.data["direct_referrals"], 10)
        self.assertEqual(response.data["total_downline"], 13)
        self.assertNotIn("referred_email", response.data["referrals"][0])

    def test_network_levels_continue_through_six_and_respect_depth_changes(self):
        ancestors, _ = self.make_chain(6)
        root = ancestors[-1]
        self.client.force_authenticate(root)
        six_levels = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(six_levels.data["total_downline"], 6)
        self.assertEqual([item["count"] for item in six_levels.data["level_counts"]], [1, 1, 1, 1, 1, 1])

        self.program.max_depth = 5
        self.program.save()
        five_levels = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(five_levels.data["max_depth"], 5)
        self.assertEqual(five_levels.data["total_downline"], 5)

    def test_reward_engine_stops_at_configured_depth_and_is_idempotent(self):
        ancestors, purchaser = self.make_chain(6)
        self.program.max_depth = 5
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser)

        self.assertTrue(award_referral_for_order(order))
        self.assertFalse(award_referral_for_order(order))
        rewards = list(ReferralReward.objects.filter(order=order).order_by("level"))
        self.assertEqual([reward.level for reward in rewards], [1, 2, 3, 4, 5])
        self.assertEqual({reward.recipient_id for reward in rewards}, {member.pk for member in ancestors[:5]})
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="credit").count(), 5)

    def test_percentage_rewards_use_order_total_and_round_to_currency(self):
        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.save()
        rule = self.program.level_rules.get(level=1)
        rule.reward_type = ReferralLevelRule.RewardType.PERCENTAGE
        rule.amount = Decimal("12.50")
        rule.save()
        order = self.delivered_order(purchaser, total="999.99")
        order.delivery_fee = Decimal("100.00")
        order.total = Decimal("1099.99")
        order.save(update_fields=["delivery_fee", "total"])

        self.assertTrue(award_referral_for_order(order))
        reward = ReferralReward.objects.get(order=order)
        self.assertEqual(reward.amount, Decimal("125.00"))
        self.assertEqual(reward.recipient, ancestors[0])

    def test_full_refund_writes_an_idempotent_reversal_ledger_entry(self):
        _, purchaser = self.make_chain(2)
        self.program.max_depth = 2
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser)
        self.assertTrue(award_referral_for_order(order))
        credited = WalletLedger.objects.filter(order=order).aggregate(total=Sum("amount"))["total"]

        self.assertEqual(reverse_referral_rewards_for_order(order, reason="full refund"), 2)
        self.assertEqual(reverse_referral_rewards_for_order(order, reason="full refund"), 0)
        balance = WalletLedger.objects.filter(order=order).aggregate(total=Sum("amount"))["total"]
        self.assertEqual(balance, Decimal("0.00"))
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="reversal").count(), 2)
        self.assertGreater(credited, Decimal("0.00"))
        self.assertFalse(ReferralReward.objects.filter(order=order, status=ReferralReward.Status.CREDITED).exists())

    def test_configured_qualifying_status_credits_and_cancellation_reverses(self):
        from apps.orders.services import change_order_status

        _, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.qualifying_order_statuses = [Order.Status.CONFIRMED]
        self.program.save()
        order = self.delivered_order(purchaser)
        order.status = Order.Status.PENDING
        order.save(update_fields=["status"])

        order = change_order_status(order=order, new_status=Order.Status.CONFIRMED)
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="credit").count(), 1)
        change_order_status(order=order, new_status=Order.Status.CANCELLED)
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="reversal").count(), 1)
        self.assertFalse(ReferralReward.objects.filter(order=order, status=ReferralReward.Status.CREDITED).exists())

    def test_wallet_api_is_scoped_to_authenticated_customer(self):
        owner, _ = self.make_chain(1)
        other_customer = self.customer(90)
        self.client.force_authenticate(owner[0])
        self.assertEqual(self.client.get("/api/v1/referrals/me/wallet/").data["transactions"], [])
        self.client.force_authenticate(other_customer)
        response = self.client.get("/api/v1/referrals/me/wallet/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["balance"], Decimal("0.00"))
        self.assertEqual(response.data["transactions"], [])

    def test_referral_settings_validation_and_role_permissions(self):
        admin = self.customer(91, is_staff=True, role=User.Role.MARKETING_MANAGER)
        self.client.force_authenticate(admin)
        invalid_depth = self.client.patch("/api/v1/admin/referral-settings/", {"max_depth": 7}, format="json")
        self.assertEqual(invalid_depth.status_code, 400)
        invalid_percentage = self.client.patch(
            "/api/v1/admin/referral-settings/",
            {"max_depth": 1, "level_rules": [{"level": 1, "reward_type": "percentage", "amount": "100.01", "active": True}]},
            format="json",
        )
        self.assertEqual(invalid_percentage.status_code, 400)
        saved = self.client.patch("/api/v1/admin/referral-settings/", {"max_depth": 3}, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data["configuration_version"], 2)
        self.assertTrue(admin.customer_service_audit_entries.filter(resource="referrals.referralprogram").exists())

        unauthorized = self.customer(92, is_staff=True, role=User.Role.CUSTOMER_SUPPORT)
        self.client.force_authenticate(unauthorized)
        self.assertEqual(self.client.patch("/api/v1/admin/referral-settings/", {"active": False}, format="json").status_code, 403)

    def test_admin_wallet_adjustments_are_idempotent_and_audited(self):
        admin = self.customer(99, is_staff=True, role=User.Role.ADMIN)
        customer = self.customer(100)
        self.client.force_authenticate(admin)
        payload = {
            "customer_id": customer.pk,
            "amount": "25.00",
            "transaction_type": "credit",
            "reason": "Approved service recovery",
            "idempotency_key": "support-credit-100",
        }
        first = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", payload, format="json")
        second = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(WalletLedger.objects.filter(customer=customer).count(), 1)
        self.assertEqual(customer.wallet_entries.aggregate(total=Sum("amount"))["total"], Decimal("25.00"))
        conflicting_retry = {**payload, "amount": "30.00"}
        self.assertEqual(self.client.post("/api/v1/admin/referrals/wallet-adjustments/", conflicting_retry, format="json").status_code, 409)

        payload.update({"amount": "20.00", "transaction_type": "debit", "idempotency_key": "support-debit-100"})
        debit = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", payload, format="json")
        debit_retry = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", payload, format="json")
        self.assertEqual(debit.status_code, 201)
        self.assertEqual(debit_retry.status_code, 200)
        self.assertEqual(customer.wallet_entries.aggregate(total=Sum("amount"))["total"], Decimal("5.00"))

        overdraw_payload = {**payload, "amount": "6.00", "idempotency_key": "support-debit-overdraw"}
        overdraw = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", overdraw_payload, format="json")
        self.assertEqual(overdraw.status_code, 400)
        self.assertEqual(admin.customer_service_audit_entries.filter(resource="referrals.walletledger").count(), 4)

    def test_invalid_referral_codes_are_rejected(self):
        response = self.client.post("/api/v1/referrals/validate/", {"referral_code": "NOTREAL1"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_admin_network_search_and_pagination_do_not_leak_to_customers(self):
        admin = self.customer(93, is_staff=True, role=User.Role.ADMIN)
        parent = self.customer(94)
        child = self.customer(95)
        Referral.objects.create(referrer=parent, referred=child)
        self.client.force_authenticate(admin)
        response = self.client.get(f"/api/v1/admin/referrals/network/?search={child.email}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["direct_referrer"]["email"], parent.email)
        self.assertEqual(self.client.get(f"/api/v1/admin/referrals/network/{child.pk}/").status_code, 200)
        self.client.force_authenticate(child)
        self.assertEqual(self.client.get("/api/v1/admin/referrals/network/").status_code, 403)

    def test_duplicate_direct_attribution_is_prevented(self):
        first = self.customer(96)
        second = self.customer(97)
        referred = self.customer(98)
        Referral.objects.create(referrer=first, referred=referred)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Referral.objects.create(referrer=second, referred=referred)
