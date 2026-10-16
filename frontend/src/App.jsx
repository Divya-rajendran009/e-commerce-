import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import StoreLayout from './layouts/StoreLayout'
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
import AdminCustomers from './pages/AdminCustomers'
import AdminStaff from './pages/AdminStaff'
import AccountServices from './pages/AccountServices'
import AdminServices from './pages/AdminServices'
import { Login, Register } from './pages/AuthPages'

function Guard({ admin = false, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="state-card">Loading your account…</div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && (!user.role || user.role === 'customer')) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return <Routes><Route element={<StoreLayout />}>
    <Route index element={<Home />} />
    <Route path="products" element={<Products />} />
    <Route path="products/:id" element={<ProductDetail />} />
    <Route path="cart" element={<Cart />} />
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
    <Route path="admin" element={<Guard admin><Admin /></Guard>} />
    <Route path="admin/orders" element={<Guard admin><AdminOrders /></Guard>} />
    <Route path="admin/products" element={<Guard admin><AdminProducts /></Guard>} />
    <Route path="admin/categories" element={<Guard admin><AdminProducts /></Guard>} />
    <Route path="admin/customers" element={<Guard admin><AdminCustomers /></Guard>} />
    <Route path="admin/staff" element={<Guard admin><AdminStaff /></Guard>} />
    <Route path="admin/referrals" element={<Guard admin><AdminReferrals /></Guard>} />
    <Route path="admin/services" element={<Guard admin><AdminServices /></Guard>} />
    <Route path="admin/services/:module" element={<Guard admin><AdminServices /></Guard>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>
}
