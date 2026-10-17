import { Navigate, Route, Routes } from 'react-router-dom'
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
import { hasAdminAccess } from './utils/adminAccess'

function Guard({ admin = false, children }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="state-card">Loading your account…</div>
  if (!user) return <Navigate to="/login" replace />
  if (admin && !hasAdminAccess(user)) return <Navigate to="/" replace />
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
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
  <Route path="admin" element={<Guard admin><AdminLayout /></Guard>}>
    <Route index element={<Admin />} />
    <Route path="orders" element={<AdminOrders />} />
    <Route path="products" element={<AdminProducts />} />
    <Route path="categories" element={<AdminProducts />} />
    <Route path="customers" element={<AdminCustomers />} />
    <Route path="staff" element={<AdminStaff />} />
    <Route path="referrals" element={<AdminReferrals />} />
    <Route path="referrals/network/:customerId" element={<AdminReferralNetwork />} />
    <Route path="services" element={<AdminServices />} />
    <Route path="services/:module" element={<AdminServices />} />
  </Route>
  </Routes>
}
