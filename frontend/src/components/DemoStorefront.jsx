import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import products from '../data/demoProducts.json'
import { ProductImage } from './Shared'
import { money } from './StorefrontTools'

// Deliberately separate from ProductCard and CartContext: examples cannot be ordered.
export default function DemoStorefront() {
  const [department, setDepartment] = useState('All')
  const [selection, setSelection] = useState('all')
  const departments = ['All', ...new Set(products.map(p => p.category_name))]
  const shown = products.filter(p => department === 'All' || p.category_name === department)
    .filter(p => selection !== 'value' || p.price < 500)
    .sort((a, b) => selection === 'deals' ? (1 - b.price / b.mrp) - (1 - a.price / a.mrp) : 0)
  return <div className="store-home shopping-home wrap">
    <p className="demo-notice"><strong>Store preview</strong> · Example products, prices & offers. Not available to purchase.</p>
    <nav className="shop-departments" aria-label="Preview departments">
      {departments.map(name => <button key={name} type="button" className="department-shortcut" aria-pressed={department === name} onClick={() => setDepartment(name)}>
        {name === 'All' ? <span className="all-departments"><ShoppingBag size={25} /></span> : <ProductImage product={products.find(p => p.category_name === name)} />}
        <strong>{name}</strong>
      </button>)}
    </nav>
    <section className="shopping-discovery" aria-labelledby="shopping-title">
      <div className="discovery-heading"><h1 id="shopping-title">{department === 'All' ? 'Shop picks' : department}</h1><span className="demo-count">{shown.length} examples</span></div>
      <div className="discovery-tabs" role="group" aria-label="Filter example products">
        {[['all','For you','Across the store'],['deals','Offer preview','Biggest savings'],['value','Under ₹500','Everyday value']].map(([key,label,caption]) => <button key={key} type="button" aria-pressed={selection === key} onClick={() => setSelection(key)}><strong>{label}</strong><small>{caption}</small></button>)}
      </div>
      {shown.length ? <div className="product-grid discovery-products demo-products">{shown.map(product => <article key={product.id} className="product-card">
        <div className="product-image"><ProductImage product={product} /><span className="tag">{Math.round((1 - product.price / product.mrp) * 100)}% OFF · Demo</span></div>
        <div className="product-info"><span className="product-category">{product.category_name}</span><h2 className="product-title">{product.name}</h2>
          <div className="product-buy"><div className="card-price"><strong>{money(product.price)}</strong><s>{money(product.mrp)}</s></div><span className="demo-only">Preview only</span></div>
        </div>
      </article>)}</div> : <div className="empty-state"><h2>No examples under ₹500 here</h2><button className="button secondary" onClick={() => setSelection('all')}>See all examples</button></div>}
    </section>
    <p className="demo-source">Product images: <a href="https://dummyjson.com" target="_blank" rel="noreferrer">DummyJSON demo catalogue</a>. Prices and discounts are illustrative, not store offers. <Link to="/products">Open existing catalogue</Link></p>
  </div>
}
