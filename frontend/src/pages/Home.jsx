import { SHOW_CATALOGUE_PREVIEW } from '../utils/demoCatalogue'
import categoryImages from '../data/departments.json'
import DemoStorefront from '../components/DemoStorefront'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, ProductCard, ProductImage } from '../components/Shared'
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
  const [params] = useSearchParams()
  return SHOW_CATALOGUE_PREVIEW ? <DemoStorefront key={`${params.get('department') || ''}-${params.get('search') || ''}`} /> : <LiveHome />
}

function LiveHome() {
  const [selection, setSelection] = useState('all')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [campaigns, setCampaigns] = useState([])
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
    return () => controller.abort()
  }, [retry])
  const categoryTiles = departments.map(department => {
    const category = categories.find(c => department.match.test(c.name))
    return { ...department, to: category ? `/products?category=${category.id}` : `/products?search=${encodeURIComponent(department.search)}` }
  }).concat(categories.filter(c => !departments.some(d => d.match.test(c.name))).map(c => ({ name: c.name, photo: categoryPhoto(c.name), to: `/products?category=${c.id}` })))
  const buckets = categories.map(c => products.filter(p => String(p.category) === String(c.id) || p.category_name === c.name))
  const mixed = buckets.length ? Array.from({ length: 24 }, (_, index) => buckets.map(bucket => bucket[index]).filter(Boolean)).flat() : products
  const savings = p => Number(p.mrp) > Number(p.price) ? (Number(p.mrp) - Number(p.price)) / Number(p.mrp) : 0
  const discounted = mixed.filter(p => savings(p) > 0).sort((a, b) => savings(b) - savings(a))
  const shown = selection === 'deals' ? discounted : selection === 'value' ? mixed.filter(p => Number(p.price) < 500).sort((a,b) => Number(a.price) - Number(b.price)) : [...discounted, ...mixed.filter(p => !savings(p))]
  return <div className="store-home shopping-home wrap">
    <nav className="shop-departments" aria-label="Shop departments"><Link to="/products" className="department-shortcut"><span className="all-departments"><ShoppingBag size={25} /></span><strong>All</strong></Link>{categoryTiles.map(c => <Link key={c.name} to={c.to} className="department-shortcut"><ProductImage product={categoryImages.find(image => image.name === c.name) || { name: c.name, category_name: c.name }} /><strong>{c.name}</strong></Link>)}</nav>
    <section className="shopping-discovery" aria-labelledby="shopping-title">
      <div className="discovery-heading"><h1 id="shopping-title">Shop picks</h1><Link to="/products">View all <ArrowRight size={16} /></Link></div>
      <div className="discovery-tabs" role="group" aria-label="Filter suggested products">{[['all','For you','Across the store'],['deals','Price drops','Below MRP'],['value','Under ₹500','Everyday value']].map(([key,label,caption]) => <button key={key} type="button" aria-pressed={selection === key} onClick={() => setSelection(key)}><strong>{label}</strong><small>{caption}</small></button>)}</div>
      {error ? <><ErrorState message={error} /><button className="button secondary" onClick={() => setRetry(v => v + 1)}>Try again</button></> : loading ? <ProductSkeletons /> : shown.length ? <div className="product-grid discovery-products">{shown.slice(0,12).map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="empty-state"><h2>{selection === 'deals' ? 'No price drops right now' : 'No matching products yet'}</h2><button className="button secondary" onClick={() => setSelection('all')}>Browse all picks</button></div>}
    </section>
    {campaigns.slice(0, 2).map(c => <section className="store-campaign" key={c.id || c.title}>{c.image_url && <img src={c.image_url} alt="" loading="lazy" onError={e => { e.currentTarget.hidden = true }} />}<div><h2>{c.title}</h2><p>{c.subtitle}</p>{c.target_url && <Link className="text-link" to={c.target_url}>Explore offer <ArrowRight size={16} /></Link>}</div></section>)}
    <section className="home-block"><div className="section-heading"><h2>Explore every department</h2></div><div className="aisle-grid department-grid">{categoryTiles.map(c => <Link key={c.name} to={c.to} className="aisle-tile"><ProductImage product={categoryImages.find(image => image.name === c.name) || { name: c.name, category_name: c.name }} /><span className="category-photo-label"><strong>{c.name}</strong><ArrowRight size={18} /></span></Link>)}</div></section>
    <Link to="/referrals" className="referral-discovery"><span><strong>Share your store</strong><small>Explore referral rewards</small></span><ArrowRight size={20} /></Link>
  </div>
}
