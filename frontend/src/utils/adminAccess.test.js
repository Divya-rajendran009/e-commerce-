import { describe, expect, it } from 'vitest'
import { canAccessAdminModule, hasAdminAccess } from './adminAccess'

describe('admin access', () => {
  it('allows only recognized staff roles into the admin workspace', () => {
    expect(hasAdminAccess({ role: 'admin' })).toBe(true)
    expect(hasAdminAccess({ role: 'inventory_manager' })).toBe(true)
    expect(hasAdminAccess({ role: 'customer' })).toBe(false)
    expect(hasAdminAccess({ role: 'toString' })).toBe(false)
    expect(hasAdminAccess(null)).toBe(false)
  })

  it('limits staff navigation to their assigned modules', () => {
    expect(canAccessAdminModule({ role: 'inventory_manager' }, 'inventory')).toBe(true)
    expect(canAccessAdminModule({ role: 'inventory_manager' }, 'orders')).toBe(false)
    expect(canAccessAdminModule({ role: 'admin' }, 'orders')).toBe(true)
  })
})
