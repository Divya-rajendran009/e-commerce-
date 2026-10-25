"""Private, immutable invoice snapshots; no public download tokens or remote assets."""

from decimal import Decimal
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    LongTable,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from apps.customer_services.models import SystemSettings
from .models import Order, OrderInvoice

FONT_DIR = Path(__file__).with_name("fonts")
for name, filename in [
    ("Invoice", "NotoSansTamil-Regular.ttf"),
    ("InvoiceBold", "NotoSansTamil-Bold.ttf"),
]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename), shapable=True))


def render_invoice(snapshot, include_qr=True):
    output = BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=42,
        bottomMargin=48,
        title=snapshot["number"],
        author=snapshot["store"]["name"],
    )
    normal = ParagraphStyle(
        "body",
        fontName="Invoice",
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#273a32"),
        shaping=1,
    )
    heading = ParagraphStyle(
        "heading", parent=normal, fontName="InvoiceBold", fontSize=20, leading=28
    )
    small = ParagraphStyle("small", parent=normal, fontSize=8, leading=12)

    def p(value, style=normal):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)

    def money(value):
        return f"INR {Decimal(value):,.2f}"

    story = [
        p(snapshot["store"]["name"], heading),
        p(snapshot["store"]["address"]),
        p(snapshot["store"]["phone"]),
        Spacer(1, 18),
        p("ORDER INVOICE", heading),
        p(f"{snapshot['number']} | Issued {snapshot['issued_at']}"),
        p(f"Order {snapshot['order_number']} | Placed {snapshot['placed_at']}"),
        Spacer(1, 16),
        p("BILL TO", small),
        p(snapshot["customer"]["name"]),
        p(snapshot["customer"]["address"]),
        p(f"{snapshot['customer']['pin']} | {snapshot['customer']['phone']}"),
        Spacer(1, 20),
    ]
    rows = [[p("ITEM"), p("UNIT PRICE"), p("QTY"), p("AMOUNT")]]
    for item in snapshot["items"]:
        rows.append(
            [
                p(item["name"] + "\nSKU: " + item["sku"]),
                p(money(item["unit_price"])),
                p(item["quantity"]),
                p(money(item["line_total"])),
            ]
        )
    table = LongTable(
        rows, colWidths=[245, 100, 42, 124 - 42], repeatRows=1, hAlign="LEFT"
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef4eb")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#e0e7df")),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story += [table, Spacer(1, 18)]
    totals = [
        ("Subtotal", snapshot["subtotal"]),
        ("Discount", str(-Decimal(snapshot["discount"]))),
        ("Delivery", snapshot["delivery"]),
        ("Order total", snapshot["total"]),
        ("Wallet applied at issue", snapshot["wallet"]),
        ("COD portion", snapshot["cod"]),
    ]
    summary = Table(
        [[p(label), p(money(value))] for label, value in totals],
        colWidths=[335, 134],
        hAlign="LEFT",
    )
    summary.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#eef4eb")),
            ]
        )
    )
    story.append(
        KeepTogether(
            [
                summary,
                Spacer(1, 14),
                p(
                    f"Status at issue: {snapshot['status']}. Payment status at issue: {snapshot['payment_status']}.",
                    small,
                ),
            ]
        )
    )
    story += [
        Spacer(1, 12),
        p(
            "This order invoice is not proof of payment. No GST breakdown is supplied by the store's current catalogue. Check the order page for later cancellations, refunds, and payment updates.",
            small,
        ),
    ]
    if include_qr:
        qr = QrCodeWidget(
            f"Invoice: {snapshot['number']}\nOrder: {snapshot['order_number']}\nTotal: INR {snapshot['total']}"
        )
        x1, y1, x2, y2 = qr.getBounds()
        drawing = Drawing(
            72, 72, transform=[72 / (x2 - x1), 0, 0, 72 / (y2 - y1), 0, 0]
        )
        drawing.add(qr)
        story += [
            Spacer(1, 12),
            KeepTogether(
                [drawing, p("QR contains invoice reference and total only.", small)]
            ),
        ]

    def footer(canvas, document):
        canvas.setFont("Invoice", 8)
        canvas.setFillColor(colors.HexColor("#647265"))
        canvas.drawString(42, 27, snapshot["number"])
        canvas.drawRightString(A4[0] - 42, 27, f"Page {document.page}")

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


@transaction.atomic
def get_invoice(order, *, include_qr=True):
    order = Order.objects.select_for_update().get(pk=order.pk)
    existing = OrderInvoice.objects.filter(order=order).first()
    if existing:
        return existing
    store = SystemSettings.current()
    number = f"INV-{order.order_number}"
    snapshot = {
        "number": number,
        "order_number": order.order_number,
        "issued_at": timezone.localtime().strftime("%d %b %Y, %I:%M %p %Z"),
        "placed_at": timezone.localtime(order.created_at).strftime(
            "%d %b %Y, %I:%M %p %Z"
        ),
        "store": {
            "name": store.store_name,
            "address": store.store_location,
            "phone": store.contact_phone,
        },
        "customer": {
            "name": order.customer_name,
            "address": order.address,
            "phone": order.phone,
            "pin": order.delivery_pin_code,
        },
        "items": [
            {
                "name": item.product_name,
                "sku": item.sku,
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
            }
            for item in order.items.order_by("id")
        ],
        "subtotal": str(order.subtotal),
        "discount": str(order.discount_amount),
        "delivery": str(order.delivery_fee),
        "total": str(order.total),
        "wallet": str(order.wallet_amount),
        "cod": str(order.total - order.wallet_amount),
        "status": order.get_status_display(),
        "payment_status": order.get_payment_status_display(),
    }
    return OrderInvoice.objects.create(
        order=order,
        number=number,
        snapshot=snapshot,
        include_qr=include_qr,
        pdf=render_invoice(snapshot, include_qr),
    )


def invoice_response(invoice):
    response = HttpResponse(bytes(invoice.pdf), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{invoice.number}.pdf"'
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
