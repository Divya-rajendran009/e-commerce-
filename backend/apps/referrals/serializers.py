from decimal import Decimal

from rest_framework import serializers

from apps.accounts.models import User
from apps.catalog.models import Category
from .models import Referral, ReferralLevelRule, ReferralProgram, ReferralReward, WalletLedger


class ReferralLevelRuleSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        allow_null=True,
        required=False,
    )
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)

    class Meta:
        model = ReferralLevelRule
        fields = ["level", "reward_type", "amount", "active", "category", "category_name"]

    def validate(self, attrs):
        reward_type = attrs.get("reward_type", getattr(self.instance, "reward_type", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", Decimal("0")))
        if reward_type == ReferralLevelRule.RewardType.PERCENTAGE and amount > Decimal("100"):
            raise serializers.ValidationError("Percentage rewards cannot exceed 100%.")
        return attrs


class ReferralProgramSerializer(serializers.ModelSerializer):
    level_rules = ReferralLevelRuleSerializer(many=True, required=False)

    class Meta:
        model = ReferralProgram
        fields = [
            "active", "reward_type", "customer_reward",
            "qualification_threshold", "qualification_period", "qualification_period_days", "max_reward_per_referral", "max_depth",
            "category_scope", "category_overrides_enabled",
            "referral_rewards_enabled",
            "qualifying_order_statuses", "reward_on_first_qualifying_order_only",
            "reward_referrer", "reward_ancestors", "reward_referred_customer",
            "wallet_spending_enabled", "wallet_expiry_days",
            "configuration_version", "level_rules", "updated_at",
        ]
        read_only_fields = ["configuration_version", "updated_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["max_depth"] = min(data["max_depth"], 5)
        data["qualifying_order_statuses"] = ["delivered"]
        data["level_rules"] = [
            rule for rule in data["level_rules"] if rule["level"] <= 5
        ]
        return data

    def validate_max_depth(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Referral depth must be between 1 and 5.")
        return value

    def validate_qualifying_order_statuses(self, value):
        if value != ["delivered"]:
            raise serializers.ValidationError("Referral commissions are earned only after an order is delivered.")
        return value

    def validate(self, attrs):
        max_depth = attrs.get("max_depth", getattr(self.instance, "max_depth", 5))
        rules = attrs.get("level_rules")
        if rules is not None:
            keys = [
                (rule["level"], rule.get("category").pk if rule.get("category") else None)
                for rule in rules
            ]
            if len(keys) != len(set(keys)):
                raise serializers.ValidationError({"level_rules": "Each level and category can only have one reward rule."})
            if any(level > 5 for level, _ in keys):
                raise serializers.ValidationError({"level_rules": "A reward rule cannot be configured beyond the maximum referral depth."})
            for rule in rules:
                if rule["reward_type"] != ReferralLevelRule.RewardType.PERCENTAGE:
                    raise serializers.ValidationError({"level_rules": "Referral commission rules must use percentages."})
                if rule["reward_type"] == ReferralLevelRule.RewardType.PERCENTAGE and rule["amount"] > Decimal("100"):
                    raise serializers.ValidationError({"level_rules": "Percentage rewards cannot exceed 100%."})
        resulting_keys = set()
        if self.instance:
            existing_rules = self.instance.level_rules.values_list("level", "category_id")
            if rules is None:
                resulting_keys.update(existing_rules)
            else:
                resulting_keys.update((level, category_id) for level, category_id in existing_rules if category_id is None)
                resulting_keys.update(keys)
        elif rules is not None:
            resulting_keys.update(keys)

        missing_global_levels = set(range(1, max_depth + 1)) - {
            level for level, category_id in resulting_keys if category_id is None
        }
        if missing_global_levels:
            raise serializers.ValidationError({
                "level_rules": f"Configure a global percentage rate for every enabled referral level; missing levels: {', '.join(map(str, sorted(missing_global_levels)))}."
            })

        selected_scope = attrs.get("category_scope", getattr(self.instance, "category_scope", ReferralProgram.CategoryScope.ALL))
        if selected_scope == ReferralProgram.CategoryScope.SPECIFIC:
            selected_category_ids = {category_id for _, category_id in resulting_keys if category_id is not None}
            if not selected_category_ids:
                raise serializers.ValidationError({"level_rules": "Select at least one category and configure its referral rates."})
        else:
            selected_category_ids = {category_id for _, category_id in resulting_keys if category_id is not None}

        for category_id in selected_category_ids:
            configured_levels = {
                level for level, configured_category_id in resulting_keys
                if configured_category_id == category_id
            }
            missing_levels = set(range(1, max_depth + 1)) - configured_levels
            if missing_levels:
                raise serializers.ValidationError({
                    "level_rules": f"Configure a percentage rate for every enabled level in category {category_id}; missing levels: {', '.join(map(str, sorted(missing_levels)))}."
                })
        return attrs

    def update(self, instance, validated_data):
        level_rules = validated_data.pop("level_rules", None)
        instance = super().update(instance, validated_data)
        if level_rules is not None:
            existing = {
                (rule.level, rule.category_id): rule
                for rule in instance.level_rules.select_related("category").all()
            }
            received_keys = set()
            for rule_data in level_rules:
                level = rule_data["level"]
                category = rule_data.get("category")
                category_id = category.pk if category else None
                key = (level, category_id)
                received_keys.add(key)
                rule = existing.get(key)
                if rule:
                    for field, value in rule_data.items():
                        setattr(rule, field, value)
                    rule.save()
                else:
                    ReferralLevelRule.objects.create(program=instance, **rule_data)
            for key, rule in existing.items():
                if key[1] is not None and key not in received_keys:
                    rule.delete()
        return instance


class ReferralRewardSerializer(serializers.ModelSerializer):
    recipient_email = serializers.EmailField(source="recipient.email", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True, allow_null=True)

    class Meta:
        model = ReferralReward
        fields = [
            "id", "recipient_email", "recipient_type", "order_number", "level",
            "reward_type", "amount", "status", "eligible_order_amount",
            "configuration_version", "created_at",
        ]


class CustomerReferralRewardSerializer(serializers.ModelSerializer):
    category_breakdown = serializers.SerializerMethodField()

    def get_category_breakdown(self, obj):
        return [{key: rule.get(key) for key in ("category_name", "configured_amount", "reward_type", "eligible_order_amount")} for rule in obj.configuration_snapshot.get("applied_rules", [])]
    order_number = serializers.CharField(source="order.order_number", read_only=True, allow_null=True)

    class Meta:
        model = ReferralReward
        fields = ["id", "recipient_type", "order_number", "level", "amount", "status", "category_breakdown", "created_at"]


class WalletLedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletLedger
        fields = [
            "id", "amount", "description", "transaction_type", "currency",
            "order", "level", "status", "created_at",
        ]


class AdminWalletLedgerSerializer(WalletLedgerSerializer):
    customer_email = serializers.EmailField(source="customer.email", read_only=True)

    class Meta(WalletLedgerSerializer.Meta):
        fields = WalletLedgerSerializer.Meta.fields + ["customer_email", "idempotency_key"]


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


class CustomerReferralSerializer(serializers.ModelSerializer):
    level = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = ["id", "level", "status", "created_at"]

    def get_level(self, obj):
        return 1


class ReferralDashboardSerializer(serializers.Serializer):
    referral_code = serializers.CharField()
    referral_url = serializers.CharField()
    qualification_threshold = serializers.DecimalField(max_digits=10, decimal_places=2)
    qualifying_self_purchase_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    qualification_period = serializers.CharField()
    qualification_period_start = serializers.DateTimeField()
    qualification_period_end = serializers.DateTimeField()
    qualification_remaining = serializers.DecimalField(max_digits=10, decimal_places=2)
    qualification_progress_percent = serializers.IntegerField()
    is_qualified = serializers.BooleanField()
    commission_rates = serializers.ListField(child=serializers.DictField())
    commission_category_scope = serializers.ChoiceField(choices=ReferralProgram.CategoryScope.choices)
    network_levels = serializers.ListField(child=serializers.DictField())
    pending_commissions = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_next_expiry = serializers.DateTimeField(allow_null=True)
    wallet_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    wallet_transactions = WalletLedgerSerializer(many=True)
    rewards = CustomerReferralRewardSerializer(many=True)


class AdminWalletAdjustmentSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    transaction_type = serializers.ChoiceField(choices=["credit", "debit"])
    reason = serializers.CharField(max_length=180)
    idempotency_key = serializers.CharField(max_length=100)

    def validate_customer_id(self, value):
        if not User.objects.filter(pk=value, role=User.Role.CUSTOMER).exists():
            raise serializers.ValidationError("Customer account was not found.")
        return value
