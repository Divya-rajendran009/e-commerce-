import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

const next = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['packed', 'cancelled'], packed: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered'], delivered: [], cancelled: [] }
export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => api.get('/admin/orders/').then(({ data }) => setOrders(data.results || data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const change = async (order, status) => {
    try { await api.patch(`/admin/orders/${order.id}/`, { status }); await load() } catch (e) { setError(errorMessage(e)) }
  }
  if (loading) return <Loading />
  return <section className="wrap section admin-page"><span className="eyebrow">STORE MANAGEMENT</span><h1>Orders</h1>{error && <ErrorState message={error} />}{orders.length ? <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}><div className="order-card-head"><div><strong>{order.order_number}</strong><small>{order.customer_name} · {order.phone}</small></div><span className={`status status-${order.status}`}>{order.status}</span></div><p>{order.address}</p><div className="order-card-foot"><strong>₹{Number(order.total).toFixed(2)} · COD</strong><label className="admin-status">Update status<select value={order.status} onChange={(e) => change(order, e.target.value)}><option value={order.status}>{order.status}</option>{next[order.status].map((status) => <option key={status} value={status}>{status}</option>)}</select></label></div></article>)}</div> : <p className="muted">No orders to manage.</p>}</section>
}
