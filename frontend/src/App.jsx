import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'
import StoreLayout from './layouts/StoreLayout'
import AdminLayout from './layouts/AdminLayout'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Referral from './pages/Referral'
import Account from './pages/Account'
import Admin from './pages/Admin'
import AdminOrders from './pages/AdminOrders'
import AdminProducts from './pages/AdminProducts'
import AdminReferrals from './pages/AdminReferrals'
import AdminReferralNetwork from './pages/AdminReferralNetwork'
import AdminCustomers from './pages/AdminCustomers'
import AdminStaff from './pages/AdminStaff'
import AccountServices from './pages/AccountServices'
import AdminServices from './pages/AdminServices'
import { Login, Register } from './pages/AuthPages'
import { canAccessAdminModule, hasAdminAccess } from './utils/adminAccess'

const PolicyPage = lazy(() => import('./pages/PolicyPage'))

function Guard({ admin = false, adminModule, adminRoles, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="state-card">Loading your account…</div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && !hasAdminAccess(user)) return <Navigate to="/" replace />
  if (adminModule && !canAccessAdminModule(user, adminModule)) return <Navigate to="/admin" replace />
  if (adminRoles && !adminRoles.includes(user?.role)) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return <Routes><Route element={<StoreLayout />}>
    <Route index element={<Home />} />
    <Route path="products" element={<Products />} />
    <Route path="products/:id" element={<ProductDetail />} />
    <Route path="cart" element={<Cart />} />
    <Route path="delivery-info" element={<Navigate to="/delivery-policy" replace />} />
    <Route path="terms-and-conditions" element={<Suspense fallback={<div className="state-card">Loading policy…</div>}><PolicyPage policy="terms" /></Suspense>} />
    <Route path="privacy-policy" element={<Suspense fallback={<div className="state-card">Loading policy…</div>}><PolicyPage policy="privacy" /></Suspense>} />
    <Route path="delivery-policy" element={<Suspense fallback={<div className="state-card">Loading policy…</div>}><PolicyPage policy="delivery" /></Suspense>} />
    <Route path="return-refund-policy" element={<Suspense fallback={<div className="state-card">Loading policy…</div>}><PolicyPage policy="returns" /></Suspense>} />
    <Route path="ugc-policy" element={<Suspense fallback={<div className="state-card">Loading policy…</div>}><PolicyPage policy="ugc" /></Suspense>} />
    <Route path="checkout" element={<Guard><Checkout /></Guard>} />
    <Route path="login" element={<Login />} />
    <Route path="register" element={<Register />} />
    <Route path="account" element={<Guard><Account /></Guard>} />
    <Route path="account/:section" element={<Guard><AccountServices /></Guard>} />
    <Route path="blogs" element={<AccountServices />} />
    <Route path="blogs/:slug" element={<AccountServices />} />
    <Route path="orders" element={<Guard><Orders /></Guard>} />
    <Route path="orders/:id" element={<Guard><OrderDetail /></Guard>} />
    <Route path="referrals" element={<Referral />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
  <Route path="admin" element={<Guard admin><AdminLayout /></Guard>}>
    <Route index element={<Admin />} />
    <Route path="orders" element={<Guard adminModule="orders"><AdminOrders /></Guard>} />
    <Route path="products" element={<Guard adminModule="products"><AdminProducts /></Guard>} />
    <Route path="categories" element={<Guard adminModule="products"><AdminProducts /></Guard>} />
    <Route path="customers" element={<Guard adminModule="customers"><AdminCustomers /></Guard>} />
    <Route path="staff" element={<Guard adminRoles={['admin', 'super_admin']}><AdminStaff /></Guard>} />
    <Route path="referrals" element={<Guard adminModule="referrals"><AdminReferrals /></Guard>} />
    <Route path="referrals/network/:customerId" element={<Guard adminModule="referrals"><AdminReferralNetwork /></Guard>} />
    <Route path="services" element={<AdminServices />} />
    <Route path="services/:module" element={<AdminServices />} />
  </Route>
  </Routes>
}
