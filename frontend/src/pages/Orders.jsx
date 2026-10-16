import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorState, Loading } from '../components/Shared'
import api, { errorMessage } from '../services/api'

const labels = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', packed: 'Packed', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
const cancelable = ['pending', 'confirmed', 'processing', 'packed']
const list = (data) => Array.isArray(data) ? data : data?.results || []

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [returns, setReturns] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [returnFor, setReturnFor] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [params] = useSearchParams()
  const load = async () => {
    const [orderResponse, returnResponse] = await Promise.all([api.get('/orders/'), api.get('/account/returns/')])
    setOrders(list(orderResponse.data))
    setReturns(list(returnResponse.data))
  }
  useEffect(() => { load().catch((e) => setError(errorMessage(e))).finally(() => setLoading(false)) }, [])
  const cancel = async (order) => {
    if (!window.confirm(`Cancel order ${order.order_number}?`)) return
    setBusy(order.id); setError(''); setNotice('')
    try { await api.post(`/orders/${order.id}/cancel/`); setNotice(`Order ${order.order_number} was cancelled.`); await load() } catch (e) { setError(errorMessage(e)) } finally { setBusy('') }
  }
  const submitReturn = async (event, order) => {
    event.preventDefault(); setBusy(order.id); setError('')
    try { await api.post('/account/returns/', { order: order.id, reason }); setReason(''); setReturnFor(''); setNotice(`Return request submitted for ${order.order_number}.`); await load() } catch (e) { setError(errorMessage(e)) } finally { setBusy('') }
  }
  return <section className="wrap section orders-page"><span className="eyebrow">YOUR ACCOUNT</span><h1>Orders</h1>{params.get('placed') && <div className="notice success">Order placed successfully. Your order number is <strong>{params.get('placed')}</strong>.</div>}{notice && <div className="notice success" role="status">{notice}</div>}{error && <ErrorState message={error} />}{loading ? <Loading /> : orders.length ? <div className="orders-list">{orders.map((order) => {
    const returnRequest = returns.find((entry) => entry.order === order.id)
    return <article className="order-card" key={order.id}><div className="order-card-head"><div><span className="eyebrow">ORDER {order.order_number}</span><small>{new Date(order.created_at).toLocaleDateString()}</small></div><span className={`status status-${order.status}`}>{labels[order.status]}</span></div><div className="order-items-preview">{order.items.map((item, index) => <span key={`${item.sku}-${index}`}>{item.product_name} × {item.quantity}</span>)}</div><div className="order-card-foot"><span>{order.payment_method.toUpperCase()} · {order.payment_status.toUpperCase()} · ₹{Number(order.total).toFixed(2)}</span><Link to={`/orders/${order.id}`} className="text-link">View details</Link></div>
      <div className="order-customer-actions">{cancelable.includes(order.status) && <button className="button secondary small" disabled={busy === order.id} onClick={() => cancel(order)}>{busy === order.id ? 'Working…' : 'Cancel order'}</button>}{order.status === 'delivered' && !returnRequest && <button className="button secondary small" onClick={() => { setReturnFor(returnFor === order.id ? '' : order.id); setReason('') }}>Request a return</button>}{returnRequest && <span className={`status status-${returnRequest.status}`}>Return: {returnRequest.status}</span>}</div>
      {returnFor === order.id && <form className="return-request-form" onSubmit={(event) => submitReturn(event, order)}><label className="field"><span>Reason for return</span><textarea required maxLength="2000" rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="button primary small" disabled={busy === order.id}>Submit return request</button></form>}
    </article>
  })}</div> : <div className="empty-state"><h2>No orders yet</h2><p>Your future orders will appear here.</p><Link to="/products" className="button primary">Explore the shop</Link></div>}</section>
}
