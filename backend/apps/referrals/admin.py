from django.contrib import admin
from .models import Referral, ReferralProgram, ReferralReward, WalletLedger

@admin.register(ReferralProgram)
class ReferralProgramAdmin(admin.ModelAdmin):
    list_display = ["active", "reward_type", "referrer_reward", "customer_reward", "minimum_order_amount"]

@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ["referrer", "referred", "status", "qualifying_order", "created_at"]
    list_filter = ["status"]
    search_fields = ["referrer__email", "referred__email"]
    readonly_fields = ["referrer", "referred", "qualifying_order", "created_at", "completed_at"]

@admin.register(ReferralReward)
class ReferralRewardAdmin(admin.ModelAdmin):
    list_display = ["recipient", "recipient_type", "amount", "reward_type", "created_at"]
    readonly_fields = ["referral", "recipient", "recipient_type", "reward_type", "amount", "created_at"]

@admin.register(WalletLedger)
class WalletLedgerAdmin(admin.ModelAdmin):
    list_display = ["customer", "amount", "description", "created_at"]
    readonly_fields = ["reward", "customer", "amount", "description", "created_at"]
