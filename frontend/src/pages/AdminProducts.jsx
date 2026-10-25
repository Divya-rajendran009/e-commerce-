import { useEffect, useRef, useState } from 'react'
import { Box as BoxIcon, Pencil, Plus } from 'lucide-react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

const emptyProduct = { name: '', sku: '', slug: '', description: '', price: '', wholesale_price: '', mrp: '', stock: 0, image_url: '', category: '', is_active: true, is_featured: false }
const makeSlug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null })
  const [form, setForm] = useState(emptyProduct)
  const [imageFile, setImageFile] = useState(null)
  const imageInput = useRef(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [categoryName, setCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [error, setError] = useState('')
  const [statusBusy, setStatusBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const load = (pageNumber = page, searchTerm = search) => {
    setLoading(true)
    setError('')
    return Promise.all([
      api.get('/admin/products/', { params: { page: pageNumber, search: searchTerm } }),
      api.get('/admin/categories/'),
    ]).then(([p, c]) => {
      setProducts(p.data.results || p.data)
      setPagination({ count: p.data.count ?? p.data.length, next: p.data.next ?? null, previous: p.data.previous ?? null })
      setCategories(c.data.results || c.data)
      setPage(pageNumber)
    }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  const submitProduct = async (event) => {
    event.preventDefault(); setError('')
    const payload = { ...form, slug: form.slug || makeSlug(form.name), mrp: form.mrp || null, wholesale_price: form.wholesale_price === '' ? null : form.wholesale_price, category: Number(form.category), stock: Number(form.stock), price: Number(form.price) }
    const data = new FormData()
    Object.entries(payload).forEach(([key, value]) => data.append(key, value ?? ''))
    if (imageFile) data.append('image', imageFile)
    try {
      if (editing) await api.patch(`/admin/products/${editing}/`, data)
      else await api.post('/admin/products/', data)
      setForm(emptyProduct); setImageFile(null); imageInput.current.value = ''; setEditing(null); setFormOpen(false); await load()
    } catch (e) { setError(errorMessage(e)) }
  }
  const editProduct = (product) => {
    setEditing(product.id)
    setImageFile(null)
    if (imageInput.current) imageInput.current.value = ''
    setFormOpen(true)
    setForm({ ...product, category: String(product.category), price: String(product.price), mrp: product.mrp || '', wholesale_price: product.wholesale_price ?? '', stock: product.stock })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const toggleProduct = async (product) => {
    const key = `product-${product.id}`
    setStatusBusy(key); setError('')
    try { await api.patch(`/admin/products/${product.id}/`, { is_active: !product.is_active }); await load() }
    catch (e) { setError(errorMessage(e)) } finally { setStatusBusy('') }
  }
  const toggleCategory = async (category) => {
    const key = `category-${category.id}`
    setStatusBusy(key); setError('')
    try { await api.patch(`/admin/categories/${category.id}/`, { is_active: !category.is_active }); await load() }
    catch (e) { setError(errorMessage(e)) } finally { setStatusBusy('') }
  }
  const searchProducts = (event) => {
    event.preventDefault()
    setSearch(searchInput)
    load(1, searchInput)
  }
  const submitCategory = async (event) => {
    event.preventDefault(); setError('')
    const payload = { name: categoryName.trim(), slug: makeSlug(categoryName), ...(!editingCategory && { is_active: true }) }
    try {
      if (editingCategory) await api.patch(`/admin/categories/${editingCategory}/`, payload)
      else await api.post('/admin/categories/', payload)
      setCategoryName(''); setEditingCategory(null); await load()
    } catch (e) { setError(errorMessage(e)) }
  }
  if (loading) return <Loading />
  return <section className="wrap section admin-page"><span className="eyebrow">STORE MANAGEMENT</span><h1>Products & categories</h1>{error && <ErrorState message={error} />}
    <button type="button" className="button primary admin-product-form-toggle" aria-expanded={formOpen} onClick={() => setFormOpen((open) => !open)}>{formOpen ? 'Close product form' : editing ? 'Continue editing product' : 'Add a product'}</button>
    <div className="admin-edit-grid">
      <form className={`checkout-form admin-product-form${formOpen ? ' is-open' : ''}`} onSubmit={submitProduct}><h2>{editing ? 'Edit product' : 'Add a product'}</h2><label className="field"><span>Product name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editing ? form.slug : makeSlug(e.target.value) })} /></label><label className="field"><span>SKU</span><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></label><label className="field"><span>Category</span><select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">Choose a category</option>{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}{cat.is_active ? '' : ' (inactive)'}</option>)}</select></label><div className="inline-fields"><label className="field"><span>Retail price (₹)</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label className="field"><span>MRP (₹)</span><input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></label><label className="field"><span>Stock</span><input required type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label></div><label className="field"><span>Wholesale price (₹)</span><input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} /><small>Optional price per unit for wholesale buyers. Leave blank if no wholesale rate is available.</small></label><label className="field"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className="field"><span>Product image</span><input ref={imageInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /><small>Choose a JPEG, PNG, GIF, or WebP image (maximum 5 MB).{imageFile ? ` Selected: ${imageFile.name}` : form.image_url ? ' Leave empty to keep the current image.' : ''}</small></label>{form.image_url && !imageFile && <img className="admin-product-image-preview" src={form.image_url} alt={`Current image for ${form.name}`} />}<label className="check-field"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Product active and eligible for sale</label><label className="check-field"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Featured product</label><div className="form-actions"><button className="button primary"><Plus size={15} /> {editing ? 'Save changes' : 'Create product'}</button>{editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyProduct); setImageFile(null); if (imageInput.current) imageInput.current.value = ''; setFormOpen(false) }}>Cancel</button>}</div></form>
      <div className="checkout-form category-admin"><h2>Manage categories</h2><form onSubmit={submitCategory} className="category-form"><label className="field"><span>{editingCategory ? 'Edit category name' : 'New category name'}</span><input required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} /></label><button className="button primary">{editingCategory ? 'Save category' : 'Add category'}</button></form><div className="admin-category-list">{categories.map((cat) => <div key={cat.id}><span><strong>{cat.name}</strong><small className={`status-label ${cat.is_active ? 'is-active' : 'is-inactive'}`}>{cat.is_active ? 'Active' : 'Inactive'}</small></span><button type="button" role="switch" aria-checked={cat.is_active} aria-label={`${cat.is_active ? 'Deactivate' : 'Activate'} category ${cat.name}`} disabled={statusBusy === `category-${cat.id}`} className={`visibility-switch${cat.is_active ? ' is-on' : ''}`} onClick={() => toggleCategory(cat)}>{cat.is_active ? 'ON' : 'OFF'}</button><button type="button" aria-label={`Edit ${cat.name}`} onClick={() => { setEditingCategory(cat.id); setCategoryName(cat.name) }}><Pencil size={14} /></button></div>)}</div></div>
    </div>
    <div className="admin-list-heading"><h2>Product catalogue</h2><span>{pagination.count} products</span></div>
    <form className="admin-list-filters" onSubmit={searchProducts}><label className="field"><span>Search products</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Product name or SKU" /></label><button className="button primary">Search</button></form>
    <div className="admin-table-wrap admin-product-table"><table className="admin-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Retail price</th><th>Wholesale price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td>{product.name}</td><td>{product.sku}</td><td>{product.category_name}</td><td>₹{Number(product.price).toFixed(2)}</td><td>{product.wholesale_price == null ? 'Not set' : `₹${Number(product.wholesale_price).toFixed(2)}`}</td><td>{product.stock}</td><td><div className="admin-visibility-control"><span className={`status-label ${product.is_active ? 'is-active' : 'is-inactive'}`}>{product.is_active ? 'Active' : 'Inactive'}</span><button type="button" role="switch" aria-checked={product.is_active} aria-label={`${product.is_active ? 'Deactivate' : 'Activate'} product ${product.name}`} disabled={statusBusy === `product-${product.id}`} className={`visibility-switch${product.is_active ? ' is-on' : ''}`} onClick={() => toggleProduct(product)}>{product.is_active ? 'ON' : 'OFF'}</button></div></td><td><button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => editProduct(product)}><Pencil size={16} /></button></td></tr>)}</tbody></table></div>
    <div className="admin-product-cards">{products.map((product) => <article className="admin-product-card" key={product.id}>
      {product.image_url ? <img src={product.image_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span className="admin-product-placeholder"><BoxIcon /></span>}
      <div className="admin-product-info"><strong>{product.name}</strong><small>{product.sku} · {product.category_name}</small><span>₹{Number(product.price).toFixed(2)} · {product.stock} in stock</span><small>Wholesale: {product.wholesale_price == null ? 'Not set' : `₹${Number(product.wholesale_price).toFixed(2)}`}</small><span className={`status-label ${product.is_active ? 'is-active' : 'is-inactive'}`}>{product.is_active ? 'Active' : 'Inactive'}{product.stock === 0 ? ' · Out of stock' : ''}</span></div>
      <div className="admin-product-actions"><button type="button" role="switch" aria-checked={product.is_active} aria-label={`${product.is_active ? 'Deactivate' : 'Activate'} product ${product.name}`} disabled={statusBusy === `product-${product.id}`} className={`visibility-switch${product.is_active ? ' is-on' : ''}`} onClick={() => toggleProduct(product)}>{product.is_active ? 'ON' : 'OFF'}</button><button type="button" className="button secondary small" onClick={() => editProduct(product)}><Pencil size={15} /> Edit</button></div>
    </article>)}</div>
    <div className="admin-pagination"><span>{pagination.count} products · page {page}</span><div><button type="button" className="button secondary small" disabled={!pagination.previous} onClick={() => load(page - 1)}>Previous</button><button type="button" className="button secondary small" disabled={!pagination.next} onClick={() => load(page + 1)}>Next</button></div></div>
  </section>
}
