import hashlib
from django.http import HttpResponse, HttpResponseNotModified, Http404
from django.views.decorators.http import require_safe
from .models import Product


@require_safe
def product_image(request, pk):
    product = Product.objects.only("image_data", "image_content_type").filter(pk=pk).first()
    if not product or not product.image_data:
        raise Http404
    content = bytes(product.image_data)
    etag = '"' + hashlib.sha256(content).hexdigest() + '"'
    response = HttpResponseNotModified() if request.headers.get("If-None-Match") == etag else HttpResponse(content, content_type=product.image_content_type)
    response["ETag"] = etag
    response["Cache-Control"] = "public, max-age=0, must-revalidate"
    response["X-Content-Type-Options"] = "nosniff"
    return response
