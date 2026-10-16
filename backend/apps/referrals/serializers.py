from rest_framework import serializers
from .models import Referral, ReferralProgram, ReferralReward

class ReferralProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralProgram
        fields = ["active", "reward_type", "referrer_reward", "customer_reward", "minimum_order_amount", "max_reward_per_referral", "updated_at"]
        read_only_fields = ["updated_at"]

class ReferralRewardSerializer(serializers.ModelSerializer):
    recipient_email = serializers.EmailField(source="recipient.email", read_only=True)

    class Meta:
        model = ReferralReward
        fields = ["id", "recipient_email", "recipient_type", "reward_type", "amount", "created_at"]

class ReferralValidationSerializer(serializers.Serializer):
    referral_code = serializers.CharField(max_length=8)

class ReferralValidationResultSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    detail = serializers.CharField(required=False)

class ReferralSerializer(serializers.ModelSerializer):
    referrer_email = serializers.EmailField(source="referrer.email", read_only=True)
    referred_email = serializers.EmailField(source="referred.email", read_only=True)
    rewards = ReferralRewardSerializer(many=True, read_only=True)
    order_number = serializers.CharField(source="qualifying_order.order_number", read_only=True, allow_null=True)

    class Meta:
        model = Referral
        fields = ["id", "referrer_email", "referred_email", "status", "order_number", "created_at", "completed_at", "rewards"]

class ReferralDashboardSerializer(serializers.Serializer):
    referral_code = serializers.CharField()
    referral_url = serializers.CharField()
    successful_referrals = serializers.IntegerField()
    pending_referrals = serializers.IntegerField()
    wallet_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    referrals = ReferralSerializer(many=True)
    rewards = ReferralRewardSerializer(many=True)
