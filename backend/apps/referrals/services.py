from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.customer_services.models import Refund, ReturnRequest
from apps.orders.models import Order
from .models import Referral, ReferralLevelRule, ReferralProgram, ReferralReward, WalletLedger

CENT = Decimal("0.01")


def _reward_amount(rule, eligible_amount):
    if rule.reward_type == ReferralLevelRule.RewardType.PERCENTAGE:
        return (eligible_amount * rule.amount / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
    return rule.amount.quantize(CENT, rounding=ROUND_HALF_UP)


def _create_reward(
    *,
    referral,
    order,
    recipient,
    recipient_type,
    level,
    amount,
    eligible_amount,
    program,
    rule,
    applied_rules=None,
):
    amount = amount.quantize(CENT, rounding=ROUND_HALF_UP)
    if program.max_reward_per_referral is not None:
        amount = min(amount, program.max_reward_per_referral)
    if amount <= Decimal("0.00"):
        return False
    reward_key = f"referral:{order.pk}:{recipient.pk}:{level}"
    snapshot = {
        "program_version": program.configuration_version,
        "level": level,
        "reward_type": rule.reward_type if rule else "fixed",
        "configured_amount": str(rule.amount if rule else amount),
        "qualification_threshold": str(program.qualification_threshold),
        "max_depth": min(program.max_depth, 5),
        "category_scope": program.category_scope,
        "category_overrides_enabled": program.category_overrides_enabled,
        "referral_rewards_enabled": program.referral_rewards_enabled,
        "applied_rules": applied_rules or [{
            "category_id": rule.category_id if rule else None,
            "category_name": rule.category.name if rule and rule.category_id else None,
            "rule_id": rule.pk if rule else None,
            "reward_type": rule.reward_type if rule else "fixed",
            "configured_amount": str(rule.amount if rule else amount),
            "eligible_order_amount": str(eligible_amount),
        }],
    }
    reward, created = ReferralReward.objects.get_or_create(
        idempotency_key=reward_key,
        defaults={
            "referral": referral,
            "recipient": recipient,
            "recipient_type": recipient_type,
            "order": order,
            "level": level,
            "reward_type": program.reward_type,
            "amount": amount,
            "status": ReferralReward.Status.CREDITED,
            "eligible_order_amount": eligible_amount,
            "configuration_version": program.configuration_version,
            "configuration_snapshot": snapshot,
        },
    )
    if not created:
        return False
    WalletLedger.objects.create(
        reward=reward,
        customer=recipient,
        amount=amount,
        description=f"Referral level {level} reward for order {order.order_number}",
        transaction_type=WalletLedger.TransactionType.CREDIT,
        currency="INR",
        order=order,
        referral=referral,
        level=level,
        configuration_version=program.configuration_version,
        idempotency_key=f"wallet:{reward_key}",
    )
    return True


def qualifying_self_purchase_total(customer, program=None):
    program = program or ReferralProgram.current()
    orders = Order.objects.filter(
        customer=customer,
        status=Order.Status.DELIVERED,
    ).exclude(
        return_requests__status=ReturnRequest.Status.COMPLETED,
    ).distinct()
    order_amounts = list(
        orders.values("id").annotate(
            amount=Sum(F("subtotal") - F("discount_amount")),
        ).values_list("id", "amount")
    )
    if not order_amounts:
        return Decimal("0.00")
    refund_amounts = dict(
        Refund.objects.filter(
            order_id__in=[order_id for order_id, _ in order_amounts],
            status=Refund.Status.RECORDED,
        ).values("order_id").annotate(total=Sum("amount")).values_list("order_id", "total")
    )
    eligible_total = sum(
        (
            max(Decimal("0.00"), amount - min(amount, refund_amounts.get(order_id, Decimal("0.00")) or Decimal("0.00")))
            for order_id, amount in order_amounts
        ),
        Decimal("0.00"),
    )
    return eligible_total.quantize(CENT, rounding=ROUND_HALF_UP)


def _eligible_item_amounts(order):
    eligible_total = max(order.subtotal - order.discount_amount, Decimal("0.00")).quantize(
        CENT, rounding=ROUND_HALF_UP,
    )
    items = list(order.items.select_related("product", "product__category").order_by("pk"))
    if not items:
        return {None: (None, eligible_total)} if eligible_total > 0 else {}

    gross_total = sum((item.line_total for item in items), Decimal("0.00"))
    if gross_total <= 0 or eligible_total <= 0:
        return {}

    result = {}
    remaining = eligible_total
    for index, item in enumerate(items):
        if index == len(items) - 1:
            amount = remaining
        else:
            amount = (eligible_total * item.line_total / gross_total).quantize(
                CENT, rounding=ROUND_HALF_UP,
            )
            amount = min(max(amount, Decimal("0.00")), remaining)
            remaining -= amount
        category = item.product.category if item.product_id else None
        category_id = category.pk if category else None
        if category_id in result:
            existing_category, current = result[category_id]
            result[category_id] = (existing_category, current + amount)
        else:
            result[category_id] = (category, amount)
    return result


def _commission_for_level(*, program, level, item_amounts, rules):
    amount = Decimal("0.00")
    eligible_amount = Decimal("0.00")
    applied_rules = []
    for category_id, (category, category_amount) in item_amounts.items():
        category_rewards_enabled = (
            category.referral_rewards_enabled
            if category and category.referral_rewards_enabled is not None
            else program.referral_rewards_enabled
        )
        if not category_rewards_enabled:
            continue
        category_rule = rules.get((level, category_id)) if category_id is not None else None
        if program.category_scope == ReferralProgram.CategoryScope.SPECIFIC:
            rule = category_rule
        elif program.category_overrides_enabled and category_rule:
            rule = category_rule
        else:
            rule = rules.get((level, None))
        if not rule or not rule.active or category_amount <= 0:
            continue
        amount += _reward_amount(rule, category_amount)
        eligible_amount += category_amount
        applied_rules.append({
            "category_id": category_id,
            "category_name": category.name if category else None,
            "rule_id": rule.pk,
            "reward_type": rule.reward_type,
            "configured_amount": str(rule.amount),
            "eligible_order_amount": str(category_amount),
            "category_rewards_enabled": category_rewards_enabled,
        })
    return (
        amount.quantize(CENT, rounding=ROUND_HALF_UP),
        eligible_amount.quantize(CENT, rounding=ROUND_HALF_UP),
        applied_rules,
    )


@transaction.atomic
def award_referral_for_order(order):
    program = ReferralProgram.objects.select_for_update().filter(pk=1).first()
    if not program:
        return False
    if not program.active or order.status != Order.Status.DELIVERED:
        return False
    eligible_amount = max(order.subtotal - order.discount_amount, Decimal("0.00"))
    if eligible_amount <= Decimal("0.00"):
        return False

    purchaser = User.objects.select_for_update().filter(pk=order.customer_id).first()
    if not purchaser:
        return False
    referral = Referral.objects.select_for_update().filter(referred=purchaser).select_related("referrer").first()
    if not referral:
        return False

    if program.reward_on_first_qualifying_order_only and ReferralReward.objects.filter(
        referral=referral,
        status=ReferralReward.Status.CREDITED,
    ).exists():
        return False

    rules = {
        (rule.level, rule.category_id): rule
        for rule in ReferralLevelRule.objects.filter(
            program=program, active=True, level__lte=min(program.max_depth, 5),
        ).select_related("category")
    }
    item_amounts = _eligible_item_amounts(order)
    issued = False

    if program.reward_referred_customer and program.customer_reward > 0:
        customer_rule = ReferralLevelRule(
            program=program,
            level=1,
            reward_type=ReferralLevelRule.RewardType.FIXED,
            amount=program.customer_reward,
        )
        issued |= _create_reward(
            referral=referral,
            order=order,
            recipient=referral.referred,
            recipient_type=ReferralReward.RecipientType.CUSTOMER,
            level=0,
            amount=program.customer_reward,
            eligible_amount=eligible_amount,
            program=program,
            rule=customer_rule,
        )

    ancestor = referral.referrer
    seen = {purchaser.pk}
    for level in range(1, min(program.max_depth, 5) + 1):
        if not ancestor or ancestor.pk in seen:
            break
        seen.add(ancestor.pk)
        global_rule = rules.get((level, None))
        should_reward = program.reward_referrer if level == 1 else program.reward_ancestors
        is_qualified = qualifying_self_purchase_total(ancestor, program) >= program.qualification_threshold
        if should_reward and is_qualified:
            amount, commission_eligible_amount, applied_rules = _commission_for_level(
                program=program,
                level=level,
                item_amounts=item_amounts,
                rules=rules,
            )
        else:
            amount, commission_eligible_amount, applied_rules = Decimal("0.00"), Decimal("0.00"), []
        if should_reward and is_qualified and amount > 0:
            used_rule = next(
                (rule for rule in rules.values() if rule.pk == applied_rules[0]["rule_id"]),
                global_rule,
            )
            recipient_type = ReferralReward.RecipientType.REFERRER if level == 1 else ReferralReward.RecipientType.ANCESTOR
            issued |= _create_reward(
                referral=referral,
                order=order,
                recipient=ancestor,
                recipient_type=recipient_type,
                level=level,
                amount=amount,
                eligible_amount=commission_eligible_amount,
                program=program,
                rule=used_rule,
                applied_rules=applied_rules,
            )
        ancestor_referral = Referral.objects.filter(referred=ancestor).select_related("referrer").first()
        ancestor = ancestor_referral.referrer if ancestor_referral else None

    if issued:
        referral.status = Referral.Status.COMPLETED
        if referral.qualifying_order_id is None:
            referral.qualifying_order = order
        referral.completed_at = referral.completed_at or timezone.now()
        referral.save(update_fields=["status", "qualifying_order", "completed_at"])
    return issued


@transaction.atomic
def reverse_referral_rewards_for_order(order, *, reason):
    rewards = ReferralReward.objects.select_for_update().filter(order=order, status=ReferralReward.Status.CREDITED)
    reversed_count = 0
    for reward in rewards:
        entries = WalletLedger.objects.select_for_update().filter(
            reward=reward,
            transaction_type=WalletLedger.TransactionType.CREDIT,
            amount__gt=0,
        )
        for entry in entries:
            WalletLedger.objects.get_or_create(
                idempotency_key=f"reversal:{entry.idempotency_key}",
                defaults={
                    "reward": reward,
                    "customer": entry.customer,
                    "amount": -entry.amount,
                    "description": f"Referral reward reversed for order {order.order_number}: {reason}"[:200],
                    "transaction_type": WalletLedger.TransactionType.REVERSAL,
                    "currency": entry.currency,
                    "order": order,
                    "referral": reward.referral,
                    "level": reward.level,
                    "configuration_version": reward.configuration_version,
                    "reversal_of": entry,
                },
            )
            if entry.status != WalletLedger.Status.REVERSED:
                entry.status = WalletLedger.Status.REVERSED
                entry.save(update_fields=["status"])
        reward.status = ReferralReward.Status.REVERSED
        reward.save(update_fields=["status"])
        reversed_count += 1
    return reversed_count
