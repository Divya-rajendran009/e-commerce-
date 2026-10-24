import { ArrowRight, BadgeCheck, Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, ProductCard } from '../components/Shared'
import { ProductSkeletons } from '../components/StorefrontTools'
import GroceryPhoto, { categoryPhoto, groceryPhotos } from '../components/GroceryPhoto'

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [collections, setCollections] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [store, setStore] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([api.get('/products/?page_size=24', { signal: controller.signal }), api.get('/categories/', { signal: controller.signal })])
      .then(async ([p, c]) => {
        setProducts(p.data.results || p.data)
        const aisles = c.data.results || c.data
        setCategories(aisles)
        const shelves = await Promise.allSettled(aisles.slice(0, 3).map(async category => {
          const { data } = await api.get('/products/', { params: { category: category.id, page_size: 6 }, signal: controller.signal })
          return { ...category, products: data.results || data }
        }))
        if (!controller.signal.aborted) setCollections(shelves.filter(shelf => shelf.status === 'fulfilled' && shelf.value.products.length).map(shelf => shelf.value))
      })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    api.get('/homepage-banners/', { signal: controller.signal }).then(({ data }) => setCampaigns(Array.isArray(data) ? data : [])).catch(() => {})
    api.get('/system-settings/public/', { signal: controller.signal }).then(({ data }) => setStore(data)).catch(() => {})
    return () => controller.abort()
  }, [retry])
  const groups = collections
  const buckets = categories.map(c => products.filter(p => String(p.category) === String(c.id) || p.category_name === c.name))
  const essentials = buckets.length ? Array.from({ length: 6 }, (_, index) => buckets.map(bucket => bucket[index]).filter(Boolean)).flat().slice(0, 6) : products.slice(0, 6)
  return <div className="store-home wrap">
    <section className="market-banner"><div className="market-banner-copy"><span className="banner-label">PANDIYAN STORE</span><h1>For you. For your family.<br /><span>For every day.</span></h1><p>Groceries, fashion, personal care &amp; more.</p><Link className="button primary" to="/products">Shop now <ArrowRight size={17} /></Link></div><GroceryPhoto photo={groceryPhotos.shopping} hero /></section>
    <div className="service-strip"><span><MapPin size={17} /> Your local Pandiyan Store</span><span><BadgeCheck size={17} /> Everyday value</span><span><Clock3 size={17} /> {store?.delivery_timeline ? `Delivery in ${store.delivery_timeline}` : 'Local doorstep delivery'}</span></div>
    <section className="home-block"><div className="section-heading"><div><h2>Shop by category</h2></div><Link className="text-link" to="/products">View all <ArrowRight size={16} /></Link></div><div className={`aisle-grid${categories.length <= 4 ? ' aisle-grid-short' : ''}`}>{categories.map(c => <Link key={c.id} to={`/products?category=${c.id}`} className="aisle-tile">{categoryPhoto(c.name) && <GroceryPhoto photo={categoryPhoto(c.name)} />}<span className="category-photo-label"><strong>{c.name}</strong><ArrowRight size={18} aria-hidden="true" /></span></Link>)}</div>{loading && <div className="category-loading" role="status">Loading categories…</div>}</section>
    <div className="offer-grid"><Link to="/products" className="offer-tile offer-yellow"><div><h3>Daily essentials</h3><b>Shop essentials <ArrowRight size={15} /></b></div></Link><Link to="/referrals" className="offer-tile offer-green"><div><h3>Refer & earn</h3><b>Invite friends <ArrowRight size={15} /></b></div></Link></div>
    {campaigns.slice(0, 2).map(c => <section className="store-campaign" key={c.id || c.title}>{c.image_url && <img src={c.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true }} />}<div><span className="eyebrow">FROM YOUR STORE</span><h2>{c.title}</h2><p>{c.subtitle}</p>{c.target_url && <Link className="text-link" to={c.target_url}>Explore offer <ArrowRight size={16} /></Link>}</div></section>)}
    <section className="home-block"><div className="section-heading"><div><h2>Everyday essentials</h2></div><Link className="text-link" to="/products">See all <ArrowRight size={16} /></Link></div>{error ? <><ErrorState message={error} /><button className="button secondary" onClick={() => setRetry(v => v + 1)}>Try again</button></> : loading ? <ProductSkeletons /> : products.length ? <div className="product-grid">{essentials.map(p => <ProductCard key={p.id} product={p} />)}</div> : <p className="notice">We’re stocking the shelves. Check back soon.</p>}</section>
    {groups.slice(0, 3).map(group => <section className="home-block" key={group.id}><div className="section-heading"><h2>{group.name}</h2><Link className="text-link" to={`/products?category=${group.id}`}>See all <ArrowRight size={16} /></Link></div><div className="product-grid">{group.products.slice(0, 6).map(p => <ProductCard key={p.id} product={p} />)}</div></section>)}
    <section className="neighbourhood-note"><div className="brand-mark"><MapPin size={26} /></div><div><h2>Your neighbourhood store.</h2><p>{store?.store_location || 'Pandiyan Store, Theni'}</p>{store && <small>Minimum order ₹{Number(store.minimum_order_value)} · Delivery ₹{Number(store.delivery_fee)} · Free delivery above ₹{Number(store.free_delivery_threshold)}</small>}</div><Link className="text-link" to="/products">Let’s shop <ArrowRight size={16} /></Link></section>
  </div>
}
