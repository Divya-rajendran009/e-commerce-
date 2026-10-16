import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

const emptyProduct = { name: '', sku: '', slug: '', description: '', price: '', mrp: '', stock: 0, image_url: '', category: '', is_active: true, is_featured: false }
const makeSlug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyProduct)
  const [editing, setEditing] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = () => Promise.all([api.get('/admin/products/'), api.get('/admin/categories/')]).then(([p, c]) => {
    setProducts(p.data.results || p.data)
    setCategories(c.data.results || c.data)
  }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const submitProduct = async (event) => {
    event.preventDefault(); setError('')
    const payload = { ...form, slug: form.slug || makeSlug(form.name), mrp: form.mrp || null, category: Number(form.category), stock: Number(form.stock), price: Number(form.price) }
    try {
      if (editing) await api.patch(`/admin/products/${editing}/`, payload)
      else await api.post('/admin/products/', payload)
      setForm(emptyProduct); setEditing(null); await load()
    } catch (e) { setError(errorMessage(e)) }
  }
  const editProduct = (product) => {
    setEditing(product.id)
    setForm({ ...product, category: String(product.category), price: String(product.price), mrp: product.mrp || '', stock: product.stock })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const deactivate = async (product) => {
    if (!window.confirm(`Deactivate ${product.name}?`)) return
    try { await api.delete(`/admin/products/${product.id}/`); await load() } catch (e) { setError(errorMessage(e)) }
  }
  const submitCategory = async (event) => {
    event.preventDefault(); setError('')
    const payload = { name: categoryName.trim(), slug: makeSlug(categoryName), is_active: true }
    try {
      if (editingCategory) await api.patch(`/admin/categories/${editingCategory}/`, payload)
      else await api.post('/admin/categories/', payload)
      setCategoryName(''); setEditingCategory(null); await load()
    } catch (e) { setError(errorMessage(e)) }
  }
  if (loading) return <Loading />
  return <section className="wrap section admin-page"><span className="eyebrow">STORE MANAGEMENT</span><h1>Products & categories</h1>{error && <ErrorState message={error} />}
    <div className="admin-edit-grid">
      <form className="checkout-form" onSubmit={submitProduct}><h2>{editing ? 'Edit product' : 'Add a product'}</h2><label className="field"><span>Product name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : makeSlug(e.target.value) })} /></label><label className="field"><span>SKU</span><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label className="field"><span>Category</span><select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Choose a category</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label><div className="inline-fields"><label className="field"><span>Price (₹)</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label className="field"><span>MRP (₹)</span><input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></label><label className="field"><span>Stock</span><input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label></div><label className="field"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className="field"><span>Image URL</span><input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></label><label className="check-field"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured product</label><div className="form-actions"><button className="button primary"><Plus size={15} /> {editing ? 'Save changes' : 'Create product'}</button>{editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyProduct) }}>Cancel</button>}</div></form>
      <div className="checkout-form category-admin"><h2>Manage categories</h2><form onSubmit={submitCategory} className="category-form"><label className="field"><span>{editingCategory ? 'Edit category name' : 'New category name'}</span><input required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /></label><button className="button primary">{editingCategory ? 'Save category' : 'Add category'}</button></form><div className="admin-category-list">{categories.map((cat) => <div key={cat.id}><span>{cat.name}</span><button aria-label={`Edit ${cat.name}`} onClick={() => { setEditingCategory(cat.id); setCategoryName(cat.name) }}><Pencil size={14} /></button></div>)}</div></div>
    </div>
    <h2>Product catalogue</h2><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.sku}</td><td>{product.category_name}</td><td>₹{Number(product.price).toFixed(2)}</td><td>{product.stock}</td><td>{product.is_active ? 'Active' : 'Inactive'}</td><td><button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => editProduct(product)}><Pencil size={16} /></button><button className="icon-button" aria-label={`Deactivate ${product.name}`} onClick={() => deactivate(product)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
  </section>
}
