import { ArrowUpRight, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ShoppingHero() {
  return <section className="quick-hero" aria-labelledby="quick-hero-title">
    <div className="quick-hero-copy"><span className="hero-kicker"><span /> YOUR NEIGHBOURHOOD STORE, ONLINE</span>
      <h1 id="quick-hero-title">Everyday essentials.<br /><em>Just a few taps away.</em></h1>
      <p>From your morning milk to your kitchen staples.<br className="desktop-break" /> A little less running around. A lot more living.</p>
      <Link to="/products" className="hero-button">Let’s fill your basket <ArrowUpRight size={18} /></Link>
    </div>
    <div className="hero-groceries" aria-hidden="true"><div className="hero-orbit" /><div className="hero-note"><ShoppingBag size={18} /><span>Fresh picks.<br /><strong>Every day.</strong></span></div><img className="hero-milk" src="/images/categories/dairy.webp" alt="" /><img className="hero-oil" src="/images/categories/pantry.webp" alt="" /><img className="hero-vegetables" src="/images/categories/vegetables.webp" alt="" /><span className="hero-stamp">GOOD THINGS<br /><b>closer to home</b></span></div>
  </section>
}
