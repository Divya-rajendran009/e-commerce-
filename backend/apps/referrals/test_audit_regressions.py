from decimal import Decimal
from unittest.mock import patch
from django.utils import timezone
from .test_pending import PendingCommissionTests
from .services import qualifying_self_purchase_total
from .models import ReferralReward
from apps.accounts.models import User


class ReferralAuditRegressions(PendingCommissionTests):
    def test_rolling_includes_purchase_at_evaluation_instant(self):
        at = timezone.now()
        with patch('django.utils.timezone.now', return_value=at):
            self.delivered(self.owner)
            self.assertEqual(qualifying_self_purchase_total(self.owner, at=at), Decimal('1000'))

    def test_admin_expiry_without_customer_visit_preserves_wallet(self):
        admin = User.objects.create_superuser(email='qa-admin@example.test',phone='9900000000',password='test')
        self.client.force_authenticate(admin)
        with patch('django.utils.timezone.now', return_value=self.reward.pending_expires_at):
            response = self.client.get('/api/v1/admin/referrals/stats/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['reward_liability']), 0)
        self.assertEqual(response.data['pending_rewards'], 0)
        self.reward.refresh_from_db()
        self.assertEqual(self.reward.status, ReferralReward.Status.EXPIRED)
        from .wallet import balance
        self.assertEqual(balance(self.owner), Decimal('125'))

    def test_admin_pending_count_does_not_include_relationships(self):
        admin = User.objects.create_superuser(email='qa-admin@example.test',phone='9900000000',password='test')
        self.client.force_authenticate(admin)
        response = self.client.get('/api/v1/admin/referrals/stats/')
        self.assertEqual(response.data['pending_rewards'], 1)
