from rest_framework import serializers
from .models import Category, Product

MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024
IMAGE_SIGNATURES = {
    "image/jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
    "image/png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/gif": lambda content: content.startswith((b"GIF87a", b"GIF89a")),
    "image/webp": lambda content: content.startswith(b"RIFF") and content[8:12] == b"WEBP",
}

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "is_active", "referral_rewards_enabled"]


class PublicCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "is_active"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    in_stock = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "sku", "description", "price", "mrp", "stock", "in_stock", "image_url", "is_active", "is_featured", "category", "category_name"]

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        mrp = attrs.get("mrp", getattr(self.instance, "mrp", None))
        if mrp is not None and price is not None and mrp < price:
            raise serializers.ValidationError({"mrp": "MRP must be greater than or equal to the selling price."})
        return attrs

    def get_in_stock(self, obj) -> bool:
        return obj.stock > 0 and obj.is_active and obj.category.is_active

    def get_image_url(self, obj) -> str:
        if obj.image:
            url = obj.image.url
            request = self.context.get("request")
            return request.build_absolute_uri(url) if request else url
        return obj.image_url


class AdminProductSerializer(ProductSerializer):
    image = serializers.FileField(required=False, write_only=True, allow_empty_file=False)

    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields + ["barcode", "low_stock_threshold", "image", "wholesale_price"]

    def validate_image(self, image):
        if image.size > MAX_PRODUCT_IMAGE_SIZE:
            raise serializers.ValidationError("Image must be 5 MB or smaller.")
        signature_check = IMAGE_SIGNATURES.get(image.content_type)
        if not signature_check:
            raise serializers.ValidationError("Upload a JPEG, PNG, GIF, or WebP image.")
        header = image.read(12)
        image.seek(0)
        if not signature_check(header):
            raise serializers.ValidationError("The uploaded file is not a valid image of the selected type.")
        return image
