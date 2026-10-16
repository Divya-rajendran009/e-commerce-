import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import api, { errorMessage } from '../services/api'

export default function Checkout() {
  const { user } = useAuth()
  const { items, subtotal, clear } = useCart()
  const [form, setForm] = useState({ customer_name: user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), phone: user?.phone || '', address: '', delivery_pin_code: '', coupon_code: '', instructions: '', payment_method: 'cod' })
  const [error, setError] = useState('')
  const [addressError, setAddressError] = useState('')
  const [addresses, setAddresses] = useState([])
  const [busy, setBusy] = useState(false)
  const [storeSettings, setStoreSettings] = useState({ delivery_fee: 0, free_delivery_threshold: null, minimum_order_value: 0 })
  const navigate = useNavigate()
  useEffect(() => {
    api.get('/system-settings/public/').then(({ data }) => setStoreSettings(data)).catch((e) => setAddressError(errorMessage(e)))
    api.get('/account/addresses/').then(({ data }) => {
      const saved = Array.isArray(data) ? data : data.results || []
      setAddresses(saved)
      const preferred = saved.find((address) => address.is_default)
      if (preferred) useAddress(preferred)
    }).catch((e) => setAddressError(errorMessage(e)))
  }, [])
  const useAddress = (address) => setForm((current) => ({
    ...current,
    customer_name: address.recipient_name,
    phone: address.mobile_number,
    address: [address.address_line1, address.address_line2, address.locality, address.city, address.state, address.pin_code].filter(Boolean).join(', '),
    delivery_pin_code: address.pin_code || '',
    instructions: address.delivery_instructions || '',
  }))
  const submit = async (event) => {
    event.preventDefault()
    if (!items.length) { setError('Your cart is empty.'); return }
    setError(''); setBusy(true)
    try {
      const { data } = await api.post('/orders/', { ...form, items: items.map(({ id, quantity }) => ({ product_id: id, quantity })) })
      clear()
      navigate(`/orders?placed=${encodeURIComponent(data.order_number)}`)
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  if (!items.length) return <section className="wrap section"><div className="empty-state"><h2>Your basket is empty</h2><p>Add something before checking out.</p><button className="button primary" onClick={() => navigate('/products')}>Browse products</button></div></section>
  const deliveryFee = storeSettings.free_delivery_threshold && subtotal >= Number(storeSettings.free_delivery_threshold) ? 0 : Number(storeSettings.delivery_fee || 0)
  const estimatedTotal = Math.max(0, subtotal + deliveryFee)
  return <section className="wrap section checkout-page"><div className="section-heading"><div><span className="eyebrow">ALMOST THERE</span><h1>Checkout</h1></div></div><div className="cart-layout"><form className="checkout-form" onSubmit={submit}><h2>Delivery details</h2>{addresses.length > 0 && <label className="field"><span>Use a saved address</span><select defaultValue="" onChange={(event) => { const address = addresses.find((item) => String(item.id) === event.target.value); if (address) useAddress(address) }}><option value="">Enter delivery details manually</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.recipient_name} · {address.city} · {address.pin_code}{address.is_default ? ' (default)' : ''}</option>)}</select></label>}{addressError && <p className="fine-print" role="status">{addressError}</p>}<label className="field"><span>Full name</span><input required autoComplete="name" maxLength="150" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></label><label className="field"><span>Mobile number</span><input required autoComplete="tel" type="tel" maxLength="20" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="field"><span>Delivery address</span><textarea required autoComplete="street-address" rows="4" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House / flat, street, area, city" /></label><label className="field"><span>PIN code</span><input inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength="6" value={form.delivery_pin_code} onChange={(e) => setForm({ ...form, delivery_pin_code: e.target.value })} placeholder="6-digit PIN" /></label><label className="field"><span>Coupon code <small>(optional)</small></span><input autoCapitalize="characters" maxLength="40" value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} placeholder="Enter a coupon code" /></label><label className="field"><span>Delivery instructions <small>(optional)</small></span><textarea rows="2" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></label><h2 className="payment-heading">Payment</h2><label className="payment-option"><input type="radio" checked readOnly /> <span><strong>Cash on Delivery</strong><small>Pay when your order arrives</small></span><b>COD</b></label>{error && <div className="notice error" role="alert">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Placing order…' : `Place order · ₹${estimatedTotal.toFixed(2)}`}</button></form><aside className="summary-card"><h2>Your order</h2>{items.map((item) => <div className="summary-line" key={item.id}><span>{item.name} × {item.quantity}</span><strong>₹{(Number(item.price) * item.quantity).toFixed(2)}</strong></div>)}<div className="summary-line"><span>Delivery</span><strong>₹{deliveryFee.toFixed(2)}</strong></div>{form.coupon_code && <p className="fine-print">Coupon is checked securely when your order is placed.</p>}<div className="summary-total"><span>Estimated total</span><strong>₹{estimatedTotal.toFixed(2)}</strong></div><p>Prices, coupon eligibility, and delivery availability are verified by the store when you place your order.</p></aside></div></section>
}
