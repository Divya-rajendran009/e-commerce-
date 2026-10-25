from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe


@never_cache
@require_safe
def health(request):
    """Confirm that public API traffic reached Django, without requiring a DB."""
    return JsonResponse({"status": "ok", "service": "pandiyan-api"})
