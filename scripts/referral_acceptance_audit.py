"""Reproducible, offline acceptance audit. Requires an EMPTY isolated QA database."""
import os, sys, json, socket
from pathlib import Path
from datetime import datetime, timedelta, timezone as tz
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.referral_qa_settings'
os.environ['DJANGO_DEBUG'] = 'true'
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from django.db.models import Sum, Count
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.catalog.models import Category, Product
from apps.orders.models import Order
from apps.referrals.models import ReferralProgram, Referral, ReferralReward, WalletLedger
from apps.referrals.services import settle_pending_commissions, qualifying_self_purchase_total, award_referral_for_order
from apps.customer_services.models import Refund, PaymentEvent
assert settings.DATABASES['default']['ENGINE'] == 'django.db.backends.sqlite3'
assert Path(settings.DATABASES['default']['NAME']).name == 'referral-qa.sqlite3'
call_command('migrate', verbosity=0)
assert not User.objects.exists(), 'Use a fresh QA database; existing records are never deleted by this script.'
OUT = ROOT / '.local' / 'referral-audit-real-catalog'
OUT.mkdir(parents=True, exist_ok=True)
rows, accounts, snapshots = [], {}, {}
now = datetime(2026,10,15,12,tzinfo=tz.utc)
clock = [now]
password = 'Local-QA-Only-7!mango'
client, admin_client = APIClient(), APIClient()
def check(name, expected, actual):
    rows.append({'test':name, 'expected':str(expected), 'actual':str(actual), 'result':'PASS' if expected == actual else 'FAIL'})
    print(rows[-1], flush=True)
def req(c, method, path, data=None, status=200):
    r = getattr(c, method)('/api/v1/'+path, data, format='json') if method != 'get' else c.get('/api/v1/'+path)
    assert r.status_code == status, (method,path,r.status_code,r.data)
    return r.data

def dashboard(i):
    client.force_authenticate(accounts[i]); return req(client,'get','referrals/me/')
def wallet(i):
    return WalletLedger.objects.filter(customer=accounts[i]).aggregate(v=Sum('amount'))['v'] or Decimal(0)
def configure(**kw):
    req(admin_client,'patch','admin/referral-settings/',kw)

def order(i, amount, cancel=False):
    # Existing catalogue products at their saved prices; quantities exercise exact thresholds.
    baskets={
        500:{40:1,42:1,31:2,32:1,33:4,37:2,39:1},
        600:{40:1,42:1,41:2,37:2,39:1,47:1,48:1},
        1000:{40:2,42:2,41:2,31:2,32:1,33:4,37:2,39:1,47:1,48:1},
    }
    baskets[1500]={pid:baskets[1000].get(pid,0)+baskets[500].get(pid,0) for pid in set(baskets[1000])|set(baskets[500])}
    quantities=baskets[int(amount)]
    before={pid:Product.objects.get(pk=pid).stock for pid in quantities}
    check(f'Actual product basket totals {amount}',Decimal(amount),sum((Product.objects.get(pk=pid).price*q for pid,q in quantities.items()),Decimal(0)))
    client.force_authenticate(accounts[i])
    data = dict(customer_name=accounts[i].first_name,phone=accounts[i].phone,address='ISOLATED QA - DO NOT DISPATCH',delivery_pin_code='625531',payment_method='cod',items=[{'product_id':pid,'quantity':q} for pid,q in quantities.items()],checkout_key=str(uuid4()))
    r = req(client,'post','orders/',data,201)
    retry = req(client,'post','orders/',data,201)
    check(f'Checkout retry customer {i}',r['id'],retry['id'])
    o = Order.objects.get(pk=r['id'])
    check(f'Stock deducted once {o.order_number}',{pid:before[pid]-q for pid,q in quantities.items()},{pid:Product.objects.get(pk=pid).stock for pid in quantities})
    if cancel:
        req(client,'post',f'orders/{o.pk}/cancel/',{},200)
        repeated = client.post(f'/api/v1/orders/{o.pk}/cancel/',{},format='json')
        check('Repeated cancellation rejected',400,repeated.status_code)
        check('Cancelled inventory restored once',before,{pid:Product.objects.get(pk=pid).stock for pid in quantities})
        check('Cancelled order has no rewards',0,o.referral_rewards.count())
        return o
    payment = o.payment_transactions.get()
    req(admin_client,'patch',f'admin/payments/{payment.pk}/',{'cod_collected':True})
    req(admin_client,'patch',f'admin/payments/{payment.pk}/',{'cod_collected':True})
    check(f'Payment recorded once {o.order_number}',1,PaymentEvent.objects.filter(transaction=payment).count())
    for status in ['confirmed','processing','packed','picked_up','out_for_delivery','delivered']:
        req(admin_client,'patch',f'admin/orders/{o.pk}/',{'status':status})
    o.refresh_from_db()
    check(f'Paid and delivered {o.order_number}',('paid','delivered'),(o.payment_status,o.status))
    counts = (ReferralReward.objects.count(),WalletLedger.objects.count())
    repeat = admin_client.patch(f'/api/v1/admin/orders/{o.pk}/',{'status':'delivered'},format='json')
    check('Repeated delivery rejected',400,repeat.status_code)
    award_referral_for_order(o); award_referral_for_order(o)
    check(f'No duplicate awards {o.order_number}',counts,(ReferralReward.objects.count(),WalletLedger.objects.count()))
    return o

