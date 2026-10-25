from django.db import migrations


def record_existing_status(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    Event = apps.get_model("orders", "OrderStatusEvent")
    alias = schema_editor.connection.alias
    batch = []
    for order in Order.objects.using(alias).all().iterator(chunk_size=500):
        batch.append(Event(order_id=order.pk, status=order.status, kind="recorded", created_at=order.updated_at))
        if len(batch) == 500:
            Event.objects.using(alias).bulk_create(batch)
            batch = []
    Event.objects.using(alias).bulk_create(batch)


class Migration(migrations.Migration):
    dependencies = [("orders", "0005_orderinvoice_orderstatusevent_and_more")]
    operations = [migrations.RunPython(record_existing_status, migrations.RunPython.noop)]
