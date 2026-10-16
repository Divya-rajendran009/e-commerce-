from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

class ReferralProgram(models.Model):
    active = models.BooleanField(default=True)
    reward_type = models.CharField(max_length=12, choices=[("wallet", "Wallet credit")], default="wallet")
    referrer_reward = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("100.00"), validators=[MinValueValidator(0)])
    customer_reward = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("50.00"), validators=[MinValueValidator(0)])
    minimum_order_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("500.00"), validators=[MinValueValidator(0)])
    max_reward_per_referral = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def current(cls):
        return cls.objects.get_or_create(pk=1)[0]

class Referral(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending first qualifying order"
        COMPLETED = "completed", "Reward issued"
        INACTIVE = "inactive", "Program inactive"

    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="sent_referrals", on_delete=models.PROTECT)
    referred = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="referral_attribution", on_delete=models.PROTECT)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    qualifying_order = models.ForeignKey("orders.Order", null=True, blank=True, related_name="qualified_referrals", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["referrer", "status"])]
        constraints = [models.CheckConstraint(condition=~models.Q(referrer=models.F("referred")), name="referral_not_self")]

class ReferralReward(models.Model):
    class RecipientType(models.TextChoices):
        REFERRER = "referrer", "Referrer"
        CUSTOMER = "customer", "Referred customer"

    referral = models.ForeignKey(Referral, related_name="rewards", on_delete=models.PROTECT)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="referral_rewards", on_delete=models.PROTECT)
    recipient_type = models.CharField(max_length=12, choices=RecipientType.choices)
    reward_type = models.CharField(max_length=12, default="wallet")
    amount = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(0)])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["referral", "recipient_type"], name="unique_referral_reward_recipient")]
        ordering = ["-created_at"]

class WalletLedger(models.Model):
    reward = models.OneToOneField(ReferralReward, related_name="ledger_entry", on_delete=models.PROTECT)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="wallet_entries", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    description = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
