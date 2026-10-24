import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Trash2 } from 'lucide-react'
import { useDemoBasket } from '../context/DemoBasketContext'
import DemoQuantityControl from '../components/DemoQuantityControl'
import { ProductImage } from '../components/Shared'
import { money } from '../components/StorefrontTools'

export default function DemoBasket() {
  const { lines, count, subtotal, remove, clear } = useDemoBasket()
  return <section className="wrap section demo-basket-page">
    <Link className="text-link" to="/"><ArrowLeft size={16} /> Continue demo shopping</Link>
    <div className="demo-basket-heading"><h1>Demo basket</h1>{count > 0 && <button type="button" className="text-link" onClick={clear}>Clear demo basket</button>}</div>
    <p className="demo-basket-notice">For trying out the store. Products and prices are examples. No orders or payments can be made here.</p>
    {lines.length ? <div className="demo-basket-layout">
      <div className="demo-basket-items">{lines.map(item => <article className="demo-basket-item" key={item.key}>
        <div className="demo-basket-photo"><ProductImage product={item} /></div>
        <div className="demo-basket-description"><h2>{item.name}</h2><p>{item.pack_size}{item.size ? ` · Size ${item.size}` : ''}</p><strong>{money(item.price)} <small>each</small></strong></div>
        <button type="button" className="demo-remove" aria-label={`Remove ${item.name}${item.size ? `, size ${item.size}` : ''} from demo basket`} onClick={() => remove(item.id, item.size)}><Trash2 size={17} /></button>
        <DemoQuantityControl product={item} size={item.size} />
        <b className="demo-line-total">{money(item.price * item.quantity)}</b>
      </article>)}</div>
      <aside className="demo-basket-summary"><h2>Demo summary</h2><div><span>{count} {count === 1 ? 'item' : 'items'}</span><strong>{money(subtotal)}</strong></div><p>Illustrative subtotal only. Delivery and checkout are unavailable in this demo.</p><button type="button" className="button primary full" disabled aria-describedby="demo-checkout-note">Checkout unavailable</button><small id="demo-checkout-note">Demo basket · No payment required</small></aside>
    </div> : <div className="demo-basket-empty"><ShoppingBag size={38} aria-hidden="true" /><h2>Your demo basket is empty</h2><p>Tap ADD on a product to try it out.</p><Link to="/" className="button primary">Explore demo products</Link></div>}
  </section>
}
