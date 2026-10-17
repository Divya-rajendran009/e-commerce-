import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Leaf, Menu, Search, ShoppingBasket, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import MobileBottomNavigation from '../components/MobileBottomNavigation'

export default function StoreLayout() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const search = (event) => {
    event.preventDefault()
    navigate(`/products${query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ''}`)
  }
  return <>
    <div className="announcement"><Leaf size={14} /> Fresh picks for every table <span>•</span> Free delivery on orders over ₹999</div>
    <header className="site-header">
      <div className="header-main wrap">
        <Link to="/" className="brand"><span className="brand-mark"><Leaf size={22} /></span><span>SUPER<span className="brand-light"> MARKET</span><small>Freshness, every day</small></span></Link>
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
    <footer className="footer"><div className="wrap footer-grid"><div><Link to="/" className="brand footer-brand"><span className="brand-mark"><Leaf size={22} /></span><span>SUPER MARKET<small>Good food. Good days.</small></span></Link><p>Everyday groceries, thoughtfully picked for your home.</p></div><div><strong>Shop</strong><Link to="/products">All products</Link><Link to="/products">Fresh produce</Link><Link to="/products">Pantry essentials</Link></div><div><strong>Customer care</strong><Link to="/account">My account</Link><Link to="/orders">Track an order</Link><Link to="/referrals">Referral rewards</Link></div><div><strong>Need a hand?</strong><span>Mon–Sat · 9am–6pm</span><a href="mailto:hello@supermarket.example">hello@supermarket.example</a><small>Demo storefront. Sample data only.</small></div></div><div className="wrap footer-bottom">© {new Date().getFullYear()} SUPER MARKET <span>Made for fresh everyday living</span></div></footer>
    <MobileBottomNavigation />
  </>
}
