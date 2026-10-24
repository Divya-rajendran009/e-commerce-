import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorState, ProductCard } from '../components/Shared'
import api, { errorMessage } from '../services/api'
import { ProductSkeletons } from '../components/StorefrontTools'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasNext, setHasNext] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => { api.get('/categories/').then(({ data }) => setCategories(data.results || data)).catch((e) => setError(errorMessage(e))) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(() => api.get('/products/', { params: Object.fromEntries(params.entries()), signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const results = data.results || data
        setProducts(results)
        setTotal(data.count ?? results.length)
        setHasNext(Boolean(data.next))
      })
      .catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) }), params.get('search') ? 250 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [params, retry])
  const setParam = (key, value) => {
    if (key === 'page') window.scrollTo({ top: 0, behavior: 'instant' })
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  return <section className="wrap section catalogue">
    <div className="catalogue-title"><div><h1>{params.get('search') ? `Results for “${params.get('search')}”` : categories.find(c => String(c.id) === params.get('category'))?.name || 'Shop all products'}</h1></div><div className="catalog-count"><SlidersHorizontal size={17} /> {total} items</div></div>
    <nav className="category-shortcuts" aria-label="Shop by category">
      <button type="button" aria-pressed={!params.get('category')} className={!params.get('category') ? 'is-active' : ''} onClick={() => setParam('category', '')}>All aisles</button>
      {categories.map((category) => <button type="button" aria-pressed={params.get('category') === String(category.id)} className={params.get('category') === String(category.id) ? 'is-active' : ''} key={category.id} onClick={() => setParam('category', String(category.id))}>{category.name}</button>)}
    </nav>
    <nav className="category-shortcuts" aria-label="Product collections">{[['', 'All products'], ['referral', 'Referral bonus'], ['fast-moving', 'Fast moving']].map(([value, label]) => <button key={value} aria-pressed={(params.get('collection') || '') === value} className={(params.get('collection') || '') === value ? 'is-active' : ''} onClick={() => setParam('collection', value)}>{label}</button>)}</nav>
    <div className="filters">
      <label>Category<select value={params.get('category') || ''} onChange={(e) => setParam('category', e.target.value)}><option value="">All aisles</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label>Sort by<select value={params.get('ordering') || ''} onChange={(e) => setParam('ordering', e.target.value)}><option value="">Recommended</option><option value="price">Price: low to high</option><option value="-price">Price: high to low</option><option value="name">Name: A to Z</option></select></label>
      <label className="catalog-search">Search<input value={params.get('search') || ''} onChange={(e) => setParam('search', e.target.value)} placeholder="Search products…" /></label>
    </div>
    {error ? <ErrorState message={error} /> : loading ? <ProductSkeletons count={12} /> : products.length ? <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>No products found</h2><p>Try a different search or category.</p><button className="button secondary" onClick={() => setParams({})}>Clear filters</button></div>}
    {error && <button className="button secondary" onClick={() => setRetry((value) => value + 1)}>Retry products</button>}
    {!loading && !error && <nav className="pagination-controls" aria-label="Product pages"><button className="button secondary" disabled={Number(params.get('page') || 1) <= 1} onClick={() => setParam('page', String(Number(params.get('page')) - 1))}>Previous</button><span>Page {params.get('page') || 1}</span><button className="button secondary" disabled={!hasNext} onClick={() => setParam('page', String(Number(params.get('page') || 1) + 1))}>Next</button></nav>}
  </section>
}
