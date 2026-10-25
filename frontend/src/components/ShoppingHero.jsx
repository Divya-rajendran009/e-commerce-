import { Link } from 'react-router-dom'

export default function ShoppingHero() {
  return <section className="quick-hero" aria-labelledby="quick-hero-title">
    <img className="quick-hero-image" src="/images/storefront/grocery-hero.webp" width="2172" height="724" alt="" fetchPriority="high" decoding="async" />
    <div className="quick-hero-copy">
      <h1 id="quick-hero-title">Stock up on everyday essentials</h1>
      <p>Fresh groceries, kitchen staples &amp; more.<br />All your favourites, just a few taps away.</p>
      <Link to="/products" className="hero-button">Shop now</Link>
    </div>
  </section>
}
