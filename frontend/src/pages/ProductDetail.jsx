import { ArrowLeft, Check, Heart, Minus, Plus, ShoppingBasket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, Loading, ProductImage, ProductPrice } from '../components/Shared'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import PolicyLink from '../components/PolicyLink'

export default function ProductDetail() {
  const { id } = useParams()
  const { add, items, setQuantity } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setProduct(null); setLoadError(''); setError(''); setSaved(false)
    api.get(`/products/${id}/`, { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) setProduct(data) }).catch(e => { if (!controller.signal.aborted) setLoadError(errorMessage(e)) })
    return () => controller.abort()
  }, [id, retry])
  const saveToWishlist = async () => {
    if (!user) { navigate('/login'); return }
    setSaving(true); setError('')
    try {
      const { data } = await api.get('/account/wishlist/')
      const savedItems = Array.isArray(data) ? data : data.results || []
      if (!savedItems.some(item => item.product.id === product.id)) await api.post('/account/wishlist/', { product_id: product.id })
      setSaved(true)
    } catch (e) { setError(errorMessage(e)) } finally { setSaving(false) }
  }
  if (loadError) return <section className="wrap section"><ErrorState message={loadError} /><button className="button secondary" onClick={() => setRetry(v => v + 1)}>Try again</button><Link to="/products" className="text-link"><ArrowLeft size={16} /> Back to products</Link></section>
  if (!product) return <Loading />
  const quantity = items.find(item => item.id === product.id)?.quantity || 0
  const inStock = product.in_stock && product.stock > 0
  return <section className="wrap section detail-layout">
    <Link to="/products" className="text-link back-link"><ArrowLeft size={16} /> Back to shopping</Link>
    <div className="detail-image"><ProductImage key={product.id} product={product} /></div>
    <div className="detail-info"><span className="eyebrow">{product.category_name}</span><h1>{product.name}</h1><ProductPrice product={product} /><p>{product.description || 'An everyday essential, selected for your home.'}</p><p className={inStock ? 'stock-ok' : 'stock-note'}>{inStock ? 'In stock · Ready for your basket' : 'Currently unavailable'}</p>
    <div className="detail-purchase">{quantity ? <><div className="quantity-control detail-stepper"><button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantity(product.id, quantity - 1)}><Minus size={18} /></button><span aria-live="polite">{quantity}</span><button type="button" aria-label={`Increase ${product.name} quantity`} disabled={!inStock || quantity >= Math.min(product.stock, 99)} onClick={() => add(product)}><Plus size={18} /></button></div><Link className="button primary" to="/cart"><ShoppingBasket size={18} /> View basket</Link></> : <button className="button primary" disabled={!inStock} onClick={() => add(product)}><Plus size={18} />{inStock ? 'Add to basket' : 'Out of stock'}</button>}</div>
    {quantity > 0 && <p className="basket-confirmation" role="status"><Check size={16} /> {quantity} in your basket</p>}
    <button className="button secondary wishlist-save" type="button" disabled={saving || saved} onClick={saveToWishlist}><Heart size={16} fill={saved ? 'currentColor' : 'none'} />{saving ? 'Saving…' : saved ? 'Saved to wishlist' : 'Save to wishlist'}</button><p><PolicyLink className="text-link" policy="delivery">Delivery details & charges</PolicyLink></p>{error && <ErrorState message={error} />}</div>
  </section>
}
