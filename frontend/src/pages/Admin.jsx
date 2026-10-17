import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Banknote, ClipboardList, PackageCheck, Users } from 'lucide-react'
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
  const [today, setToday] = useState(null)
  const [allTime, setAllTime] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    Promise.all([
      api.get('/admin/dashboard/', { params: { period } }),
      api.get('/admin/dashboard/', { params: { period: 'today' } }),
      api.get('/admin/dashboard/', { params: { period: 'all_time' } }),
    ])
      .then(([current, todayResponse, allTimeResponse]) => {
        setData(current.data)
        setToday(todayResponse.data)
        setAllTime(allTimeResponse.data)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [period])
  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!data) return <Loading label="Loading store dashboard…" />

  const metrics = [
    ...(data.financials_available ? [
      ['Sales today', `₹${Number(today?.gross_sales || 0).toFixed(2)}`, Banknote, 'today'],
      ['Total revenue', `₹${Number(allTime?.gross_sales || 0).toFixed(2)}`, Banknote, 'revenue'],
    ] : []),
    ['Total orders', allTime?.orders ?? '—', ClipboardList, 'orders'],
    ['Pending orders', (allTime?.awaiting_confirmation || 0) + (allTime?.processing_orders || 0) + (allTime?.out_for_delivery || 0), PackageCheck, 'orders'],
    ['Customers', allTime?.customers ?? '—', Users, 'customers'],
    ['Low stock', allTime?.low_stock_products ?? '—', AlertTriangle, 'inventory'],
  ]
  const metricLink = (key) => {
    if (key === 'today' || key === 'revenue') {
      if (canAccessAdminModule(user, 'orders')) return '/admin/orders'
      return canAccessAdminModule(user, 'reports') ? '/admin/services/reports' : null
    }
    if (key === 'orders') return canAccessAdminModule(user, 'orders') ? '/admin/orders' : null
    if (key === 'customers') return canAccessAdminModule(user, 'customers') ? '/admin/customers' : null
    if (key === 'inventory') {
      if (canAccessAdminModule(user, 'inventory')) return '/admin/services/inventory'
      return canAccessAdminModule(user, 'products') ? '/admin/products' : null
    }
    return null
  }
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
  return <section className="wrap section admin-page admin-dashboard">
    <span className="eyebrow">STORE MANAGEMENT · {data.period.replaceAll('_', ' ')}</span>
    <div className="section-heading"><div><h1>Dashboard</h1><p>Live database metrics for the selected period.</p></div>
      <label className="field admin-period"><span>Reporting period</span><select value={period} onChange={(event) => { setData(null); setPeriod(event.target.value) }}>{periods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <div className="admin-metrics">{metrics.map(([label, value, Icon, key]) => {
      const target = metricLink(key)
      const card = <><span className="admin-metric-icon"><Icon size={18} /></span><span>{label}</span><strong>{value}</strong><small>{key === 'today' ? 'Today' : key === 'revenue' ? 'All time' : 'View details'} <ArrowUpRight size={13} /></small></>
      return target ? <Link to={target} className="admin-metric-card" key={label}>{card}</Link> : <article className="admin-metric-card" key={label}>{card}</article>
    })}</div>
    <nav className="admin-shortcuts" aria-label="Admin tools">{links.map(([to, label]) => <Link to={to} key={to}>{label} <ArrowUpRight size={14} /></Link>)}{['admin', 'super_admin'].includes(user?.role) && <><a href="http://localhost:8000/django-admin/" target="_blank" rel="noreferrer">Django administration →</a><a href="http://localhost:8000/api/schema/swagger-ui/" target="_blank" rel="noreferrer">API documentation →</a></>}</nav>
    <div className="admin-dashboard-grid">
    <section className="admin-dashboard-panel"><div className="admin-panel-heading"><div><span className="eyebrow">ORDERS</span><h2>Status overview</h2></div><Link to="/admin/orders">View all <ArrowUpRight size={14} /></Link></div><div className="admin-status-list">
      {[
        ['Awaiting confirmation', allTime?.awaiting_confirmation],
        ['Processing', allTime?.processing_orders],
        ['Out for delivery', allTime?.out_for_delivery],
        ['Delivered', allTime?.delivered_orders],
        ['Cancelled', allTime?.cancelled_orders],
      ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}
    </div></section>
    {data.financials_available && <section className="admin-dashboard-panel"><div className="admin-panel-heading"><div><span className="eyebrow">BEST SELLERS</span><h2>Top products</h2></div><Link to="/admin/products">Products <ArrowUpRight size={14} /></Link></div>{data.top_products.length ? <div className="admin-compact-list">{data.top_products.map((item, index) => <article key={item.product_name}><span className="admin-rank">{index + 1}</span><span className="admin-compact-main"><strong>{item.product_name}</strong><small>{item.quantity} units sold</small></span>{item.revenue !== undefined && <strong>₹{Number(item.revenue).toFixed(2)}</strong>}</article>)}</div> : <p className="muted">No product sales in this period.</p>}</section>}
    <section className="admin-dashboard-panel admin-recent-orders"><div className="admin-panel-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div><Link to="/admin/orders">View all <ArrowUpRight size={14} /></Link></div>{data.recent_orders.length ? <div className="admin-compact-list">{data.recent_orders.map((order) => <article key={order.id}><span className="admin-compact-main"><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleDateString()}</small></span><span className={`status status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span>{order.total !== undefined && <strong>₹{Number(order.total).toFixed(2)}</strong>}</article>)}</div> : <p className="muted">No orders have been placed in this period.</p>}</section>
    {data.financials_available && <section className="admin-dashboard-panel admin-sales-summary"><div className="admin-panel-heading"><div><span className="eyebrow">SALES SUMMARY</span><h2>{data.period.replaceAll('_', ' ')}</h2></div></div><div className="admin-sales-numbers"><article><span>Gross sales</span><strong>₹{Number(data.gross_sales).toFixed(2)}</strong></article><article><span>Net sales</span><strong>₹{Number(data.net_sales).toFixed(2)}</strong></article><article><span>Recorded refunds</span><strong>₹{Number(data.refund_total).toFixed(2)}</strong></article><article><span>Average order</span><strong>₹{Number(data.average_order_value).toFixed(2)}</strong></article></div></section>}
    </div>
  </section>
}
