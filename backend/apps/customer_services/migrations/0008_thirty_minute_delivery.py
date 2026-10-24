from django.db import migrations, models


def update_default_window(apps, schema_editor):
    settings = apps.get_model('customer_services', 'SystemSettings')
    settings.objects.filter(delivery_timeline__in=['6–24 hours', '6-24 hours', '6–12 hours', '6-12 hours']).update(delivery_timeline='30 minutes')


class Migration(migrations.Migration):
    dependencies = [('customer_services', '0007_systemsettings_delivery_timeline')]
    operations = [
        migrations.AlterField(model_name='systemsettings', name='delivery_timeline', field=models.CharField(default='30 minutes', max_length=60)),
        migrations.RunPython(update_default_window, migrations.RunPython.noop),
    ]
