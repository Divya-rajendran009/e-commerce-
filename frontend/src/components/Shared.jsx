import { Link } from 'react-router-dom'
import { Leaf, LoaderCircle, PackageOpen } from 'lucide-react'

export function Loading({ label = 'Loading your shop…' }) {
  return <div className="state-card"><LoaderCircle className="spin" size={25} aria-hidden="true" /><span>{label}</span></div>
}

export function ErrorState({ message }) {
  return <div className="notice error" role="alert">{message || 'We could not load this right now.'}</div>
}

export function EmptyState({ title, body, to = '/products', action = 'Browse products' }) {
  return <div className="empty-state"><PackageOpen size={38} /><h2>{title}</h2><p>{body}</p><Link className="button primary" to={to}>{action}</Link></div>
}

export function ProductCard({ product, onAdd }) {
  const unavailable = !product.in_stock && product.stock === 0
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
      <div className="product-buy"><strong>₹{Number(product.price).toFixed(2)}</strong><button className="button small primary" disabled={unavailable} onClick={() => onAdd(product)}>{unavailable ? 'Sold out' : 'Add'}</button></div>
      {unavailable && <span className="stock-note">Currently unavailable</span>}
    </div>
  </article>
}
