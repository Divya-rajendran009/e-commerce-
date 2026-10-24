import { House, LayoutGrid, ShoppingBag, UserRound } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useDemoBasket } from '../context/DemoBasketContext'
import { isDemoShoppingPath } from '../utils/demoBasket'

export default function MobileBottomNavigation() {
  const cart = useCart()
  const demoBasket = useDemoBasket()
  const { pathname } = useLocation()
  const demo = isDemoShoppingPath(pathname)
  const { count } = demo ? demoBasket : cart

  const accountActive = ['/account', '/wallet', '/orders', '/referrals', '/login', '/register', '/blogs'].some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const bagActive = pathname === '/cart' || pathname === '/checkout' || pathname === '/demo-basket'

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <NavLink to="/" end className={({ isActive }) => `mobile-bottom-item${isActive ? ' is-active' : ''}`}>
        <House size={21} strokeWidth={1.9} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/categories" className={({ isActive }) => `mobile-bottom-item${isActive ? ' is-active' : ''}`}>
        <LayoutGrid size={21} strokeWidth={1.9} />
        <span>Categories</span>
      </NavLink>
      <NavLink to={demo ? '/demo-basket' : '/cart'} className={() => `mobile-bottom-item${bagActive ? ' is-active' : ''}`}>
        <span className="mobile-bag-icon">
          <ShoppingBag size={21} strokeWidth={1.9} />
          {count > 0 && <span className="mobile-bag-count" aria-label={`${count} items in bag`}>{count > 99 ? '99+' : count}</span>}
        </span>
        <span>{demo ? 'Demo bag' : 'Bag'}</span>
      </NavLink>
      <NavLink to="/account" className={() => `mobile-bottom-item${accountActive ? ' is-active' : ''}`}>
        <UserRound size={21} strokeWidth={1.9} />
        <span>Account</span>
      </NavLink>
    </nav>
  )
}
