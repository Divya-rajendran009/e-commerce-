const ADMIN_ROLE_MODULES = {
  admin: ['*'],
  super_admin: ['*'],
  product_manager: ['products'],
  inventory_manager: ['products', 'inventory'],
  order_manager: ['orders', 'delivery'],
  customer_support: ['customers', 'support', 'returns'],
  marketing_manager: ['blogs', 'referrals', 'coupons', 'promotions'],
  finance_manager: ['payments', 'refunds', 'reports', 'reseller-finance'],
}

export function hasAdminAccess(user) {
  return Boolean(user?.role && Object.hasOwn(ADMIN_ROLE_MODULES, user.role))
}

export function canAccessAdminModule(user, module) {
  if (!hasAdminAccess(user)) return false
  const modules = ADMIN_ROLE_MODULES[user?.role]
  return Boolean(modules && (modules.includes('*') || modules.includes(module)))
}
