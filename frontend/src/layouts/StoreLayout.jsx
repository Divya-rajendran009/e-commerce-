import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Leaf, Menu, Search, ShoppingBasket, UserRound, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import MobileBottomNavigation from '../components/MobileBottomNavigation'
import PolicyLink from '../components/PolicyLink'
import api from '../services/api'

const PolicyPage = lazy(() => import('../pages/PolicyPage'))

export default function StoreLayout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [storeSettingsError, setStoreSettingsError] = useState('')
  const [openPolicy, setOpenPolicy] = useState(null)
  const policyTrigger = useRef(null)
  const [store, setStore] = useState({ store_name: 'Pandiyan Store', store_location: 'Theni, Tamil Nadu, India', contact_phone: '8072661435', business_hours: 'Every day, 9:00 AM to 9:00 PM', free_delivery_threshold: 1000 })
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => setMenuOpen(false), [location.key])
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
  const search = (event) => {
    event.preventDefault()
    navigate(`/products${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`)
  }
  return <>
    <div className="announcement"><Leaf size={14} /> Fresh picks for every table <span>•</span> Free delivery above ₹{Number(store.free_delivery_threshold).toLocaleString('en-IN')}</div>
    <header className="site-header">
      <div className="header-main wrap">
        <Link to="/" className="brand"><span className="brand-mark"><Leaf size={22} /></span><span>{store.store_name}<small>Freshness, every day</small></span></Link>
        <form className="search-box" onSubmit={search}><Search size={19} /><input aria-label="Search products" placeholder="Search rice, fruits, daily essentials…" value={query} onChange={(e) => setQuery(e.target.value)} /><button aria-label="Submit search">Search</button></form>
        <div className="header-actions">
          <Link to={user ? '/account' : '/login'} className="account-action"><UserRound size={20} /><span>{user ? user.first_name || 'Account' : 'Sign in'}</span></Link>
          <Link to="/cart" className="cart-action" aria-label={`Cart with ${count} items`}><ShoppingBasket size={21} /><span>Cart</span><b>{count}</b></Link>
        </div>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}<span>{menuOpen ? 'Close' : 'Menu'}</span></button>
      </div>
      <nav id="primary-navigation" className={`main-nav${menuOpen ? ' is-open' : ''}`}><div className="wrap nav-content">
        <NavLink onClick={() => setMenuOpen(false)} to="/products">Shop all</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/products">Fresh produce</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/products">Pantry</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/products">Dairy & eggs</NavLink><NavLink onClick={() => setMenuOpen(false)} to="/referrals">Refer & earn</NavLink>
        {user && <button className="nav-logout" onClick={() => logout().finally(() => navigate('/'))}>Sign out</button>}
      </div></nav>
    </header>
    <main><Outlet /></main>
    <footer className="footer"><div className="wrap footer-grid"><div><Link to="/" className="brand footer-brand"><span className="brand-mark"><Leaf size={22} /></span><span>{store.store_name}<small>{store.store_location}</small></span></Link><p>Everyday groceries, thoughtfully picked for your home.</p></div><div><strong>Shop</strong><Link to="/products">All products</Link><Link to="/products">Fresh produce</Link><Link to="/products">Pantry essentials</Link></div><div><strong>Customer care</strong><Link to="/account">My account</Link><Link to="/orders">Track an order</Link><Link to="/referrals">Invite friends</Link><PolicyLink policy="delivery">Delivery policy</PolicyLink></div><div><strong>Store policies</strong><PolicyLink policy="terms">Terms &amp; Conditions</PolicyLink><PolicyLink policy="privacy">Privacy Policy</PolicyLink><PolicyLink policy="delivery">Delivery Policy</PolicyLink><PolicyLink policy="returns">Return &amp; Refund Policy</PolicyLink><PolicyLink policy="ugc">User-Generated Content Policy</PolicyLink></div><div><strong>Contact</strong><span>{store.store_location}</span><a href={`tel:${store.contact_phone}`}>{store.contact_phone}</a><span>{store.business_hours}</span>{storeSettingsError && <small role="status">{storeSettingsError}</small>}</div></div><div className="wrap footer-bottom">© {new Date().getFullYear()} {store.store_name} <span>Made for fresh everyday living</span></div></footer>
    <MobileBottomNavigation />
    {openPolicy && <Suspense fallback={<div className="policy-modal-backdrop"><div className="policy-modal-loading" role="status">Loading policy…</div></div>}><PolicyPage policy={openPolicy} modal onClose={() => setOpenPolicy(null)} /></Suspense>}
  </>
}
