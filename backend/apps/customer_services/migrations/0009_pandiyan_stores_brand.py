from django.db import migrations, models


def correct_store_name(apps, schema_editor):
    settings = apps.get_model("customer_services", "SystemSettings")
    settings.objects.using(schema_editor.connection.alias).filter(
        store_name__in=["Pandiyan Store", "Paniam Stores", "PANIAM STORES", "PANDIYAN STORE"]
    ).update(store_name="Pandiyan Stores")


class Migration(migrations.Migration):
    dependencies = [("customer_services", "0008_thirty_minute_delivery")]

    operations = [
        migrations.AlterField(
            model_name="systemsettings",
            name="store_name",
            field=models.CharField(default="Pandiyan Stores", max_length=120),
        ),
        migrations.RunPython(correct_store_name, migrations.RunPython.noop),
    ]
