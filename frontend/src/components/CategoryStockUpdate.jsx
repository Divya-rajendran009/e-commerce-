import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from './Shared'

export default function CategoryStockUpdate() {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState(null)
  const [products, setProducts] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setMessage('')
    api.get('/admin/inventory/stock/', { params: category ? { category: category.id } : {} })
      .then(({ data }) => { if (active) { if (category) setProducts(data.results); else setCategories(data.results) } })
      .catch((e) => { if (active) setError(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [category])
  const modified = products.filter((p) => drafts[p.id] !== undefined && drafts[p.id] !== String(p.stock))
  const save = async (items) => {
    if (busy || !items.length) return
    setError(''); setMessage('')
    if (items.some((p) => !/^\d+$/.test(drafts[p.id]) || Number(drafts[p.id]) > 2147483647)) {
      setError('Enter a non-negative whole number up to 2147483647 for every revised quantity.')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/admin/inventory/stock/', { changes: items.map((p) => ({ id: p.id, stock: Number(drafts[p.id]), expected_stock: p.stock })) })
      const saved = new Map(data.updated.map((p) => [p.id, p.stock]))
      setProducts((current) => current.map((p) => saved.has(p.id) ? { ...p, stock: saved.get(p.id) } : p))
      setDrafts((current) => { const next = { ...current }; saved.forEach((_, id) => delete next[id]); return next })
      setMessage(`${data.updated.length} product${data.updated.length === 1 ? '' : 's'} updated successfully.`)
    } catch (e) {
      const conflicts = e.response?.data?.conflicts
      if (conflicts) setProducts((current) => current.map((p) => { const fresh = conflicts.find((item) => item.id === p.id); return fresh ? { ...p, stock: fresh.stock } : p }))
      setError(errorMessage(e))
    } finally { setBusy(false) }
  }
  const back = () => {
    if (modified.length && !window.confirm('Discard unsaved stock changes and return to categories?')) return
    setDrafts({}); setProducts([]); setCategory(null)
  }
  return <section className="category-stock-update">
    <h2>Stock Update</h2>
    {!category ? <><p>Total categories: <strong>{categories.length}</strong></p><p>Select a category to update its product quantities.</p></> : <div className="admin-list-heading"><div><button type="button" className="button secondary" disabled={busy} onClick={back}>Back to categories</button><h3>{category.name}</h3><p>{products.length} products · {modified.length} modified</p></div><button type="button" className="button primary" disabled={busy || loading || !modified.length} onClick={() => save(modified)}>{busy ? 'Saving…' : 'Update All Changes'}</button></div>}
    {error && <ErrorState message={error} />}
    {message && <p role="status">{message}</p>}
    {loading ? <Loading /> : !category ? <div className="stock-category-grid">{categories.map((item) => <button type="button" className="button secondary stock-category" key={item.id} onClick={() => setCategory(item)}><strong>{item.name}</strong><span>{item.product_count} products{item.is_active ? '' : ' · Inactive'}</span></button>)}{!categories.length && !error && <p>No categories yet.</p>}</div> : <div className="stock-product-list">{products.map((p) => <form className="stock-product-row" key={p.id} onSubmit={(event) => { event.preventDefault(); save([p]) }}>
      <div><strong>{p.name}</strong><p>Code / SKU: {p.sku}</p></div>
      <div>Current stock: <strong>{p.stock}</strong></div>
      <label className="field"><span>Revised stock for {p.name}</span><input type="number" min="0" max="2147483647" step="1" required disabled={busy} value={drafts[p.id] ?? String(p.stock)} onChange={(event) => { setDrafts({ ...drafts, [p.id]: event.target.value }); setMessage('') }} /></label>
      <button className="button primary" disabled={busy || !modified.some((item) => item.id === p.id)}>Update</button>
    </form>)}{!products.length && !error && <p>No products in this category.</p>}</div>}
  </section>
}
