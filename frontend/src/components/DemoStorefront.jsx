import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { searchDemoProducts } from '../utils/demoCatalogue'
import { departmentUrl, resolveDepartment, storeThemes } from '../utils/storeThemes'
import categoryImages from '../data/departments.json'
import { ProductImage } from './Shared'
import { productImageSource } from '../utils/catalogueArtwork'
import { money } from './StorefrontTools'
import DemoQuantityControl from './DemoQuantityControl'

function DemoProductCard({ product }) {
  const [size, setSize] = useState(product.sizes?.includes('M') ? 'M' : product.sizes?.[0] || '')
  return <article className="product-card">
    <div className="product-image"><ProductImage product={product} /><span className="tag">{Math.round((1 - product.price / product.mrp) * 100)}% OFF · Demo</span></div>
    <div className="product-info"><span className="product-category">{product.category_name}</span><h2 className="product-title">{product.name}</h2>
      <p className="demo-pack">{product.pack_size} <span>· example</span></p>
      {product.sizes && <label className="demo-size"><span>Size</span><select aria-label={`Example size for ${product.name}`} value={size} onChange={event => setSize(event.target.value)}>{product.sizes.map(option => <option key={option}>{option}</option>)}</select></label>}
      <div className="product-buy"><div className="card-price"><strong>{money(product.price)}</strong><s>{money(product.mrp)}</s></div><DemoQuantityControl product={product} size={size} /></div>
    </div>
  </article>
}

export default function DemoStorefront() {
  const [params] = useSearchParams()
  const query = params.get('search') || ''
  const department = resolveDepartment(params.get('department'))
  const theme = storeThemes[department]
  const [selection, setSelection] = useState('all')
  const festive = department === 'All' || department === 'Diwali'
  const shown = searchDemoProducts(query).filter(p => festive || p.category_name === department)
    .filter(p => selection !== 'value' || p.price < 500)
    .sort((a, b) => selection === 'deals' ? (1 - b.price / b.mrp) - (1 - a.price / a.mrp) : 0)
  const featureDepartments = department === 'Diwali' ? ['Clothing', 'Perfumes', 'Toiletries'] : [department]
  return <div className="store-home shopping-home wrap video-storefront">
    <p className="demo-notice"><strong>Store preview</strong> · Try ADD & quantities. Demo basket only; checkout disabled.</p>
    {!query && <section className={`department-hero ${festive ? 'festival-hero' : ''}`} aria-label={theme.subtitle}>
      {festive && <div className="festoon" aria-hidden="true">{Array.from({length:18}, (_, index) => <i key={index} style={{'--bulb':index}} />)}</div>}
      <small>{theme.subtitle}</small>
      <h1 className={department === 'All' ? 'festival-ribbon' : ''}>{theme.title}</h1>
      {department === 'All' && <div className="festival-caption"><span>For every celebration</span><span>For every home</span></div>}
      {!festive && <img className="department-hero-photo" src={categoryImages.find(c => c.name === department)?.image_url} alt="" width="110" height="110" />}
    </section>}
    {department !== 'All' && !query && <div className="department-stories" aria-label="Department highlights">
      {(department === 'Diwali' ? featureDepartments.map(name => ({name, image_url:categoryImages.find(c => c.name === name)?.image_url, to:departmentUrl(name)})) : shown.slice(0,3).map(p => ({name:p.name,image_url:productImageSource(p),to:`/?department=${encodeURIComponent(department)}&search=${encodeURIComponent(p.name)}`}))).map(item => <Link key={item.name} to={item.to}><img src={item.image_url} alt="" width="120" height="100" /><strong>{item.name}</strong><span>Explore <ChevronRight size={13} /></span></Link>)}
    </div>}
    <section className="shopping-discovery" aria-labelledby="shopping-title" key={`${department}-${query}`}>
      {query && <div className="demo-results-summary" role="status"><span>{shown.length} {shown.length === 1 ? 'result' : 'results'} for <strong>“{query}”</strong></span><Link to={departmentUrl(department)}>Clear search</Link></div>}
      <div className="discovery-heading"><h2 id="shopping-title">{festive ? 'Top picks for you' : `${department} picks`}</h2><span className="demo-count">{shown.length} examples</span></div>
      <div className="discovery-tabs" role="group" aria-label="Filter example products">
        {[['all','Top picks','Across the store'],['deals',festive ? 'Festive offers' : 'Offers','Demo savings'],['value','Under ₹500','Everyday value']].map(([key,label,caption]) => <button key={key} type="button" aria-pressed={selection === key} onClick={() => setSelection(key)}><strong>{label}</strong><small>{caption}</small></button>)}
      </div>
      {shown.length ? <div className="product-grid discovery-products demo-products">{shown.map(product => <DemoProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><h2>{query ? `No matches for “${query}”` : 'No examples match these filters'}</h2><p>Try another search or reset your filters.</p><Link className="button secondary" to="/" onClick={() => setSelection('all')}>See all examples</Link></div>}
    </section>
    <section className="permanent-departments"><div><h2>Shop by category</h2><Link to="/categories">See all <ChevronRight size={15} /></Link></div><nav aria-label="All categories">{categoryImages.map(category => <Link key={category.name} to={departmentUrl(category.name)}><img src={category.image_url} alt="" width="70" height="70" loading="lazy" /><span>{category.name}</span></Link>)}</nav></section>
    <p className="demo-source">Product images: <a href="https://dummyjson.com" target="_blank" rel="noreferrer">DummyJSON demo catalogue</a>. Pack sizes, clothing sizes, prices and discounts are illustrative, not store offers. <Link to="/products">Open existing catalogue</Link></p>
  </div>
}
