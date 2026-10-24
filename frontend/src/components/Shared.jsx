import { Link } from 'react-router-dom'
import { Leaf, LoaderCircle, Minus, PackageOpen, Plus } from 'lucide-react'
import { useState } from 'react'
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

export function ProductCard({ product, onAdd }) {
  const [quantity, setQuantity] = useState(1)
  const unavailable = !product.in_stock
  return <article className="product-card">
    <Link to={`/products/${product.id}`} className="product-image">
      {product.image_url ? <img src={product.image_url} alt={product.name} onError={(e) => { e.currentTarget.style.display = 'none' }} /> : null}
      <span className="product-placeholder"><Leaf size={38} /></span>
      {product.is_featured && <span className="tag">Popular</span>}
    </Link>
    <div className="product-info">
      <span className="eyebrow">{product.category_name}</span>
      <Link to={`/products/${product.id}`} className="product-title">{product.name}</Link>
      <p className="product-description">{product.description || 'A quality everyday grocery essential.'}</p>
      <ProductPrice product={product} />
      <div className="product-buy">
        <div className="quantity-control compact" aria-label={`Quantity for ${product.name}`}>
          <button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={14} /></button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={unavailable || quantity >= product.stock} onClick={() => setQuantity((current) => Math.min(product.stock, current + 1))}><Plus size={14} /></button>
        </div>
        <button className="button small primary" aria-label={`${unavailable ? 'Sold out' : 'Add'} ${quantity} ${product.name} to bag`} disabled={unavailable} onClick={() => onAdd(product, quantity)}>{unavailable ? 'Sold out' : 'Add'}</button>
      </div>
      {unavailable && <span className="stock-note">Currently unavailable</span>}
    </div>
  </article>
}
