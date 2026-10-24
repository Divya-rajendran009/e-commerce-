import { ArrowLeft, Heart, Leaf, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, Loading, ProductPrice } from '../components/Shared'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import PolicyLink from '../components/PolicyLink'

export default function ProductDetail() {
  const { id } = useParams()
  const { add } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { api.get(`/products/${id}/`).then(({ data }) => setProduct(data)).catch((e) => setError(errorMessage(e))) }, [id])
  const saveToWishlist = async () => {
    if (!user) { navigate('/login'); return }
    try {
      const { data } = await api.get('/account/wishlist/')
      const items = Array.isArray(data) ? data : data.results || []
      if (!items.some((item) => item.product.id === product.id)) await api.post('/account/wishlist/', { product_id: product.id })
      setSaved(true)
    } catch (e) { setError(errorMessage(e)) }
  }
  if (error) return <section className="wrap section"><ErrorState message={error} /><Link to="/products" className="text-link"><ArrowLeft size={16} /> Back to products</Link></section>
  if (!product) return <Loading />
  return <section className="wrap section detail-layout"><Link to="/products" className="text-link back-link"><ArrowLeft size={16} /> Back to shopping</Link><div className="detail-image">{product.image_url ? <img src={product.image_url} alt={product.name} /> : <Leaf size={96} />}</div><div className="detail-info"><span className="eyebrow">{product.category_name}</span><h1>{product.name}</h1><ProductPrice product={product} /><p>{product.description || 'A quality everyday grocery essential, selected for your home.'}</p><p className={product.in_stock ? 'stock-ok' : 'stock-note'}>{product.in_stock ? `${product.stock} available in demo inventory` : 'Currently unavailable'}</p><div className="quantity-control"><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Increase quantity" disabled={!product.in_stock || quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock || 1, quantity + 1))}><Plus size={16} /></button></div><button className="button primary detail-add" disabled={!product.in_stock} onClick={() => add(product, quantity)}>Add to basket · ₹{(Number(product.price) * quantity).toFixed(2)}</button><button className="button secondary wishlist-save" type="button" onClick={saveToWishlist}><Heart size={16} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved to wishlist' : 'Save to wishlist'}</button><p><PolicyLink className="text-link" policy="delivery">Read the Delivery Policy</PolicyLink></p>{error && <ErrorState message={error} />}</div></section>
}
