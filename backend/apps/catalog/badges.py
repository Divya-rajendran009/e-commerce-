from datetime import timedelta
from django.db.models import Sum
from django.utils import timezone


def sales_badge_supported(product, badge):
    if badge not in {"popular", "best_seller"}:
        return True
    if not product or not product.pk:
        return False
    from apps.orders.models import OrderItem
    sales = OrderItem.objects.filter(
        order__status="delivered", order__created_at__gte=timezone.now() - timedelta(days=30)
    ).values("product_id").annotate(units=Sum("quantity"))
    if badge == "popular":
        return sales.filter(product_id=product.pk, units__gte=5).exists()
    leaders = list(sales.filter(units__gte=10).order_by("-units", "product_id").values_list("product_id", flat=True)[:5])
    return product.pk in leaders
