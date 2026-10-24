import { ArrowRight, BadgePercent, Leaf, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading, ProductCard } from '../components/Shared'
import PolicyLink from '../components/PolicyLink'
import { useCart } from '../context/CartContext'

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [storeSettings, setStoreSettings] = useState(null)
  const [storeSettingsError, setStoreSettingsError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const { add } = useCart()
  useEffect(() => {
    Promise.all([api.get('/products/?page_size=4'), api.get('/categories/')])
      .then(([productResponse, categoryResponse]) => {
        setProducts(productResponse.data.results || productResponse.data)
        setCategories(categoryResponse.data.results || categoryResponse.data)
      }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
    api.get('/homepage-banners/').then(({ data }) => setCampaigns(Array.isArray(data) ? data : [])).catch(() => setCampaigns([]))
    api.get('/system-settings/public/').then(({ data }) => setStoreSettings(data)).catch((e) => setStoreSettingsError(errorMessage(e)))
  }, [])
  const campaign = campaigns[0]
  return <>
    {campaign && <section className="homepage-campaign"><div className="wrap homepage-campaign-inner">{campaign.image_url && <img src={campaign.image_url} alt="" /> }<div className="homepage-campaign-copy"><span className="eyebrow">STORE OFFER</span><h2>{campaign.title}</h2>{campaign.subtitle && <p>{campaign.subtitle}</p>}{campaign.target_url && <Link className="button white" to={campaign.target_url}>Explore offer <ArrowRight size={16} /></Link>}</div></div></section>}
    <section className="hero"><div className="wrap hero-inner"><div className="hero-copy"><span className="hero-kicker"><Sparkles size={15} /> YOUR NEIGHBOURHOOD GROCERY, ONLINE</span><h1>Good food.<br /><em>Good days.</em></h1><p>Everyday essentials and fresh favourites, brought right to your doorstep.</p><Link className="button white" to="/products">Start shopping <ArrowRight size={17} /></Link><div className="hero-trust"><span><Leaf size={16} /> Carefully picked</span><span><BadgePercent size={16} /> Great everyday value</span></div></div><div className="hero-art"><div className="produce-orbit">🥬</div><div className="produce-main">🥑</div><div className="produce-side">🍊</div><div className="hero-note">Fresh from our<br />market to you</div></div><div className="hero-blob" /></div></section>
    <section className="wrap section category-section"><div className="section-heading"><div><span className="eyebrow">SHOP BY AISLE</span><h2>Good things, grouped</h2></div><Link to="/products" className="text-link">See all <ArrowRight size={15} /></Link></div><div className="category-grid">{categories.slice(0, 7).map((category, index) => <Link to={`/products?category=${category.id}`} className={`category-tile category-${index % 5}`} key={category.id}><span>{['🥬', '🌾', '🥛', '🍪', '🥤', '🧼', '🧴'][index]}</span><strong>{category.name}</strong></Link>)}</div></section>
    <section className="section products-section"><div className="wrap"><div className="section-heading"><div><span className="eyebrow">A FEW CUSTOMER FAVOURITES</span><h2>Everyday essentials</h2></div><Link to="/products" className="text-link">Browse all products <ArrowRight size={15} /></Link></div>{error ? <ErrorState message={error} /> : loading ? <Loading /> : <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} onAdd={add} />)}</div>}</div></section>
    <section className="wrap section"><div className="promo-card"><div><span className="eyebrow">PANDIYAN STORE</span><h2>{storeSettings?.store_name || 'Pandiyan Store'}</h2><p>{storeSettings?.store_location || 'Theni, Tamil Nadu, India'} · Call {storeSettings?.contact_phone || '8072661435'}</p><p>Delivery to PIN codes {(storeSettings?.delivery_pin_codes || ['625531', '625534']).join(' and ')}. Minimum order ₹{Number(storeSettings?.minimum_order_value ?? 300)}; delivery ₹{Number(storeSettings?.delivery_fee ?? 30)}, free only above ₹{Number(storeSettings?.free_delivery_threshold ?? 1000)}.</p><p>{storeSettings?.business_hours || 'Every day, 9:00 AM to 9:00 PM'}</p>{storeSettingsError && <p className="fine-print" role="status">{storeSettingsError}</p>}<PolicyLink className="button primary" policy="delivery">Delivery information</PolicyLink></div></div></section>
    <section className="wrap section promo-row"><div className="promo-card"><div className="promo-icon"><Leaf /></div><div><span className="eyebrow">SHARE THE GOODNESS</span><h2>Groceries are better together.</h2><p>Invite a friend. Earn wallet rewards on eligible delivered purchases under the current referral programme.</p><Link to="/referrals" className="button primary">Explore referrals <ArrowRight size={16} /></Link></div><div className="promo-decoration">✳</div></div></section>
    <section className="wrap trust-row"><div><b>01</b><span><strong>Quality you can feel good about</strong><small>Everyday favourites, thoughtfully selected</small></span></div><div><b>02</b><span><strong>Shopping made simple</strong><small>Find your essentials without the fuss</small></span></div><div><b>03</b><span><strong>At your convenience</strong><small>Choose what works for your household</small></span></div></section>
  </>
}
