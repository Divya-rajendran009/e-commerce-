import { useEffect, useState } from 'react'
import { AlertTriangle, Box, ClipboardList, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'
import { canAccessAdminModule } from '../utils/adminAccess'

const periods = [
  ['today', 'Today'],
  ['last_7_days', 'Last 7 days'],
  ['last_30_days', 'Last 30 days'],
  ['this_month', 'This month'],
]

export default function Admin() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('last_30_days')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    api.get('/admin/dashboard/', { params: { period } })
      .then(({ data: result }) => setData(result))
      .catch((e) => setError(errorMessage(e)))
  }, [period])
  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!data) return <Loading label="Loading store dashboard…" />

  const metrics = [
    ['Orders', data.orders, ClipboardList],
    ['Customers', data.customers, Users],
    ['New customers', data.new_customers, Users],
    ['Active products', data.active_products, Box],
    ['Low stock', data.low_stock_products, AlertTriangle],
    ['Out of stock', data.out_of_stock_products, AlertTriangle],
    ['Open support tickets', data.pending_support_tickets, ClipboardList],
    ['Pending returns', data.pending_returns, ClipboardList],
    ...(data.financials_available ? [['Gross sales', `₹${Number(data.gross_sales).toFixed(2)}`, ClipboardList], ['Net sales', `₹${Number(data.net_sales).toFixed(2)}`, ClipboardList], ['Recorded refunds', `₹${Number(data.refund_total).toFixed(2)}`, ClipboardList], ['Pending payouts', `₹${Number(data.pending_payouts).toFixed(2)}`, ClipboardList]] : []),
  ]
  const links = [
    ['/admin/products', 'Products & categories', 'products'],
    ['/admin/orders', 'Orders', 'orders'],
    ['/admin/customers', 'Customers', 'customers'],
    ['/admin/referrals', 'Referrals & rewards', 'referrals'],
    ['/admin/services', 'Customer services & resellers', 'customers'],
    ['/admin/services/coupons', 'Coupons & promotions', 'coupons'],
    ['/admin/services/promotions', 'Homepage banners', 'promotions'],
    ['/admin/services/delivery', 'Delivery & dispatch', 'delivery'],
    ['/admin/services/payments', 'Payments', 'payments'],
    ['/admin/services/refunds', 'Refunds', 'refunds'],
    ['/admin/services/inventory', 'Inventory', 'inventory'],
    ['/admin/services/settings', 'Store settings', 'admin-only'],
    ['/admin/services/reports', 'Reports & exports', 'reports'],
    ['/admin/services/audit', 'Admin audit log', 'admin-only'],
    ['/admin/staff', 'Staff & permissions', 'admin-only'],
  ].filter(([, , module]) => module === 'admin-only'
    ? ['admin', 'super_admin'].includes(user?.role)
    : canAccessAdminModule(user, module))
  return <section className="wrap section admin-page">
    <span className="eyebrow">STORE MANAGEMENT · {data.period.replaceAll('_', ' ')}</span>
    <div className="section-heading"><div><h1>Dashboard</h1><p>Live database metrics for the selected period.</p></div>
      <label className="field admin-period"><span>Reporting period</span><select value={period} onChange={(event) => { setData(null); setPeriod(event.target.value) }}>{periods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <div className="admin-metrics">{metrics.map(([label, value, Icon]) => <article key={label}><Icon size={20} /><span>{label}</span><strong>{value}</strong></article>)}</div>
    <nav className="admin-shortcuts" aria-label="Admin tools">{links.map(([to, label]) => <Link to={to} key={to}>{label} →</Link>)}{['admin', 'super_admin'].includes(user?.role) && <><a href="http://localhost:8000/django-admin/" target="_blank" rel="noreferrer">Django administration →</a><a href="http://localhost:8000/api/schema/swagger-ui/" target="_blank" rel="noreferrer">API documentation →</a></>}</nav>
    <h2>Order status</h2><div className="admin-metrics">
      {[
        ['Awaiting confirmation', data.awaiting_confirmation],
        ['Processing', data.processing_orders],
        ['Out for delivery', data.out_for_delivery],
        ['Delivered', data.delivered_orders],
        ['Cancelled', data.cancelled_orders],
      ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div>
    {data.financials_available && <><h2>Top products</h2>{data.top_products.length ? <div className="orders-list">{data.top_products.map((item) => <article className="order-card" key={item.product_name}><strong>{item.product_name}</strong><span>{item.quantity} units sold</span>{item.revenue !== undefined && <strong>₹{Number(item.revenue).toFixed(2)}</strong>}</article>)}</div> : <p className="muted">No sales in this period.</p>}</>}
    <h2>Recent orders</h2>{data.recent_orders.length ? <div className="orders-list">{data.recent_orders.map((order) => <article className="order-card order-card-head" key={order.id}><span><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString()}</small></span><span className={`status status-${order.status}`}>{order.status}</span>{order.total !== undefined && <strong>₹{Number(order.total).toFixed(2)}</strong>}</article>)}</div> : <p className="muted">No orders have been placed in this period.</p>}
  </section>
}
