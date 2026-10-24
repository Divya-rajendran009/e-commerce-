from decimal import Decimal, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Sum
from apps.accounts.models import User
from .models import WalletLedger


def balance(customer):
    return WalletLedger.objects.filter(customer=customer).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


@transaction.atomic
def restore_order_wallet(order, *, full=False):
    """Restore the wallet-funded share of cumulative recorded refunds, once."""
    if not order.wallet_amount:
        return
    User.objects.select_for_update().get(pk=order.customer_id)
    refunded = order.total if full else (order.refunds.filter(status="recorded").aggregate(total=Sum("amount"))["total"] or Decimal("0"))
    target = min(order.wallet_amount, (order.wallet_amount * refunded / order.total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) if order.total else order.wallet_amount
    restored = WalletLedger.objects.filter(order=order, transaction_type="restore").aggregate(total=Sum("amount"))["total"] or Decimal("0")
    if target > restored:
        WalletLedger.objects.create(customer_id=order.customer_id, order=order, amount=target-restored,
            transaction_type="restore", description=f"Wallet refund for {order.order_number}",
            idempotency_key=f"restore:{order.pk}:{target}")
