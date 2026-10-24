import { ArrowRight, BadgeCheck, Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, ProductCard } from '../components/Shared'
import { ProductSkeletons } from '../components/StorefrontTools'
import GroceryPhoto, { categoryPhoto, groceryPhotos } from '../components/GroceryPhoto'

const departments = [
  { name: 'Clothing', match: /cloth|fashion|apparel|wear/i, search: 'clothing', photo: groceryPhotos.clothing },
  { name: 'Toiletries', match: /toiletr|personal care|bath|hygiene/i, search: 'toiletries', photo: groceryPhotos.toiletries },
  { name: 'Perfumes', match: /perfume|fragrance/i, search: 'perfume', photo: groceryPhotos.perfume },
  { name: 'Vegetables', match: /vegetable|produce/i, search: 'vegetables', photo: groceryPhotos.vegetables },
  { name: 'Dairy', match: /dairy|milk/i, search: 'dairy', photo: groceryPhotos.dairy },
  { name: 'Rice & grains', match: /rice|grain/i, search: 'rice', photo: groceryPhotos.rice },
]

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [store, setStore] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    Promise.all([api.get('/products/?page_size=24', { signal: controller.signal }), api.get('/categories/', { signal: controller.signal })])
      .then(([p, c]) => {
        if (controller.signal.aborted) return
        setProducts(p.data.results || p.data)
        const aisles = c.data.results || c.data
        setCategories(aisles)

      })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    api.get('/homepage-banners/', { signal: controller.signal }).then(({ data }) => setCampaigns(Array.isArray(data) ? data : [])).catch(() => {})
    api.get('/system-settings/public/', { signal: controller.signal }).then(({ data }) => setStore(data)).catch(() => {})
    return () => controller.abort()
  }, [retry])
  const categoryTiles = departments.map(department => {
    const category = categories.find(c => department.match.test(c.name))
    return { ...department, to: category ? `/products?category=${category.id}` : `/products?search=${encodeURIComponent(department.search)}` }
  }).concat(categories.filter(c => !departments.some(d => d.match.test(c.name))).map(c => ({ name: c.name, photo: categoryPhoto(c.name), to: `/products?category=${c.id}` })))
  const buckets = categories.map(c => products.filter(p => String(p.category) === String(c.id) || p.category_name === c.name))
  const essentials = buckets.length ? Array.from({ length: 6 }, (_, index) => buckets.map(bucket => bucket[index]).filter(Boolean)).flat().slice(0, 6) : products.slice(0, 6)
  return <div className="store-home wrap">
    <section className="market-banner"><div className="market-banner-copy"><span className="banner-label">PANDIYAN STORE</span><h1>For you. For your family.<br /><span>For every day.</span></h1><p>Groceries, fashion, personal care &amp; more.</p><Link className="button primary" to="/products">Shop now <ArrowRight size={17} /></Link></div><GroceryPhoto photo={groceryPhotos.family} hero /></section>
    <div className="service-strip"><span><MapPin size={17} /> Your local Pandiyan Store</span><span><BadgeCheck size={17} /> Everyday value</span><span><Clock3 size={17} /> {store?.delivery_timeline ? `Delivery in ${store.delivery_timeline}` : 'Local doorstep delivery'}</span></div>
    <section className="home-block"><div className="section-heading"><div><h2>Shop by category</h2></div><Link className="text-link" to="/products">View all <ArrowRight size={16} /></Link></div><div className="aisle-grid department-grid">{categoryTiles.map(c => <Link key={c.name} to={c.to} className="aisle-tile">{c.photo && <GroceryPhoto photo={c.photo} />}<span className="category-photo-label"><strong>{c.name}</strong><ArrowRight size={18} aria-hidden="true" /></span></Link>)}</div>{loading && <div className="category-loading" role="status">Loading categories…</div>}</section>
    <div className="offer-grid"><Link to="/products" className="offer-tile offer-yellow"><div><h3>Daily essentials</h3><b>Shop essentials <ArrowRight size={15} /></b></div></Link><Link to="/referrals" className="offer-tile offer-green"><div><h3>Refer & earn</h3><b>Invite friends <ArrowRight size={15} /></b></div></Link></div>
    {campaigns.slice(0, 2).map(c => <section className="store-campaign" key={c.id || c.title}>{c.image_url && <img src={c.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true }} />}<div><span className="eyebrow">FROM YOUR STORE</span><h2>{c.title}</h2><p>{c.subtitle}</p>{c.target_url && <Link className="text-link" to={c.target_url}>Explore offer <ArrowRight size={16} /></Link>}</div></section>)}
    <section className="home-block"><div className="section-heading"><div><h2>Everyday essentials</h2></div><Link className="text-link" to="/products">See all <ArrowRight size={16} /></Link></div>{error ? <><ErrorState message={error} /><button className="button secondary" onClick={() => setRetry(v => v + 1)}>Try again</button></> : loading ? <ProductSkeletons /> : products.length ? <div className="product-grid">{essentials.map(p => <ProductCard key={p.id} product={p} />)}</div> : <p className="notice">We’re stocking the shelves. Check back soon.</p>}</section>

    <section className="neighbourhood-note"><div className="brand-mark"><MapPin size={26} /></div><div><h2>Your neighbourhood store.</h2><p>{store?.store_location || 'Pandiyan Store, Theni'}</p>{store && <small>Minimum order ₹{Number(store.minimum_order_value)} · Delivery ₹{Number(store.delivery_fee)} · Free delivery above ₹{Number(store.free_delivery_threshold)}</small>}</div><Link className="text-link" to="/products">Let’s shop <ArrowRight size={16} /></Link></section>
  </div>
}
