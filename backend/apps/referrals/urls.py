from django.urls import path
from .views import AdminReferralProgramView, AdminReferralsView, AdminRewardsView, ReferralMeView, ReferralRewardsView, ReferralValidateView

urlpatterns = [
    path("referrals/validate/", ReferralValidateView.as_view()),
    path("referrals/me/", ReferralMeView.as_view()),
    path("referrals/me/rewards/", ReferralRewardsView.as_view()),
    path("admin/referrals/", AdminReferralsView.as_view()),
    path("admin/rewards/", AdminRewardsView.as_view()),
    path("admin/referral-settings/", AdminReferralProgramView.as_view()),
]
