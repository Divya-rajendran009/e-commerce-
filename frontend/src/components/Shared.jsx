import { Link } from 'react-router-dom'
import { Leaf, LoaderCircle, Minus, PackageOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '../context/CartContext'
import { money } from './StorefrontTools'
import { deliveryQuote } from '../utils/delivery'

export function Loading({ label = 'Loading your shop…' }) {
  return <div className="state-card"><LoaderCircle className="spin" size={25} aria-hidden="true" /><span>{label}</span></div>
}

export function ErrorState({ message }) {
  return <div className="notice error" role="alert">{message || 'We could not load this right now.'}</div>
}

export function ProductPrice({ product }) {
  const price = Number(product.price)
  const mrp = Number(product.mrp)
  const hasDiscount = Number.isFinite(mrp) && mrp > price
  const savings = hasDiscount ? mrp - price : 0
  const savingsPercent = hasDiscount ? Math.round((savings / mrp) * 100) : 0
  return <div className="product-pricing">
    {hasDiscount && <span className="product-mrp">MRP: <s>₹{mrp.toFixed(2)}</s></span>}
    <strong>Selling price: ₹{price.toFixed(2)}</strong>
    {hasDiscount && <span className="product-savings">You save ₹{savings.toFixed(2)} ({savingsPercent}%)</span>}
  </div>
}

export function DeliverySummary({ subtotal, settings }) {
  const quote = deliveryQuote(subtotal, settings)
  return <>
    <div className="summary-line"><span>Merchandise subtotal</span><strong>₹{subtotal.toFixed(2)}</strong></div>
    <div className="summary-line"><span>Delivery fee</span><strong>{quote.deliveryFee ? `₹${quote.deliveryFee.toFixed(2)}` : quote.freeDelivery ? 'Free' : 'Calculated at checkout'}</strong></div>
    {quote.eligible && (quote.freeDelivery
      ? <p className="delivery-eligibility" role="status">Congratulations! Your order qualifies for free delivery.</p>
      : <p className="delivery-eligibility">Add ₹{quote.remainingForFree.toFixed(2)} more to your cart to qualify for free delivery.</p>)}
    {!quote.eligible && <p className="delivery-eligibility">Add ₹{quote.remainingForMinimum.toFixed(2)} more to meet the minimum order value.</p>}
    <div className="summary-total"><span>Estimated total</span><strong>₹{quote.estimatedTotal.toFixed(2)}</strong></div>
  </>
}

export function EmptyState({ title, body, to = '/products', action = 'Browse products' }) {
  return <div className="empty-state"><PackageOpen size={38} /><h2>{title}</h2><p>{body}</p><Link className="button primary" to={to}>{action}</Link></div>
}

export function ProductCard({ product }) {
  const { items, add, setQuantity } = useCart()
  const quantity = items.find(item => item.id === product.id)?.quantity || 0
  const unavailable = !product.in_stock || product.stock < 1
  const discount = Number(product.mrp) > Number(product.price) ? Math.round((1 - Number(product.price) / Number(product.mrp)) * 100) : 0
  return <article className="product-card">
    <Link to={`/products/${product.id}`} className="product-image" aria-label={`View ${product.name}`}>
      <ProductImage product={product} />
      {discount > 0 && <span className="tag">{discount}% OFF</span>}
    </Link>
    <div className="product-info">
      <span className="product-category">{product.category_name}</span>
      <Link to={`/products/${product.id}`} className="product-title">{product.name}</Link>
      <div className="product-buy"><div className="card-price"><strong>{money(product.price)}</strong>{discount > 0 && <s>{money(product.mrp)}</s>}</div>
        {quantity ? <div className="quantity-control compact cart-stepper"><button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" aria-label={`Increase ${product.name} quantity`} disabled={unavailable || quantity >= Math.min(product.stock, 99)} onClick={() => add(product)}><Plus size={16} /></button></div> : <button className="quick-add" aria-label={`Add ${product.name} to cart`} disabled={unavailable} onClick={() => add(product)}>{unavailable ? 'Sold out' : 'ADD'}</button>}
      </div>
    </div>
  </article>
}

export function ProductImage({ product }) {
  const [failed, setFailed] = useState(false)
  return product.image_url && !failed ? <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span className="product-placeholder"><PackageOpen size={32} /><small>Image coming soon</small></span>
}
