import { ArrowRight, BadgeIndianRupee, MapPin, ShoppingBag } from 'lucide-react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, ProductCard } from '../components/Shared'
import { ProductSkeletons } from '../components/StorefrontTools'
import CategoryVisual from '../components/CategoryVisual'
import ShoppingHero from '../components/ShoppingHero'

export default function Home() {
  const { categories = [] } = useOutletContext()
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (new URLSearchParams(location.search).has('search')) navigate(`/products${location.search}`, { replace: true })
  }, [location.search, navigate])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    api.get('/products/', { params: { page_size: 24 }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setProducts(data.results || data) })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry])
  const deals = products.filter(p => Number(p.mrp) > Number(p.price)).sort((a, b) => (Number(b.mrp) - Number(b.price)) / Number(b.mrp) - (Number(a.mrp) - Number(a.price)) / Number(a.mrp))
  const featured = products.filter(p => p.is_featured)
  const shelves = [
    { title: 'Your everyday picks', caption: 'Little things that keep your day going.', items: (featured.length ? featured : products).slice(0, 6) },
    ...(deals.length ? [{ title: 'A little more value', caption: 'Good finds, priced below MRP.', items: deals.slice(0, 6) }] : []),
  ]
  const collectionLink = pattern => { const category = categories.find(c => pattern.test(c.name)); return category ? `/products?category=${category.id}` : '/products' }
  return <div className="quick-home wrap">
    <ShoppingHero />
    <section className="quick-categories" aria-labelledby="category-heading"><div className="quick-section-heading"><div><span className="section-kicker">A LITTLE OF EVERYTHING</span><h2 id="category-heading">What’s on your list?</h2></div><Link to="/products">See all <ArrowRight size={17} /></Link></div>
      <nav className="visual-categories" aria-label="Shop by category"><Link to="/products"><span className="category-visual category-all"><ShoppingBag size={30} /></span><strong>Shop all</strong></Link>{categories.map(category => <Link key={category.id} to={`/products?category=${category.id}`}><CategoryVisual name={category.name} /><strong>{category.name}</strong></Link>)}</nav>
    </section>
    <div className="quick-collections">
      <Link className="collection-fresh" to={collectionLink(/vegetable|fresh|produce/i)}><div><span>FROM THE KITCHEN LIST</span><h2>Fresh starts<br />right here.</h2><small>Shop fresh picks <ArrowRight size={15} /></small></div><img src="/images/categories/vegetables.webp" alt="" loading="lazy" /></Link>
      <Link className="collection-pantry" to={collectionLink(/pantry|rice|grain|grocery/i)}><div><span>KEEP THE GOOD FOOD GOING</span><h2>Your pantry.<br />All sorted.</h2><small>Explore essentials <ArrowRight size={15} /></small></div><img src="/images/categories/pantry.webp" alt="" loading="lazy" /></Link>
      <Link className="collection-care" to={collectionLink(/toiletr|care|bath/i)}><div><span>THE EVERYDAY RITUALS</span><h2>A little care.<br />Every day.</h2><small>Find your favourites <ArrowRight size={15} /></small></div><img src="/images/categories/toiletries.webp" alt="" loading="lazy" /></Link>
    </div>
    {error ? <div className="shop-load-error"><ErrorState message={error} /><button className="button secondary" onClick={() => setRetry(v => v + 1)}>Try again</button></div> : loading ? <ProductSkeletons /> : !products.length ? <div className="empty-state"><ShoppingBag size={34} /><h2>We’re stocking the shelves</h2><p>Check back soon for your everyday essentials.</p><Link className="button primary" to="/products">Explore the store</Link></div> : shelves.map(shelf => <section className="quick-shelf" key={shelf.title}><div className="quick-section-heading"><div><h2>{shelf.title}</h2><p>{shelf.caption}</p></div><Link to="/products">See all <ArrowRight size={17} /></Link></div><div className="product-grid">{shelf.items.map(p => <ProductCard key={p.id} product={p} />)}</div></section>)}
    <Link to="/referrals" className="quick-referral"><span className="referral-symbol"><ShoppingBag size={28} /></span><div><span className="section-kicker">GOOD THINGS ARE BETTER SHARED</span><h2>Your store. Your people. Your rewards.</h2><p>Invite your friends and explore our referral programme.</p></div><span className="referral-link">Discover rewards <ArrowRight size={18} /></span></Link>
    <div className="quick-trust"><div><ShoppingBag /><span><strong>One store. All your essentials.</strong><small>Groceries, home and personal care.</small></span></div><div><MapPin /><span><strong>Rooted in your neighbourhood.</strong><small>Serving our community in Theni.</small></span></div><div><BadgeIndianRupee /><span><strong>Simple, everyday value.</strong><small>Clear prices. Savings shown upfront.</small></span></div></div>
  </div>
}
