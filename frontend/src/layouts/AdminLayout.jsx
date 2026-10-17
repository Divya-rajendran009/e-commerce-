import { ArrowUpRight, Boxes, ClipboardList, CreditCard, Gift, Headset, LayoutDashboard, LogOut, Megaphone, PackageCheck, RotateCcw, ShieldCheck, Store, Users, Wallet } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canAccessAdminModule } from '../utils/adminAccess'

const navigation = [
  [LayoutDashboard, 'Overview', '/admin', null, true],
  [Boxes, 'Products & categories', '/admin/products', 'products'],
  [PackageCheck, 'Inventory', '/admin/services/inventory', 'inventory'],
  [ClipboardList, 'Orders', '/admin/orders', 'orders'],
  [Users, 'Customers', '/admin/customers', 'customers'],
  [PackageCheck, 'Delivery', '/admin/services/delivery', 'delivery'],
  [Headset, 'Support & returns', '/admin/services/support', 'support'],
  [Megaphone, 'Promotions', '/admin/services/promotions', 'promotions'],
  [Gift, 'Referrals & rewards', '/admin/referrals', 'referrals'],
  [Wallet, 'Reseller commissions', '/admin/services/commissions', 'reseller-finance'],
  [CreditCard, 'Payments & refunds', '/admin/services/payments', 'payments'],
  [RotateCcw, 'Refunds', '/admin/services/refunds', 'refunds'],
  [ShieldCheck, 'Staff & permissions', '/admin/staff', null, false, ['admin', 'super_admin']],
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = navigation.filter(([, , , module, overview, roles]) => {
    if (roles) return roles.includes(user?.role)
    return overview || canAccessAdminModule(user, module)
  })

  return <div className="admin-shell">
    <aside className="admin-shell-sidebar">
      <Link to="/admin" className="admin-shell-brand"><span className="admin-shell-mark"><Store size={21} /></span><span>Market desk<small>Store administration</small></span></Link>
      <span className="admin-shell-label">WORKSPACE</span>
      <nav className="admin-shell-nav" aria-label="Administration">
        {links.map(([Icon, label, to, , overview]) => <NavLink end={overview} to={to} key={to} className={({ isActive }) => `admin-shell-link${isActive ? ' is-active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="admin-shell-sidebar-foot"><span className="admin-avatar">{(user?.first_name || user?.email || 'A').slice(0, 1).toUpperCase()}</span><span className="admin-user"><strong>{user?.first_name || user?.email}</strong><small>{user?.role?.replaceAll('_', ' ')}</small></span></div>
    </aside>
    <div className="admin-shell-workspace">
      <header className="admin-shell-header"><span>Administration</span><div><Link to="/" className="admin-store-link"><ArrowUpRight size={16} /> View storefront</Link><button type="button" className="admin-logout" onClick={() => logout().finally(() => navigate('/login'))}><LogOut size={16} /><span>Sign out</span></button></div></header>
      <main className="admin-shell-content"><Outlet /></main>
    </div>
  </div>
}
