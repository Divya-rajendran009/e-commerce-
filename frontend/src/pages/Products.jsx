import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorState, Loading, ProductCard } from '../components/Shared'
import { useCart } from '../context/CartContext'
import api, { errorMessage } from '../services/api'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { add } = useCart()
  useEffect(() => { api.get('/categories/').then(({ data }) => setCategories(data.results || data)).catch((e) => setError(errorMessage(e))) }, [])
  useEffect(() => {
    setLoading(true)
    api.get('/products/', { params: Object.fromEntries(params.entries()) })
      .then(({ data }) => setProducts(data.results || data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [params])
  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('page')
    setParams(next)
  }
  return <section className="wrap section catalogue">
    <div className="catalogue-title"><div><span className="eyebrow">THE EVERYDAY MARKET</span><h1>Shop groceries</h1><p>Find your household favourites, all in one place.</p></div><div className="catalog-count"><SlidersHorizontal size={17} /> {products.length} items</div></div>
    <div className="filters">
      <label>Category<select value={params.get('category') || ''} onChange={(e) => setParam('category', e.target.value)}><option value="">All aisles</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Sort by<select value={params.get('ordering') || ''} onChange={(e) => setParam('ordering', e.target.value)}><option value="">Recommended</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option><option value="name">Name: A to Z</option></select></label>
      <label className="catalog-search">Search<input value={params.get('search') || ''} onChange={(e) => setParam('search', e.target.value)} placeholder="Search products…" /></label>
    </div>
    {error ? <ErrorState message={error} /> : loading ? <Loading /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} onAdd={add} />)}</div> : <div className="empty-state"><h2>No products found</h2><p>Try a different search or category.</p></div>}
  </section>
}
