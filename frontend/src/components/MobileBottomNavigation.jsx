import { House, LayoutGrid, ShieldCheck, ShoppingBag, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function MobileBottomNavigation() {
  const { user } = useAuth()
  const { count } = useCart()
  const { pathname } = useLocation()

  const accountActive = ['/account', '/orders', '/referrals', '/login', '/register', '/blogs'].some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const bagActive = pathname === '/cart' || pathname === '/checkout'
  const adminActive = pathname === '/admin' || pathname.startsWith('/admin/')

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <NavLink to="/" end className={({ isActive }) => `mobile-bottom-item${isActive ? ' is-active' : ''}`}>
        <House size={21} strokeWidth={1.9} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/products" className={({ isActive }) => `mobile-bottom-item${isActive ? ' is-active' : ''}`}>
        <LayoutGrid size={21} strokeWidth={1.9} />
        <span>Catalog</span>
      </NavLink>
      <NavLink to="/cart" className={() => `mobile-bottom-item${bagActive ? ' is-active' : ''}`}>
        <span className="mobile-bag-icon">
          <ShoppingBag size={21} strokeWidth={1.9} />
          {count > 0 && <span className="mobile-bag-count" aria-label={`${count} items in bag`}>{count > 99 ? '99+' : count}</span>}
        </span>
        <span>Bag</span>
      </NavLink>
      <NavLink to="/account" className={() => `mobile-bottom-item${accountActive ? ' is-active' : ''}`}>
        <UserRound size={21} strokeWidth={1.9} />
        <span>Account</span>
      </NavLink>
      {user?.role && user.role !== 'customer' && (
        <NavLink to="/admin" className={() => `mobile-bottom-item${adminActive ? ' is-active' : ''}`}>
          <ShieldCheck size={21} strokeWidth={1.9} />
          <span>Admin</span>
        </NavLink>
      )}
    </nav>
  )
}