def refund(o, amount):
    r=req(admin_client,'post','admin/refunds/',{'order':str(o.pk),'amount':str(amount),'reason':'QA simulated manual refund'},201)
    req(admin_client,'patch',f"admin/refunds/{r['id']}/",{'status':'approved'})
    req(admin_client,'patch',f"admin/refunds/{r['id']}/",{'status':'recorded','transaction_reference':'QA-NO-MONEY-'+str(r['id'])})
    counts=WalletLedger.objects.count()
    repeat=admin_client.patch(f"/api/v1/admin/refunds/{r['id']}/",{'status':'recorded'},format='json')
    check('Repeated refund rejected',400,repeat.status_code)
    check('Repeated refund no ledger duplication',counts,WalletLedger.objects.count())

# Socket and email guards cover the entire scenario, including checkout hooks.
with patch('socket.socket.connect', side_effect=AssertionError('External network prohibited in QA')), patch('django.utils.timezone.now', side_effect=lambda:clock[0]):
    admin=User.objects.create_superuser(email='qa-admin@example.invalid',password=password,phone='9900000000',first_name='QA ONLY Admin')
    admin_client.force_authenticate(admin)
    program=ReferralProgram.current()
    configure(qualification_threshold='1000.00',qualification_period='calendar_month',qualification_period_days=30,reward_referred_customer=False,reward_on_first_qualifying_order_only=False,max_depth=5)
    catalog=json.loads((ROOT/'scripts'/'fixtures'/'referral_catalog.json').read_text(encoding='utf-8'))
    for item in catalog['categories']:
        Category.objects.create(**item)
    fields={'id','name','slug','sku','description','pack_size','price','regular_price','mrp','mrp_is_sample','badge','image_is_illustration','image_url','is_active','is_featured'}
    for item in catalog['products']:
        Product.objects.create(**{key:value for key,value in item.items() if key in fields},category_id=item['category'],stock=100)
    check('Copied original categories',12,Category.objects.count())
    check('Copied original products',48,Product.objects.count())
    check('No invented QA products',0,Product.objects.filter(name__startswith='QA').count())
    check('Saved product prices unchanged',True,all(Product.objects.get(pk=p['id']).price==Decimal(p['price']) for p in catalog['products']))
    parents={1:None,2:1,3:2,4:3,5:4,6:5,7:1,8:7,9:1,10:9,11:None,12:11,13:None,14:13}
    labels={1:'Exactly threshold',2:'Below threshold',3:'Above threshold',4:'No purchases',5:'Expired purchases',6:'Fifth level buyer',7:'Cancelled buyer',8:'Refunded buyer',9:'Pending then qualified',10:'Direct buyer',11:'Expired pending',12:'Prior period buyer',13:'Existing wallet pending',14:'Pending source buyer'}
    for i,parent in parents.items():
        client.force_authenticate(None)
        payload=dict(full_name=f'QA{i:02d} TEST {labels[i]}',email=f'qa{i:02d}@example.invalid',phone=f'99000000{i:02d}',password=password,confirm_password=password)
        if parent: payload['referral_code']=accounts[parent].referral_code.lower()
        req(client,'post','auth/register/',payload,201)
        accounts[i]=User.objects.get(email=payload['email'])
        if parent: check(f'Referral link QA{i:02d}',accounts[parent].pk,Referral.objects.get(referred=accounts[i]).referrer_id)
    check('14 unique customer IDs',14,len({u.pk for u in accounts.values()}))
    check('14 unique referral codes',14,len({u.referral_code for u in accounts.values()}))
    check('Invalid referral code rejected',400,client.post('/api/v1/referrals/validate/',{'referral_code':'BAD00000'},format='json').status_code)
    client.force_authenticate(accounts[1])
    check('Self referral rejected',400,client.post('/api/v1/referrals/validate/',{'referral_code':accounts[1].referral_code},format='json').status_code)
    client.force_authenticate(None)
    invalid={**payload,'email':'qa-invalid@example.invalid','phone':'9900000099','referral_code':'BAD00000'}
    check('Invalid registration rejected',400,client.post('/api/v1/auth/register/',invalid,format='json').status_code)
    check('Invalid registration creates no user',False,User.objects.filter(email=invalid['email']).exists())
    WalletLedger.objects.create(customer=accounts[11],amount=80,transaction_type='adjustment',description='QA ONLY pre-existing funds',idempotency_key='qa-existing11')
    WalletLedger.objects.create(customer=accounts[13],amount=125,transaction_type='adjustment',description='QA ONLY pre-existing funds',idempotency_key='qa-existing13')
    clock[0]=datetime(2026,9,15,12,tzinfo=tz.utc)
    order(5,1000); old=order(12,1000)
    pending=ReferralReward.objects.get(order=old,recipient=accounts[11])
    check('Old commission initially pending','pending',pending.status)
    clock[0]=pending.pending_expires_at-timedelta(microseconds=1)
    settle_pending_commissions(accounts[11]); pending.refresh_from_db(); check('One microsecond before expiry','pending',pending.status)
    clock[0]=pending.pending_expires_at
    expired_stats=req(admin_client,'get','admin/referrals/stats/')
    check('Admin excludes expired liability without customer visit',Decimal(0),Decimal(expired_stats['reward_liability']))
    settle_pending_commissions(accounts[11]); pending.refresh_from_db(); check('Exact expiry boundary','expired',pending.status)
    check('Expiry keeps old wallet',Decimal(80),wallet(11))
    clock[0]=now
    order(1,1000); order(2,600); order(3,1500)
    for i,expected in [(1,1000),(2,600),(3,1500),(4,0),(5,0)]:
        d=dashboard(i)
        check(f'QA{i:02d} qualifying purchases',Decimal(expected),Decimal(d['qualifying_self_purchase_total']))
        check(f'QA{i:02d} remaining',Decimal(max(0,1000-expected)),Decimal(d['qualification_remaining']))
        check(f'QA{i:02d} eligibility',expected>=1000,d['is_qualified'])
    leaf=order(6,1000)
    check('Five ancestor commissions',5,ReferralReward.objects.filter(order=leaf).count())
    check('Five level rates',[(1,Decimal('10')),(2,Decimal('7.50')),(3,Decimal('5')),(4,Decimal('4')),(5,Decimal('3'))],list(ReferralReward.objects.filter(order=leaf).order_by('level').values_list('level','amount')))
    order(7,1000,cancel=True)
    refunded=order(8,1000)
    refund(refunded,Decimal('200'))
    check('Partial refund reduces own qualification',Decimal('800'),qualifying_self_purchase_total(accounts[8]))
    refund(refunded,refunded.total-Decimal('200'))
    refunded.refresh_from_db(); check('Full refund payment status','refunded',refunded.payment_status)
    check('Full refund removes qualifying purchases',Decimal(0),qualifying_self_purchase_total(accounts[8]))
    check('Full refund reverses all source rewards',True,all(r.status=='reversed' for r in ReferralReward.objects.filter(order=refunded)))
    source=order(10,1000)
    check('Below minimum commission pending','pending',ReferralReward.objects.get(order=source,recipient=accounts[9]).status)
    before=wallet(9); order(9,1000)
    check('Threshold releases pending once',before+Decimal(10),wallet(9))
    for _ in range(3): dashboard(9)
    check('Repeated dashboard settlement idempotent',before+Decimal(10),wallet(9))
    order(14,1000)
    check('Existing available wallet separate',Decimal(125),wallet(13))
    check('Existing wallet pending visible',Decimal(10),Decimal(dashboard(13)['pending_commissions']))
    configure(qualification_threshold='5000.00')
    check('Admin threshold change applied',Decimal(4000),Decimal(dashboard(1)['qualification_remaining']))
    configure(qualification_threshold='1000.00',qualification_period='rolling_days',qualification_period_days=30)
    check('Rolling purchase at exact current instant',Decimal(1000),qualifying_self_purchase_total(accounts[1]))
    clock[0]=now+timedelta(days=30)
    check('Rolling lower boundary included',Decimal(1000),qualifying_self_purchase_total(accounts[1]))
    clock[0]+=timedelta(microseconds=1)
    check('Rolling purchase expired after boundary',Decimal(0),qualifying_self_purchase_total(accounts[1]))
    clock[0]=now
    configure(qualification_period='calendar_month')
    # First-purchase-only behavior and disabled program.
    configure(reward_on_first_qualifying_order_only=True)
    repeated_order=order(10,500)
    check('First-only prevents later purchase rewards',0,ReferralReward.objects.filter(order=repeated_order).count())
    configure(active=False)
    disabled_order=order(14,500)
    check('Inactive program prevents rewards',0,ReferralReward.objects.filter(order=disabled_order).count())
    configure(active=True,reward_on_first_qualifying_order_only=False)
    client.force_authenticate(accounts[1])
    check('Customer cannot edit commission settings',403,client.patch('/api/v1/admin/referral-settings/',{'qualification_threshold':0},format='json').status_code)
    check('Customer cannot read another wallet in admin',403,client.get(f'/api/v1/admin/referrals/network/{accounts[13].pk}/').status_code)
    check('Invalid depth rejected',400,admin_client.patch('/api/v1/admin/referral-settings/',{'max_depth':6},format='json').status_code)
    check('Invalid period days rejected',400,admin_client.patch('/api/v1/admin/referral-settings/',{'qualification_period_days':0},format='json').status_code)
    for i,u in accounts.items():
        client.force_authenticate(u)
        network=req(client,'get','referrals/me/network/')
        expected={}
        for child in parents:
            ancestor=parents[child]
            depth=1
            while ancestor and depth<=5:
                if ancestor==i: expected[accounts[child].pk]=depth
                ancestor=parents[ancestor]; depth+=1
        check(f'QA{i:02d} customer network levels',expected,{r['id']:r['level'] for r in network['results']})
        detail=req(admin_client,'get',f'admin/referrals/network/{u.pk}/')
        check(f'QA{i:02d} admin wallet balance',wallet(i),Decimal(detail['wallet_balance']))
        check(f'QA{i:02d} admin direct count',sum(parent==i for parent in parents.values()),detail['direct_referral_count'])
    import csv, io
    for report,query,field in [('orders',Order.objects.all(),'total'),('wallet',WalletLedger.objects.all(),'amount')]:
        response=admin_client.get(f'/api/v1/admin/reports/{report}/')
        check(f'{report} CSV succeeds',200,response.status_code)
        data=list(csv.DictReader(io.StringIO(response.content.decode())))
        check(f'{report} CSV count',query.count(),len(data))
        check(f'{report} CSV totals',query.aggregate(v=Sum(field))['v'],sum((Decimal(r[field]) for r in data),Decimal(0)))
    # Reconcile customer responses against persisted journal, rewards and graph.
    for i,u in accounts.items():
        d=dashboard(i); snapshots[f'QA{i:02d}']=d
        check(f'QA{i:02d} dashboard wallet matches ledger',wallet(i),Decimal(d['wallet_balance']))
        pending_total=ReferralReward.objects.filter(recipient=u,status='pending',pending_expires_at__gt=now).aggregate(v=Sum('amount'))['v'] or Decimal(0)
        check(f'QA{i:02d} pending matches reward records',pending_total,Decimal(d['pending_commissions']))
    stats=req(admin_client,'get','admin/referrals/stats/')
    snapshots['admin_stats']=stats
    check('Admin customer count',14,stats['total_customers'])
    check('Admin referral edge count',11,stats['total_direct_referrals'])
    check('Admin pending reward count',ReferralReward.objects.filter(status='pending').count(),stats['pending_rewards'])
    check('Admin pending liability',ReferralReward.objects.filter(status='pending').aggregate(v=Sum('amount'))['v'],Decimal(stats['reward_liability']))
    check('No duplicate reward keys',0,ReferralReward.objects.values('order','recipient','level').annotate(n=Count('pk')).filter(n__gt=1).count())
    check('Every credited reward has exactly one credit',True,all(WalletLedger.objects.filter(reward=r,transaction_type='credit').count()==1 for r in ReferralReward.objects.filter(status='credited')))
    check('Every reversed credit has one matching negative entry',True,all(WalletLedger.objects.filter(reversal_of=e,amount=-e.amount).count()==1 for e in WalletLedger.objects.filter(status='reversed',transaction_type='credit')))
    check('Pending and expired rewards have no credits',0,WalletLedger.objects.filter(reward__status__in=['pending','expired'],transaction_type='credit').count())
    from django.core import mail
    check('No emails sent',0,len(getattr(mail,'outbox',[])))
    overview=req(admin_client,'get','admin/dashboard/?period=all_time')
    expected_overview={'orders':13,'delivered_orders':12,'cancelled_orders':1,'customers':14,'wallet_outstanding':Decimal('257.75'),'gross_sales':Decimal('11430'),'refund_total':Decimal('1030'),'net_sales':Decimal('10400'),'cash_collected':Decimal('11430')}
    for key,value in expected_overview.items():
        check('Admin overview '+key,value,overview[key])
    snapshots['admin_overview']=overview
    snapshots['orders']=list(Order.objects.values('id','order_number','customer_id','status','payment_status','subtotal','total'))
    snapshots['rewards']=list(ReferralReward.objects.values())
    snapshots['ledger']=list(WalletLedger.objects.values())
    account_rows=[{'label':f'QA{i:02d} TEST {labels[i]}','id':u.pk,'email':u.email,'referral_code':u.referral_code,'parent':f'QA{parents[i]:02d}' if parents[i] else None} for i,u in accounts.items()]
    (OUT/'accounts.json').write_text(json.dumps(account_rows,indent=2),encoding='utf-8')
    (OUT/'results.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
    (OUT/'records.json').write_text(json.dumps(snapshots,indent=2,default=str),encoding='utf-8')
    (OUT/'local-credentials.txt').write_text(f'LOCAL QA ONLY\nAdmin: {admin.email}\nAll accounts password: {password}\n',encoding='utf-8')
print(f"RESULT: {sum(r['result']=='PASS' for r in rows)}/{len(rows)} passed. Evidence: {OUT}")

raise SystemExit(1 if any(r['result']=='FAIL' for r in rows) else 0)
