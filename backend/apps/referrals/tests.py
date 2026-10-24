from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.test import TestCase
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.orders.models import OrderItem
from apps.customer_services.models import Refund, ReturnRequest
from .models import Referral, ReferralLevelRule, ReferralProgram, ReferralReward, WalletLedger
from .services import award_referral_for_order, qualifying_self_purchase_total, reverse_referral_rewards_for_order

User = get_user_model()


class ReferralNetworkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.program = ReferralProgram.current()
        self.program.active = True
        self.program.max_depth = 5
        self.program.qualification_threshold = Decimal("0.00")
        self.program.reward_on_first_qualifying_order_only = True
        self.program.save()
        self.program.level_rules.all().delete()
        rates = ["1.00", "0.75", "0.50", "0.40", "0.30"]
        for level, rate in enumerate(rates, start=1):
            ReferralLevelRule.objects.create(
                program=self.program,
                level=level,
                reward_type=ReferralLevelRule.RewardType.PERCENTAGE,
                amount=Decimal(rate),
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

        customer_dashboard = self._customer_invite_response(referrer)
        self.assertEqual(customer_dashboard.status_code, 200)
        self.assertIn("qualification_progress_percent", customer_dashboard.data)
        self.assertIn("wallet_transactions", customer_dashboard.data)
        admin = self.customer(199, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        response = self.client.get(f"/api/v1/admin/referrals/network/{referrer.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["level_counts"], [{"level": 1, "count": 10}, {"level": 2, "count": 3}, {"level": 3, "count": 0}, {"level": 4, "count": 0}, {"level": 5, "count": 0}])
        self.assertEqual(response.data["direct_referral_count"], 10)

    def test_network_levels_never_exceed_five(self):
        ancestors, _ = self.make_chain(6)
        root = ancestors[-1]
        admin = self.customer(199, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        six_levels = self.client.get(f"/api/v1/admin/referrals/network/{root.pk}/")
        self.assertEqual([item["count"] for item in six_levels.data["level_counts"]], [1, 1, 1, 1, 1])
        self.assertEqual(len(six_levels.data["level_counts"]), 5)

    def test_branched_network_has_expected_levels_at_each_configured_depth(self):
        simon = self.customer(200)
        a, b, c = self.customer(201), self.customer(202), self.customer(203)
        a1, a2, b1, a1x = (self.customer(index) for index in range(204, 208))
        Referral.objects.bulk_create([
            Referral(referrer=simon, referred=member) for member in (a, b, c)
        ] + [
            Referral(referrer=a, referred=member) for member in (a1, a2)
        ] + [
            Referral(referrer=b, referred=b1),
            Referral(referrer=a1, referred=a1x),
        ])
        admin = self.customer(199, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        expected_tree = [3, 3, 1, 0, 0]
        self.assertEqual(
            [row["count"] for row in self.client.get(f"/api/v1/admin/referrals/network/{simon.pk}/").data["level_counts"]],
            expected_tree,
        )

        child = a1x
        for serial in range(208, 211):
            descendant = self.customer(serial)
            Referral.objects.create(referrer=child, referred=descendant)
            child = descendant

        for depth, expected_counts in (
            (1, [3]),
            (3, [3, 3, 1]),
            (5, [3, 3, 1, 1, 1]),
        ):
            self.program.max_depth = depth
            self.program.save()
            response = self.client.get(f"/api/v1/admin/referrals/network/{simon.pk}/")
            self.assertEqual(len(response.data["level_counts"]), depth)
            self.assertEqual([row["count"] for row in response.data["level_counts"]], expected_counts)

        self.assertEqual(Referral.objects.get(referred=a).referrer, simon)

    def _customer_invite_response(self, customer):
        self.client.force_authenticate(customer)
        return self.client.get("/api/v1/referrals/me/")

    def test_registration_attribution_survives_logout_login_and_dashboard_refresh(self):
        referrer = self.customer(220)
        response = self.client.post("/api/v1/auth/register/", {
            "full_name": "Referred Customer",
            "email": "registered-referral@example.test",
            "phone": "9876502220",
            "password": "S0mething-Strong!987",
            "confirm_password": "S0mething-Strong!987",
            "referral_code": referrer.referral_code.lower(),
        }, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["user"]["referral_code"]), 8)
        self.assertNotEqual(response.data["user"]["referral_code"], referrer.referral_code)
        referred = User.objects.get(email="registered-referral@example.test")
        attribution = Referral.objects.get(referred=referred)
        self.assertEqual(attribution.referrer, referrer)
        self.assertEqual(attribution.referrer_id, referrer.pk)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get("/api/v1/referrals/me/").status_code, 200)
        self.assertEqual(self.client.post("/api/v1/auth/logout/", {"refresh": response.data["refresh"]}).status_code, 205)
        self.client.credentials()

        login = self.client.post("/api/v1/auth/login/", {
            "email": referred.email,
            "password": "S0mething-Strong!987",
        }, format="json")
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        dashboard = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data["referral_code"], referred.referral_code)
        self.client.force_authenticate(referrer)
        refreshed_dashboard = self.client.get("/api/v1/referrals/me/")
        self.assertEqual(refreshed_dashboard.data["referral_code"], referrer.referral_code)

    def test_registration_rejects_invalid_referral_code_without_creating_user(self):
        response = self.client.post("/api/v1/auth/register/", {
            "full_name": "Invalid Referral",
            "email": "invalid-referral@example.test",
            "phone": "9876502221",
            "password": "S0mething-Strong!987",
            "confirm_password": "S0mething-Strong!987",
            "referral_code": "NOTREAL1",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="invalid-referral@example.test").exists())

    def test_five_level_percentage_rates_match_configuration_and_wallet_ledger(self):
        ancestors, purchaser = self.make_chain(6)
        rates = [Decimal("1.00"), Decimal("0.75"), Decimal("0.50"), Decimal("0.40"), Decimal("0.30")]
        amounts = [Decimal("10.00"), Decimal("7.50"), Decimal("5.00"), Decimal("4.00"), Decimal("3.00")]
        self.program.max_depth = 5
        self.program.reward_referred_customer = False
        self.program.reward_referrer = True
        self.program.reward_ancestors = True
        self.program.save()
        for level, rate in enumerate(rates, start=1):
            self.program.level_rules.filter(level=level).update(
                reward_type=ReferralLevelRule.RewardType.PERCENTAGE,
                amount=rate,
                active=True,
            )
        order = self.delivered_order(purchaser, total="1000.00")

        self.assertTrue(award_referral_for_order(order))
        self.assertFalse(award_referral_for_order(order))
        rewards = list(ReferralReward.objects.filter(order=order).order_by("level"))
        self.assertEqual([reward.level for reward in rewards], [1, 2, 3, 4, 5])
        self.assertEqual([reward.amount for reward in rewards], amounts)
        self.assertEqual([reward.recipient_id for reward in rewards], [member.pk for member in ancestors[:5]])
        self.assertTrue(all(reward.order_id == order.pk for reward in rewards))
        self.assertTrue(all(reward.referral.referred_id == purchaser.pk for reward in rewards))
        self.assertEqual(sum((reward.amount for reward in rewards), Decimal("0.00")), Decimal("29.50"))
        self.assertEqual(
            WalletLedger.objects.filter(order=order).aggregate(total=Sum("amount"))["total"],
            Decimal("29.50"),
        )
        self.assertEqual(
            [WalletLedger.objects.filter(customer=member).aggregate(total=Sum("amount"))["total"] for member in ancestors[:5]],
            amounts,
        )

    def test_configured_four_level_depth_never_credits_level_five(self):
        ancestors, purchaser = self.make_chain(6)
        self.program.max_depth = 4
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser, total="1000.00")

        self.assertTrue(award_referral_for_order(order))
        rewards = list(ReferralReward.objects.filter(order=order).order_by("level"))
        self.assertEqual([reward.level for reward in rewards], [1, 2, 3, 4])
        self.assertEqual({reward.recipient_id for reward in rewards}, {member.pk for member in ancestors[:4]})

    def test_category_override_and_global_fallback_use_discounted_item_amounts(self):
        from apps.catalog.models import Category, Product

        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.category_scope = ReferralProgram.CategoryScope.ALL
        self.program.category_overrides_enabled = True
        self.program.save()
        global_rule = self.program.level_rules.get(level=1, category__isnull=True)
        global_rule.amount = Decimal("1.00")
        global_rule.save(update_fields=["amount"])
        override_category = Category.objects.create(name="Referral override", slug="referral-override")
        fallback_category = Category.objects.create(name="Referral fallback", slug="referral-fallback")
        ReferralLevelRule.objects.create(
            program=self.program,
            level=1,
            category=override_category,
            reward_type=ReferralLevelRule.RewardType.PERCENTAGE,
            amount=Decimal("2.00"),
        )
        override_product = Product.objects.create(
            category=override_category,
            name="Override product",
            slug="override-product",
            sku="OVERRIDE-PRODUCT",
            price=Decimal("500.00"),
            stock=1,
        )
        fallback_product = Product.objects.create(
            category=fallback_category,
            name="Fallback product",
            slug="fallback-product",
            sku="FALLBACK-PRODUCT",
            price=Decimal("500.00"),
            stock=1,
        )
        order = self.delivered_order(purchaser, total="1000.00")
        order.discount_amount = Decimal("100.00")
        order.save(update_fields=["discount_amount"])
        OrderItem.objects.create(order=order, product=override_product, product_name=override_product.name, sku=override_product.sku, unit_price=override_product.price, quantity=1, line_total=Decimal("500.00"))
        OrderItem.objects.create(order=order, product=fallback_product, product_name=fallback_product.name, sku=fallback_product.sku, unit_price=fallback_product.price, quantity=1, line_total=Decimal("500.00"))

        self.assertTrue(award_referral_for_order(order))
        reward = ReferralReward.objects.get(order=order, level=1)
        self.assertEqual(reward.amount, Decimal("13.50"))
        self.assertEqual(reward.eligible_order_amount, Decimal("900.00"))
        applied = reward.configuration_snapshot["applied_rules"]
        self.assertEqual({entry["category_name"] for entry in applied}, {"Referral override", "Referral fallback"})
        self.assertEqual({entry["eligible_order_amount"] for entry in applied}, {"450.00"})
        self.assertFalse(award_referral_for_order(order))
        self.assertEqual(ReferralReward.objects.filter(order=order, level=1).count(), 1)

    def test_disabled_category_override_uses_global_rate(self):
        from apps.catalog.models import Category, Product

        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.category_scope = ReferralProgram.CategoryScope.ALL
        self.program.category_overrides_enabled = False
        self.program.save()
        category = Category.objects.create(name="No override", slug="no-override")
        product = Product.objects.create(
            category=category,
            name="No override product",
            slug="no-override-product",
            sku="NO-OVERRIDE",
            price=Decimal("1000.00"),
            stock=1,
        )
        ReferralLevelRule.objects.create(
            program=self.program,
            level=1,
            category=category,
            reward_type=ReferralLevelRule.RewardType.PERCENTAGE,
            amount=Decimal("5.00"),
        )
        order = self.delivered_order(purchaser, total="1000.00")
        OrderItem.objects.create(order=order, product=product, product_name=product.name, sku=product.sku, unit_price=product.price, quantity=1, line_total=Decimal("1000.00"))

        self.assertTrue(award_referral_for_order(order))
        reward = ReferralReward.objects.get(order=order, level=1)
        self.assertEqual(reward.amount, Decimal("10.00"))
        self.assertEqual(reward.configuration_snapshot["category_overrides_enabled"], False)
        self.assertEqual(reward.configuration_snapshot["applied_rules"][0]["configured_amount"], "1.00")

    def test_specific_category_scope_does_not_fall_back_to_global(self):
        from apps.catalog.models import Category, Product

        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.category_scope = ReferralProgram.CategoryScope.SPECIFIC
        self.program.category_overrides_enabled = True
        self.program.save()
        selected_category = Category.objects.create(name="Selected commission", slug="selected-commission")
        unselected_category = Category.objects.create(name="Unselected commission", slug="unselected-commission")
        selected_product = Product.objects.create(
            category=selected_category,
            name="Selected item",
            slug="selected-item",
            sku="SELECTED-ITEM",
            price=Decimal("500.00"),
            stock=1,
        )
        unselected_product = Product.objects.create(
            category=unselected_category,
            name="Unselected item",
            slug="unselected-item",
            sku="UNSELECTED-ITEM",
            price=Decimal("500.00"),
            stock=1,
        )
        ReferralLevelRule.objects.create(
            program=self.program,
            level=1,
            category=selected_category,
            reward_type=ReferralLevelRule.RewardType.PERCENTAGE,
            amount=Decimal("2.00"),
        )
        order = self.delivered_order(purchaser, total="1000.00")
        OrderItem.objects.create(order=order, product=selected_product, product_name=selected_product.name, sku=selected_product.sku, unit_price=selected_product.price, quantity=1, line_total=Decimal("500.00"))
        OrderItem.objects.create(order=order, product=unselected_product, product_name=unselected_product.name, sku=unselected_product.sku, unit_price=unselected_product.price, quantity=1, line_total=Decimal("500.00"))

        self.assertTrue(award_referral_for_order(order))
        reward = ReferralReward.objects.get(order=order, level=1)
        self.assertEqual(reward.amount, Decimal("10.00"))
        self.assertEqual(reward.eligible_order_amount, Decimal("500.00"))
        self.assertEqual([entry["category_name"] for entry in reward.configuration_snapshot["applied_rules"]], ["Selected commission"])

    def test_disabled_category_rewards_are_excluded_from_mixed_order(self):
        from apps.catalog.models import Category, Product

        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.referral_rewards_enabled = True
        self.program.category_scope = ReferralProgram.CategoryScope.ALL
        self.program.save()
        enabled_category = Category.objects.create(name="Eligible reward category", slug="eligible-reward-category")
        disabled_category = Category.objects.create(
            name="Excluded reward category",
            slug="excluded-reward-category",
            referral_rewards_enabled=False,
        )
        enabled_product = Product.objects.create(
            category=enabled_category,
            name="Eligible item",
            slug="eligible-reward-item",
            sku="ELIGIBLE-REWARD-ITEM",
            price=Decimal("500.00"),
            stock=1,
        )
        disabled_product = Product.objects.create(
            category=disabled_category,
            name="Excluded item",
            slug="excluded-reward-item",
            sku="EXCLUDED-REWARD-ITEM",
            price=Decimal("500.00"),
            stock=1,
        )
        order = self.delivered_order(purchaser, total="1000.00")
        OrderItem.objects.create(order=order, product=enabled_product, product_name=enabled_product.name, sku=enabled_product.sku, unit_price=enabled_product.price, quantity=1, line_total=Decimal("500.00"))
        OrderItem.objects.create(order=order, product=disabled_product, product_name=disabled_product.name, sku=disabled_product.sku, unit_price=disabled_product.price, quantity=1, line_total=Decimal("500.00"))

        self.assertTrue(award_referral_for_order(order))
        reward = ReferralReward.objects.get(order=order, level=1)
        self.assertEqual(reward.amount, Decimal("5.00"))
        self.assertEqual(reward.eligible_order_amount, Decimal("500.00"))
        self.assertEqual(
            [entry["category_name"] for entry in reward.configuration_snapshot["applied_rules"]],
            ["Eligible reward category"],
        )

    def test_referral_order_does_not_replace_self_purchase_qualification(self):
        ancestors, purchaser = self.make_chain(1)
        self.program.qualification_threshold = Decimal("1000.00")
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser, total="2000.00")
        self.assertFalse(award_referral_for_order(order))
        self.assertFalse(ReferralReward.objects.filter(order=order).exists())
        self.assertFalse(WalletLedger.objects.filter(order=order).exists())
        self.assertEqual(qualifying_self_purchase_total(ancestors[0], self.program), Decimal("0.00"))

    def test_cumulative_delivered_self_purchases_unlock_commissions(self):
        ancestors, purchaser = self.make_chain(1)
        self.program.qualification_threshold = Decimal("1000.00")
        self.program.reward_referred_customer = False
        self.program.max_depth = 1
        self.program.save()
        referral_order = self.delivered_order(purchaser, total="2000.00")
        self.assertFalse(award_referral_for_order(referral_order))

        self.delivered_order(ancestors[0], total="999.99")
        self.assertEqual(qualifying_self_purchase_total(ancestors[0], self.program), Decimal("999.99"))
        self.assertFalse(award_referral_for_order(referral_order))
        self.delivered_order(ancestors[0], total="0.01")
        self.assertEqual(qualifying_self_purchase_total(ancestors[0], self.program), Decimal("1000.00"))
        self.assertTrue(award_referral_for_order(referral_order))

    def test_recorded_refunds_and_completed_returns_reduce_self_qualification(self):
        owner = self.customer(240)
        order = self.delivered_order(owner, total="1000.00")
        self.assertEqual(qualifying_self_purchase_total(owner, self.program), Decimal("1000.00"))
        admin = self.customer(241, is_staff=True, role=User.Role.ADMIN)
        Refund.objects.create(
            order=order,
            amount=Decimal("200.00"),
            reason="Partial refund",
            status=Refund.Status.RECORDED,
            transaction_reference="TEST-PARTIAL-REFUND",
            created_by=admin,
            updated_by=admin,
        )
        self.assertEqual(qualifying_self_purchase_total(owner, self.program), Decimal("800.00"))
        return_request = ReturnRequest.objects.create(
            customer=owner,
            order=order,
            reason="Returned order",
            status=ReturnRequest.Status.COMPLETED,
        )
        self.assertEqual(qualifying_self_purchase_total(owner, self.program), Decimal("0.00"))

    def test_pending_cod_order_does_not_credit_referral_commission(self):
        from apps.orders.services import place_order
        from apps.catalog.models import Category, Product

        purchaser = self.customer(230)
        referrer = self.customer(231)
        Referral.objects.create(referrer=referrer, referred=purchaser)
        category = Category.objects.create(name="Referral test category", slug="referral-test-category")
        product = Product.objects.create(
            category=category,
            name="Referral test product",
            slug="referral-test-product",
            sku="REFERRAL-TEST",
            price=Decimal("600.00"),
            stock=2,
        )
        self.program.reward_referred_customer = False
        self.program.max_depth = 1
        self.program.save()

        order = place_order(customer=purchaser, payload={
            "customer_name": purchaser.get_full_name(),
            "phone": purchaser.phone,
            "address": "1 Market Road",
            "delivery_pin_code": "625531",
            "items": [{"product_id": product.pk, "quantity": 1}],
        })
        self.assertEqual(order.status, Order.Status.PENDING)
        self.assertFalse(award_referral_for_order(order))
        self.assertEqual(WalletLedger.objects.filter(order=order, customer=referrer).count(), 0)

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

    def test_percentage_rewards_use_merchandise_subtotal_and_round_to_currency(self):
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

    def test_recorded_full_refund_api_reverses_referral_credits(self):
        _, purchaser = self.make_chain(2)
        self.program.max_depth = 2
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser)
        order.payment_status = Order.PaymentStatus.PAID
        order.save(update_fields=["payment_status"])
        self.assertTrue(award_referral_for_order(order))
        admin = self.customer(88, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        created = self.client.post("/api/v1/admin/refunds/", {
            "order": str(order.pk),
            "amount": "1000.00",
            "reason": "Full order refund",
        }, format="json")
        self.assertEqual(created.status_code, 201)
        refund_url = f"/api/v1/admin/refunds/{created.data['id']}/"
        approved = self.client.patch(refund_url, {"status": "approved"}, format="json")
        self.assertEqual(approved.status_code, 200)
        recorded = self.client.patch(refund_url, {
            "status": "recorded",
            "transaction_reference": "TEST-REFUND-001",
        }, format="json")
        self.assertEqual(recorded.status_code, 200)
        self.assertEqual(order.wallet_entries.filter(transaction_type=WalletLedger.TransactionType.REVERSAL).count(), 2)
        self.assertEqual(
            WalletLedger.objects.filter(order=order).aggregate(total=Sum("amount"))["total"],
            Decimal("0.00"),
        )

    def test_completed_return_api_reverses_referral_credits(self):
        _, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser)
        self.assertTrue(award_referral_for_order(order))
        return_request = ReturnRequest.objects.create(customer=purchaser, order=order, reason="Returned goods")
        admin = self.customer(89, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)

        response = self.client.patch(
            f"/api/v1/admin/returns/{return_request.pk}/",
            {"status": ReturnRequest.Status.COMPLETED},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type=WalletLedger.TransactionType.REVERSAL).count(), 1)
        self.assertEqual(WalletLedger.objects.filter(order=order).aggregate(total=Sum("amount"))["total"], Decimal("0.00"))

    def test_non_delivered_status_never_qualifies(self):
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
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="credit").count(), 0)
        change_order_status(order=order, new_status=Order.Status.CANCELLED)
        self.assertEqual(WalletLedger.objects.filter(order=order, transaction_type="reversal").count(), 0)
        self.assertFalse(ReferralReward.objects.filter(order=order, status=ReferralReward.Status.CREDITED).exists())

    def test_customer_reward_and_wallet_apis_are_scoped_to_the_authenticated_user(self):
        owner, _ = self.make_chain(1)
        other_customer = self.customer(90)
        WalletLedger.objects.create(
            customer=owner[0],
            amount=Decimal("12.00"),
            description="Private wallet entry",
            transaction_type=WalletLedger.TransactionType.ADJUSTMENT,
            idempotency_key="private-wallet-entry",
        )
        self.client.force_authenticate(owner[0])
        wallet = self.client.get("/api/v1/referrals/me/wallet/")
        rewards = self.client.get("/api/v1/referrals/me/rewards/")
        account_rewards = self.client.get("/api/v1/account/rewards/")
        self.assertEqual(wallet.status_code, 200)
        self.assertEqual(wallet.data["balance"], Decimal("12.00"))
        self.assertEqual(rewards.status_code, 200)
        self.assertEqual(account_rewards.status_code, 200)
        self.assertEqual(account_rewards.data["wallet_balance"], Decimal("12.00"))
        self.assertEqual(self.client.post("/api/v1/referrals/me/wallet/", {"amount": "1000"}).status_code, 405)
        self.assertEqual(self.client.get("/api/v1/admin/referrals/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/referrals/stats/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/rewards/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/v1/admin/referrals/network/{owner[0].pk}/").status_code, 403)
        self.client.force_authenticate(other_customer)
        other_wallet = self.client.get("/api/v1/referrals/me/wallet/")
        self.assertEqual(other_wallet.status_code, 200)
        self.assertEqual(other_wallet.data["balance"], Decimal("0.00"))
        self.assertEqual(other_wallet.data["transactions"], [])
        self.assertEqual(self.client.post("/api/v1/admin/referrals/wallet-adjustments/", {
            "customer_id": owner[0].pk,
            "amount": "50.00",
            "transaction_type": "credit",
            "reason": "Unauthorized wallet change",
            "idempotency_key": "customer-wallet-change-attempt",
        }, format="json").status_code, 403)

    def test_customer_referral_dashboard_exposes_only_their_own_rewards_and_wallet(self):
        ancestors, purchaser = self.make_chain(1)
        self.program.max_depth = 1
        self.program.reward_referred_customer = False
        self.program.save()
        order = self.delivered_order(purchaser)
        self.assertTrue(award_referral_for_order(order))

        self.client.force_authenticate(ancestors[0])
        response = self.client.get("/api/v1/referrals/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["referral_code"], ancestors[0].referral_code)
        self.assertTrue(response.data["is_qualified"])
        self.assertEqual(Decimal(response.data["wallet_balance"]), Decimal("10.00"))
        self.assertEqual(len(response.data["rewards"]), 1)
        self.assertEqual(response.data["rewards"][0]["recipient_type"], ReferralReward.RecipientType.REFERRER)
        admin = self.customer(92, is_staff=True, role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        detail = self.client.get(f"/api/v1/admin/referrals/network/{ancestors[0].pk}/")
        self.assertEqual(Decimal(detail.data["wallet_balance"]), Decimal("10.00"))
        self.assertEqual(detail.data["wallet_transactions"][0]["order"], order.pk)

    def test_referral_settings_validation_and_role_permissions(self):
        marketing_staff = self.customer(91, is_staff=True, role=User.Role.MARKETING_MANAGER)
        marketing_staff.admin_modules = ["referrals"]
        marketing_staff.save(update_fields=["admin_modules"])
        admin = self.customer(90, is_staff=True, role=User.Role.ADMIN)
        parent, child = self.customer(92), self.customer(93)
        Referral.objects.create(referrer=parent, referred=child)
        self.client.force_authenticate(marketing_staff)
        read_settings = self.client.get("/api/v1/admin/referral-settings/")
        self.assertEqual(read_settings.status_code, 200)
        self.assertFalse(read_settings.data["can_manage_settings"])
        self.assertEqual(self.client.get("/api/v1/admin/referrals/network/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/admin/referrals/stats/").status_code, 200)
        network_detail = self.client.get(f"/api/v1/admin/referrals/network/{parent.pk}/")
        self.assertEqual(network_detail.status_code, 200)
        self.assertEqual(network_detail.data["level_counts"][0]["count"], 1)
        self.assertEqual(self.client.get("/api/v1/admin/rewards/").status_code, 200)
        self.assertEqual(
            self.client.patch("/api/v1/admin/referral-settings/", {"active": False}, format="json").status_code,
            403,
        )

        self.client.force_authenticate(admin)
        grant = self.client.patch(
            f"/api/v1/admin/staff/{marketing_staff.pk}/",
            {"grant_referral_settings": True},
            format="json",
        )
        self.assertEqual(grant.status_code, 200)
        marketing_staff = User.objects.get(pk=marketing_staff.pk)
        self.client.force_authenticate(marketing_staff)
        self.assertTrue(self.client.get("/api/v1/admin/referral-settings/").data["can_manage_settings"])
        self.assertEqual(self.client.post("/api/v1/admin/referrals/wallet-adjustments/", {
            "customer_id": parent.pk,
            "amount": "5.00",
            "transaction_type": "credit",
            "reason": "Settings permission is not a wallet permission",
            "idempotency_key": "settings-not-wallet-permission",
        }, format="json").status_code, 403)
        self.client.force_authenticate(admin)

        support_staff = self.customer(95, is_staff=True, role=User.Role.CUSTOMER_SUPPORT)
        unsupported_grant = self.client.patch(
            f"/api/v1/admin/staff/{support_staff.pk}/",
            {"grant_referral_settings": True},
            format="json",
        )
        self.assertEqual(unsupported_grant.status_code, 400)

        invalid_depth = self.client.patch("/api/v1/admin/referral-settings/", {"max_depth": 7}, format="json")
        self.assertEqual(invalid_depth.status_code, 400)
        self.assertEqual(self.client.patch("/api/v1/admin/referral-settings/", {"max_depth": 6}, format="json").status_code, 400)
        invalid_percentage = self.client.patch(
            "/api/v1/admin/referral-settings/",
            {"max_depth": 1, "level_rules": [{"level": 1, "reward_type": "percentage", "amount": "100.01", "active": True}]},
            format="json",
        )
        self.assertEqual(invalid_percentage.status_code, 400)
        saved = self.client.patch("/api/v1/admin/referral-settings/", {
            "active": False,
            "max_depth": 3,
            "qualification_threshold": "750.00",
            "qualifying_order_statuses": ["delivered"],
            "level_rules": [
                {"level": 1, "reward_type": "percentage", "amount": "1.00", "active": True},
                {"level": 2, "reward_type": "percentage", "amount": "0.75", "active": True},
                {"level": 3, "reward_type": "percentage", "amount": "0.50", "active": True},
            ],
        }, format="json")
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.data["configuration_version"], 2)
        self.assertFalse(saved.data["active"])
        self.assertEqual(saved.data["max_depth"], 3)
        self.assertEqual(saved.data["qualifying_order_statuses"], ["delivered"])
        self.assertEqual([rule["amount"] for rule in saved.data["level_rules"]], ["1.00", "0.75", "0.50", "0.40", "0.30"])
        refreshed_settings = self.client.get("/api/v1/admin/referral-settings/")
        self.assertEqual(refreshed_settings.data["qualification_threshold"], "750.00")
        self.assertEqual(self.client.patch("/api/v1/admin/referral-settings/", {"qualifying_order_statuses": ["confirmed"]}, format="json").status_code, 400)
        self.assertTrue(admin.customer_service_audit_entries.filter(resource="referrals.referralprogram").exists())

        enabled = self.client.patch("/api/v1/admin/referral-settings/", {"active": True}, format="json")
        self.assertEqual(enabled.status_code, 200)
        self.assertTrue(self.client.get("/api/v1/admin/referral-settings/").data["active"])

        customer = self.customer(103)
        self.client.force_authenticate(customer)
        self.assertEqual(self.client.get("/api/v1/admin/referral-settings/").status_code, 403)
        self.assertEqual(
            self.client.patch("/api/v1/admin/referral-settings/", {"active": False}, format="json").status_code,
            403,
        )

        self.client.force_authenticate(admin)
        revoked = self.client.patch(
            f"/api/v1/admin/staff/{marketing_staff.pk}/",
            {"grant_referral_settings": False},
            format="json",
        )
        self.assertEqual(revoked.status_code, 200)
        marketing_staff = User.objects.get(pk=marketing_staff.pk)
        self.client.force_authenticate(marketing_staff)
        self.assertFalse(self.client.get("/api/v1/admin/referral-settings/").data["can_manage_settings"])
        self.assertEqual(self.client.patch(
            "/api/v1/admin/referral-settings/", {"active": False}, format="json"
        ).status_code, 403)

        self.client.force_authenticate(support_staff)
        self.assertEqual(self.client.get("/api/v1/admin/referrals/network/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/referral-settings/").status_code, 403)
        self.assertEqual(self.client.patch("/api/v1/admin/referral-settings/", {"active": False}, format="json").status_code, 403)

    def test_admin_can_configure_specific_category_rates_and_scope_is_validated(self):
        from apps.catalog.models import Category

        admin = self.customer(96, is_staff=True, role=User.Role.ADMIN)
        category = Category.objects.create(name="Referral category", slug="referral-category")
        self.client.force_authenticate(admin)
        empty_scope = self.client.patch("/api/v1/admin/referral-settings/", {
            "category_scope": ReferralProgram.CategoryScope.SPECIFIC,
        }, format="json")
        self.assertEqual(empty_scope.status_code, 400)
        saved = self.client.patch("/api/v1/admin/referral-settings/", {
            "category_scope": ReferralProgram.CategoryScope.SPECIFIC,
            "category_overrides_enabled": True,
            "level_rules": [
                {
                    "level": level,
                    "category": category.pk,
                    "reward_type": "percentage",
                    "amount": "2.50",
                    "active": True,
                }
                for level in range(1, 6)
            ],
        }, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertEqual(saved.data["category_scope"], ReferralProgram.CategoryScope.SPECIFIC)
        category_rule = next(rule for rule in saved.data["level_rules"] if rule["category"] == category.pk)
        self.assertEqual(category_rule["category_name"], category.name)
        self.assertEqual(category_rule["amount"], "2.50")

        self.assertEqual(self.client.patch(
            "/api/v1/admin/referral-settings/",
            {
                "level_rules": [{
                    "level": 1,
                    "category": category.pk,
                    "reward_type": "percentage",
                    "amount": "100.01",
                    "active": True,
                }],
            },
            format="json",
        ).status_code, 400)
        self.assertEqual(self.client.patch(
            "/api/v1/admin/referral-settings/",
            {"category_scope": ReferralProgram.CategoryScope.SPECIFIC},
            format="json",
        ).status_code, 200)

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

    def test_wallet_adjustment_requires_idempotency_key(self):
        admin = self.customer(101, is_staff=True, role=User.Role.ADMIN)
        customer = self.customer(102)
        self.client.force_authenticate(admin)
        response = self.client.post("/api/v1/admin/referrals/wallet-adjustments/", {
            "customer_id": customer.pk,
            "amount": "5.00",
            "transaction_type": "credit",
            "reason": "Test without retry key",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(WalletLedger.objects.filter(customer=customer).exists())

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
