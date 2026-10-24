from rest_framework import serializers
from .models import Order, OrderItem

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["product_name", "sku", "unit_price", "quantity", "line_total"]

class OrderSerializer(serializers.ModelSerializer):
    amount_due = serializers.SerializerMethodField()

    def get_amount_due(self, obj):
        return str(obj.total - obj.wallet_amount)

    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "order_number", "status", "payment_method", "payment_status", "customer_name", "phone", "address", "instructions", "subtotal", "discount_amount", "delivery_fee", "total", "wallet_amount", "amount_due", "delivery_pin_code", "items", "created_at", "updated_at"]

class CheckoutLineSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=99)


class CreateOrderSerializer(serializers.Serializer):
    use_wallet = serializers.BooleanField(default=False)
    checkout_key = serializers.UUIDField(required=False)
    items = CheckoutLineSerializer(many=True, allow_empty=False)
    customer_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField()
    instructions = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(choices=["cod"], default="cod")
    coupon_code = serializers.CharField(required=False, allow_blank=True, max_length=40)
    delivery_pin_code = serializers.RegexField(r"^[1-9][0-9]{5}$")

    def validate(self, attrs):
        for field in ["customer_name", "phone", "address"]:
            if not attrs[field].strip():
                raise serializers.ValidationError({field: "This field cannot be blank."})
        return attrs
