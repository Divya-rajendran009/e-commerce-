from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from .models import Referral, ReferralProgram, ReferralReward, WalletLedger

@transaction.atomic
def award_referral_for_order(order):
    if order.status != "delivered":
        return False
    program = ReferralProgram.current()
    program = ReferralProgram.objects.select_for_update().get(pk=program.pk)
    if not program.active:
        return False
    referral = Referral.objects.select_for_update().filter(referred=order.customer, status=Referral.Status.PENDING).first()
    if not referral or order.total < program.minimum_order_amount:
        return False
    earlier_qualifying = order.__class__.objects.filter(
        customer=order.customer,
        status="delivered",
        total__gte=program.minimum_order_amount,
        created_at__lt=order.created_at,
    ).exists()
    if earlier_qualifying:
        return False
    for recipient, recipient_type, configured_amount in (
        (referral.referrer, ReferralReward.RecipientType.REFERRER, program.referrer_reward),
        (referral.referred, ReferralReward.RecipientType.CUSTOMER, program.customer_reward),
    ):
        amount = min(configured_amount, program.max_reward_per_referral) if program.max_reward_per_referral is not None else configured_amount
        if amount <= Decimal("0.00"):
            continue
        reward, created = ReferralReward.objects.get_or_create(
            referral=referral,
            recipient_type=recipient_type,
            defaults={"recipient": recipient, "reward_type": program.reward_type, "amount": amount},
        )
        if created:
            WalletLedger.objects.create(reward=reward, customer=recipient, amount=amount, description=f"Referral reward for order {order.order_number}")
    referral.status = Referral.Status.COMPLETED
    referral.qualifying_order = order
    referral.completed_at = timezone.now()
    referral.save(update_fields=["status", "qualifying_order", "completed_at"])
    return True
