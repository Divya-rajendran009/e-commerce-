import { ArrowLeft, Check, Circle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, Loading } from '../components/Shared'
import api, { errorMessage } from '../services/api'

const timeline = [['pending', 'Order placed'], ['confirmed', 'Order confirmed'], ['processing', 'Getting it ready'], ['packed', 'Packed with care'], ['picked_up', 'Picked up by delivery'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered']]
export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get(`/orders/${id}/`).then(({ data }) => setOrder(data)).catch((e) => setError(errorMessage(e))) }, [id])
  if (error) return <section className="wrap section"><ErrorState message={error} /><Link to="/orders" className="text-link"><ArrowLeft size={15} /> Orders</Link></section>
  if (!order) return <Loading />
  const index = timeline.findIndex(([status]) => status === order.status)
  const merchandiseTotal = Number(order.subtotal) - Number(order.discount_amount || 0)
  return <section className="wrap section order-detail"><Link to="/orders" className="text-link"><ArrowLeft size={15} /> All orders</Link><span className="eyebrow">ORDER {order.order_number}</span><h1>Your order journey</h1><p>Placed {new Date(order.created_at).toLocaleString()}</p>{order.status === 'cancelled' ? <div className="notice error">This order has been cancelled.</div> : <div className="timeline">{timeline.map(([status, text], step) => <div className={`timeline-step ${step <= index ? 'done' : ''}`} key={status}>{step <= index ? <Check size={16} /> : <Circle size={16} />}<span>{text}</span></div>)}</div>}<div className="order-detail-grid"><div className="summary-card"><h2>Items</h2>{order.items.map((item, index) => <div className="summary-line" key={`${item.sku}-${index}`}><span>{item.product_name} × {item.quantity}</span><strong>₹{Number(item.line_total).toFixed(2)}</strong></div>)}</div><div className="summary-card"><h2>Delivery</h2><p>{order.customer_name}<br />{order.phone}<br />{order.address}</p><h2>Payment</h2><p>{order.payment_method.toUpperCase()} · {order.payment_status}</p><div className="summary-line"><span>Merchandise subtotal</span><strong>₹{Number(order.subtotal).toFixed(2)}</strong></div>{Number(order.discount_amount) > 0 && <div className="summary-line"><span>Coupon discount</span><strong>−₹{Number(order.discount_amount).toFixed(2)}</strong></div>}<div className="summary-line"><span>Merchandise after discounts</span><strong>₹{merchandiseTotal.toFixed(2)}</strong></div><div className="summary-line"><span>Delivery fee</span><strong>{Number(order.delivery_fee) ? `₹${Number(order.delivery_fee).toFixed(2)}` : 'Free'}</strong></div><div className="summary-total"><span>Order value</span><strong>₹{Number(order.total).toFixed(2)}</strong></div><div className="summary-line"><span>Wallet paid</span><strong>₹{Number(order.wallet_amount || 0).toFixed(2)}</strong></div><div className="summary-line"><span>Cash on delivery amount</span><strong>₹{Number(order.amount_due ?? order.total).toFixed(2)}</strong></div></div></div></section>
}
