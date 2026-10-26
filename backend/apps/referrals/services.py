from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.customer_services.models import Refund, ReturnRequest
from apps.orders.models import Order
from .models import Referral, ReferralLevelRule, ReferralProgram, ReferralReward, WalletLedger

CENT = Decimal("0.01")


def effective_commission_rates(program):
    from apps.catalog.models import Category
    if not program.active:
        return []
    rules = {(rule.level, rule.category_id): rule for rule in program.level_rules.filter(active=True, level__lte=program.max_depth).select_related("category")}
    result = []
    for category in Category.objects.filter(is_active=True):
        for level in range(1, program.max_depth + 1):
            if (level == 1 and not program.reward_referrer) or (level > 1 and not program.reward_ancestors):
                continue
            amount, _, applied = _commission_for_level(program=program, level=level, item_amounts={category.pk: (category, Decimal("100"))}, rules=rules)
            if applied:
                result.append({"category_id": category.pk, "category_name": category.name, "level": level, "reward_type": "percentage", "amount": amount})
    return result


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
    pending=False,
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
        "qualification_period": program.qualification_period,
        "qualification_period_days": program.qualification_period_days,
        "qualification_window": [value.isoformat() for value in qualification_window(program)],
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
            "status": ReferralReward.Status.PENDING if pending else ReferralReward.Status.CREDITED,
            "pending_expires_at": (timezone.now() + timedelta(days=program.qualification_period_days) if program.qualification_period == "rolling_days" else qualification_window(program)[1]) if pending else None,
            "eligible_order_amount": eligible_amount,
            "configuration_version": program.configuration_version,
            "configuration_snapshot": snapshot,
        },
    )
    if not created:
        return False
    if pending:
        return False
    _credit_reward(reward)
    return True


def _credit_reward(reward):
    WalletLedger.objects.get_or_create(
        idempotency_key=f"wallet:{reward.idempotency_key}",
        defaults={
            "reward": reward, "customer": reward.recipient, "amount": reward.amount,
            "description": f"Referral level {reward.level} reward for order {reward.order.order_number}",
            "transaction_type": WalletLedger.TransactionType.CREDIT,
            "currency": "INR", "order": reward.order, "referral": reward.referral,
            "level": reward.level, "configuration_version": reward.configuration_version,
        },
    )


@transaction.atomic
def settle_pending_commissions(customer, at=None):
    program = ReferralProgram.objects.select_for_update().filter(pk=1).first()
    if not program:
        return
    User.objects.select_for_update().get(pk=customer.pk)
    at = at or timezone.now()
    pending = ReferralReward.objects.select_for_update(of=("self",)).filter(recipient=customer, status=ReferralReward.Status.PENDING).select_related("order", "referral")
    qualified = program.active and qualifying_self_purchase_total(customer, program, at) >= program.qualification_threshold
    credited = 0
    for reward in pending:
        if reward.pending_expires_at is None or reward.pending_expires_at <= at:
            reward.status = ReferralReward.Status.EXPIRED
        elif not reward.order or reward.order.status != Order.Status.DELIVERED or reward.order.return_requests.filter(status=ReturnRequest.Status.COMPLETED).exists():
            reward.status = ReferralReward.Status.REVERSED
        elif qualified:
            _credit_reward(reward)
            credited += 1
            reward.status = ReferralReward.Status.CREDITED
            Referral.objects.filter(pk=reward.referral_id).update(status=Referral.Status.COMPLETED, completed_at=at)
        else:
            continue
        reward.save(update_fields=["status"])
    return credited


def pending_commission_summary(customer):
    from django.db.models import Min
    return ReferralReward.objects.filter(recipient=customer, status=ReferralReward.Status.PENDING, pending_expires_at__gt=timezone.now()).aggregate(amount=Sum("amount"), next_expiry=Min("pending_expires_at"))


@transaction.atomic
def expire_pending_commissions(at=None):
    """Keep administrative liability current even when customers do not log in."""
    if not ReferralProgram.objects.select_for_update().filter(pk=1).exists():
        return 0
    return ReferralReward.objects.filter(status=ReferralReward.Status.PENDING).filter(
        Q(pending_expires_at__lte=at or timezone.now()) | Q(pending_expires_at__isnull=True)
    ).update(status=ReferralReward.Status.EXPIRED)



def qualification_window(program, at=None):
    now = timezone.localtime(at or timezone.now())
    if program.qualification_period == "rolling_days":
        return now - timedelta(days=program.qualification_period_days), now
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, end


def qualifying_self_purchase_total(customer, program=None, at=None):
    program = program or ReferralProgram.current()
    at = at or timezone.now()
    start, end = qualification_window(program, at)
    orders = Order.objects.filter(
        customer=customer,
        created_at__gte=start,
        created_at__lte=at,
        status=Order.Status.DELIVERED,
    ).exclude(
        return_requests__status=ReturnRequest.Status.COMPLETED,
    ).distinct()
    # Rolling windows include the evaluation instant. Calendar windows remain
    # half-open so a purchase at midnight belongs only to the new month.
    if program.qualification_period != "rolling_days":
        orders = orders.filter(created_at__lt=end)
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
    items = list(order.items.select_related("category_snapshot", "product", "product__category").order_by("pk"))
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
        category = item.category_snapshot or (item.product.category if item.product_id else None)
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
    settle_pending_commissions(purchaser)
    referral = Referral.objects.select_for_update().filter(referred=purchaser).select_related("referrer").first()
    if not referral:
        return False

    if program.reward_on_first_qualifying_order_only and ReferralReward.objects.filter(
        referral=referral,
        status__in=[ReferralReward.Status.CREDITED, ReferralReward.Status.PENDING, ReferralReward.Status.EXPIRED],
    ).exclude(order=order).exists():
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
        issued |= bool(settle_pending_commissions(ancestor))
        global_rule = rules.get((level, None))
        should_reward = program.reward_referrer if level == 1 else program.reward_ancestors
        is_qualified = qualifying_self_purchase_total(ancestor, program) >= program.qualification_threshold
        if should_reward:
            amount, commission_eligible_amount, applied_rules = _commission_for_level(
                program=program,
                level=level,
                item_amounts=item_amounts,
                rules=rules,
            )
        else:
            amount, commission_eligible_amount, applied_rules = Decimal("0.00"), Decimal("0.00"), []
        if should_reward and amount > 0:
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
                pending=not is_qualified,
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
    rewards = ReferralReward.objects.select_for_update().filter(order=order, status__in=[ReferralReward.Status.CREDITED, ReferralReward.Status.PENDING])
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
