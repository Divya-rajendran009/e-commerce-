import StoreLogo from '../components/StoreLogo'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Leaf, Menu, Search, ShoppingBasket, UserRound, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import MobileBottomNavigation from '../components/MobileBottomNavigation'
import PolicyLink from '../components/PolicyLink'
import { StoreSearch, DeliveryPicker, money } from '../components/StorefrontTools'
import '../storefront.css'
import api from '../services/api'

const PolicyPage = lazy(() => import('../pages/PolicyPage'))

export default function StoreLayout() {
  const { user, logout } = useAuth()
  const { count, subtotal } = useCart()
  const [categories, setCategories] = useState([])
  useEffect(() => { api.get('/categories/').then(({ data }) => setCategories(data.results || data)).catch(() => {}) }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [storeSettingsError, setStoreSettingsError] = useState('')
  const [openPolicy, setOpenPolicy] = useState(null)
  const policyTrigger = useRef(null)
  const [store, setStore] = useState({ store_name: 'Pandiyan Store', store_location: 'Theni, Tamil Nadu, India', contact_phone: '8072661435', business_hours: 'Every day, 9:00 AM to 9:00 PM', free_delivery_threshold: 1000 })
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => setMenuOpen(false), [location.key])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    const showPolicy = (event) => {
      if (!document.activeElement?.closest('.policy-modal')) {
        policyTrigger.current = document.activeElement
      }
      setOpenPolicy(event.detail?.policy || null)
    }
    window.addEventListener('store:open-policy', showPolicy)
    return () => window.removeEventListener('store:open-policy', showPolicy)
  }, [])
  useEffect(() => {
    if (!openPolicy) {
      policyTrigger.current?.focus?.()
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [openPolicy])
  useEffect(() => {
    api.get('/system-settings/public/').then(({ data }) => setStore((current) => ({ ...current, ...data }))).catch(() => setStoreSettingsError('Store information could not be refreshed.'))
  }, [])
  const showBasket = count > 0 && !['/cart', '/checkout', '/login', '/register'].includes(location.pathname)
  return <div className={`pandiyan-store${location.pathname === '/' ? ' discovery-store' : ''}${showBasket ? ' has-basket' : ''}`}>
    <a href="#store-content" className="skip-link">Skip to shopping</a>
    <div className="announcement"><Leaf size={14} /> Your everyday essentials <span>•</span> Free delivery above ₹{Number(store.free_delivery_threshold).toLocaleString('en-IN')}</div>
    <header className="site-header">
      <div className="header-main wrap">
        <Link to="/" className="brand"><span className="store-emblem"><StoreLogo /></span><span>Paniam Stores<small>THENI · TAMIL NADU</small></span></Link>
        <DeliveryPicker store={store} unavailable={Boolean(storeSettingsError)} />
        <StoreSearch />
        <div className="header-actions">
          <Link to={user ? '/account' : '/login'} className="account-action" aria-label={user ? 'My account' : 'Sign in'}><UserRound size={20} /><span>{user ? user.first_name || 'Account' : 'Sign in'}</span></Link>
          <Link to="/cart" className="cart-action" aria-label={`Cart with ${count} items`}><ShoppingBasket size={21} /><span>My cart<small>{count ? `${count} items · ${money(subtotal)}` : 'Start a basket'}</small></span></Link>
        </div>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}<span>{menuOpen ? 'Close' : 'Menu'}</span></button>
      </div>
      <nav id="primary-navigation" className={`main-nav${menuOpen ? ' is-open' : ''}`}><div className="wrap nav-content">
        <NavLink onClick={() => setMenuOpen(false)} to="/products">Shop all</NavLink>{categories.slice(0, 5).map((category) => <NavLink key={category.id} onClick={() => setMenuOpen(false)} to={`/products?category=${category.id}`}>{category.name}</NavLink>)}<NavLink onClick={() => setMenuOpen(false)} to="/referrals">Refer & earn</NavLink>
        {user && <button className="nav-logout" onClick={() => logout().finally(() => navigate('/'))}>Sign out</button>}
      </div></nav>
    </header>
    <main id="store-content"><Outlet /></main>
    <footer className="footer"><div className="wrap footer-grid"><div><Link to="/" className="brand footer-brand"><span className="store-emblem"><StoreLogo /></span><span>Paniam Stores<small>{store.store_location}</small></span></Link><p>Everyday essentials for you and your family.</p></div><div><strong>Shop</strong><Link to="/products">All products</Link>{categories.slice(0, 3).map((category) => <Link key={category.id} to={`/products?category=${category.id}`}>{category.name}</Link>)}</div><div><strong>Customer care</strong><Link to="/account">My account</Link><Link to="/orders">Track an order</Link><Link to="/referrals">Invite friends</Link><PolicyLink policy="delivery">Delivery policy</PolicyLink></div><div><strong>Store policies</strong><PolicyLink policy="terms">Terms &amp; Conditions</PolicyLink><PolicyLink policy="privacy">Privacy Policy</PolicyLink><PolicyLink policy="delivery">Delivery Policy</PolicyLink><PolicyLink policy="returns">Return &amp; Refund Policy</PolicyLink><PolicyLink policy="ugc">User-Generated Content Policy</PolicyLink></div><div><strong>Contact</strong><span>{store.store_location}</span><a href={`tel:${store.contact_phone}`}>{store.contact_phone}</a><span>{store.business_hours}</span>{storeSettingsError && <small role="status">{storeSettingsError}</small>}</div></div><div className="wrap footer-bottom">© {new Date().getFullYear()} Paniam Stores <span>Here for your every day</span></div></footer>
    {showBasket && <Link className="floating-basket" to="/cart"><ShoppingBasket size={22} /><span><strong>{count} {count === 1 ? 'item' : 'items'} · {money(subtotal)}</strong><small>Delivery calculated at checkout</small></span><b>View cart →</b></Link>}
    <MobileBottomNavigation />
    {openPolicy && <Suspense fallback={<div className="policy-modal-backdrop"><div className="policy-modal-loading" role="status">Loading policy…</div></div>}><PolicyPage policy={openPolicy} modal onClose={() => setOpenPolicy(null)} /></Suspense>}
  </div>
}
