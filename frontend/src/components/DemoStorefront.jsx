import { searchDemoProducts } from '../utils/demoCatalogue'
import categoryImages from '../data/departments.json'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { ProductImage } from './Shared'
import { money } from './StorefrontTools'

// Deliberately separate from ProductCard and CartContext: examples cannot be ordered.
export default function DemoStorefront() {
  const [params] = useSearchParams()
  const query = params.get('search') || ''
  const [department, setDepartment] = useState('All')
  const [selection, setSelection] = useState('all')
  const departments = ['All', ...categoryImages.map(c => c.name)]
  const shown = searchDemoProducts(query).filter(p => department === 'All' || p.category_name === department)
    .filter(p => selection !== 'value' || p.price < 500)
    .sort((a, b) => selection === 'deals' ? (1 - b.price / b.mrp) - (1 - a.price / a.mrp) : 0)
  return <div className="store-home shopping-home wrap">
    <p className="demo-notice"><strong>Store preview</strong> · Example products, sizes & prices. Not available to purchase.</p>
    <nav className="shop-departments" aria-label="Preview departments">
      {departments.map(name => <button key={name} type="button" className="department-shortcut" aria-pressed={department === name} onClick={() => setDepartment(name)}>
        {name === 'All' ? <span className="all-departments"><ShoppingBag size={25} /></span> : <ProductImage product={categoryImages.find(c => c.name === name)} />}
        <strong>{name}</strong>
      </button>)}
    </nav>
    {!query && <div className="diwali-strip"><span className="festival-lamp" aria-hidden="true" /><div><small>THE DIWALI EDIT</small><h2>Festival of finds</h2><p>A little joy for every home.</p></div><span className="festival-lamp" aria-hidden="true" /></div>}<section className="shopping-discovery" aria-labelledby="shopping-title">
      {query && <div className="demo-results-summary" role="status"><span>{shown.length} results for <strong>“{query}”</strong></span><Link to="/">Clear search</Link></div>}<div className="discovery-heading"><h1 id="shopping-title">{department === 'All' ? 'Shop picks' : department}</h1><span className="demo-count">{shown.length} examples</span></div>
      <div className="discovery-tabs" role="group" aria-label="Filter example products">
        {[['all','Top picks','For your celebrations'],['deals','Festive offers','Demo savings'],['value','Under ₹500','Little joys, less spend']].map(([key,label,caption]) => <button key={key} type="button" aria-pressed={selection === key} onClick={() => setSelection(key)}><strong>{label}</strong><small>{caption}</small></button>)}
      </div>
      {shown.length ? <div className="product-grid discovery-products demo-products">{shown.map(product => <article key={product.id} className="product-card">
        <div className="product-image"><ProductImage product={product} /><span className="tag">{Math.round((1 - product.price / product.mrp) * 100)}% OFF · Demo</span></div>
        <div className="product-info"><span className="product-category">{product.category_name}</span><h2 className="product-title">{product.name}</h2>
          <p className="demo-pack">{product.pack_size} <span>· example</span></p>{product.sizes && <label className="demo-size"><span>Size</span><select aria-label={`Example size for ${product.name}`} defaultValue="M">{product.sizes.map(size => <option key={size}>{size}</option>)}</select></label>}<div className="product-buy"><div className="card-price"><strong>{money(product.price)}</strong><s>{money(product.mrp)}</s></div><span className="demo-only">Preview only</span></div>
        </div>
      </article>)}</div> : <div className="empty-state"><h2>{query ? `No matches for “${query}”` : 'No examples match these filters'}</h2><p>Try another search or reset your filters.</p><Link className="button secondary" to="/" onClick={() => { setSelection('all'); setDepartment('All') }}>See all examples</Link></div>}
    </section>
    <p className="demo-source">Product images: <a href="https://dummyjson.com" target="_blank" rel="noreferrer">DummyJSON demo catalogue</a>. Pack sizes, clothing sizes, prices and discounts are illustrative, not store offers. <Link to="/products">Open existing catalogue</Link></p>
  </div>
}
