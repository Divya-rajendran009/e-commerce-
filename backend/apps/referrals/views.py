from django.db.models import Sum
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.accounts.models import User
from apps.catalog.permissions import IsStoreAdmin
from .models import Referral, ReferralProgram, ReferralReward, WalletLedger
from .serializers import (
    ReferralDashboardSerializer,
    ReferralProgramSerializer,
    ReferralSerializer,
    ReferralRewardSerializer,
    ReferralValidationSerializer,
)

class ReferralValidateView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ReferralValidationSerializer

    def post(self, request):
        code = str(request.data.get("referral_code", "")).strip().upper()
        if code and not ReferralProgram.current().active:
            return Response({"valid": False, "detail": "The referral program is not currently active."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(referral_code=code, is_active=True).first()
        if not code or not user:
            return Response({"valid": False, "detail": "This referral code is not valid."}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.is_authenticated and user.pk == request.user.pk:
            return Response({"valid": False, "detail": "You cannot refer yourself."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"valid": True})

class ReferralMeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReferralDashboardSerializer

    def get(self, request):
        referrals = Referral.objects.filter(referrer=request.user).prefetch_related("rewards")
        rewards = ReferralReward.objects.filter(recipient=request.user)
        return Response({
            "referral_code": request.user.referral_code,
            "referral_url": f"/register?ref={request.user.referral_code}",
            "successful_referrals": referrals.filter(status="completed").count(),
            "pending_referrals": referrals.filter(status="pending").count(),
            "wallet_balance": WalletLedger.objects.filter(customer=request.user).aggregate(balance=Sum("amount"))["balance"] or 0,
            "referrals": ReferralSerializer(referrals, many=True).data,
            "rewards": ReferralRewardSerializer(rewards, many=True).data,
        })

class ReferralRewardsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReferralRewardSerializer

    def get(self, request):
        return Response(ReferralRewardSerializer(ReferralReward.objects.filter(recipient=request.user), many=True).data)

class AdminReferralsView(APIView):
    permission_classes = [IsStoreAdmin]
    serializer_class = ReferralSerializer

    def get(self, request):
        referrals = Referral.objects.select_related("referrer", "referred", "qualifying_order").prefetch_related("rewards")
        return Response(ReferralSerializer(referrals, many=True).data)

class AdminRewardsView(APIView):
    permission_classes = [IsStoreAdmin]
    serializer_class = ReferralRewardSerializer

    def get(self, request):
        rewards = ReferralReward.objects.select_related("recipient", "referral").order_by("-created_at")
        return Response(ReferralRewardSerializer(rewards, many=True).data)

class AdminReferralProgramView(APIView):
    permission_classes = [IsStoreAdmin]
    serializer_class = ReferralProgramSerializer

    def get(self, request):
        return Response(ReferralProgramSerializer(ReferralProgram.current()).data)

    def patch(self, request):
        program = ReferralProgram.current()
        serializer = ReferralProgramSerializer(program, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
