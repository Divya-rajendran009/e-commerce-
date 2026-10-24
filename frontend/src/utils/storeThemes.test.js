import { describe, expect, it } from 'vitest'
import { departmentUrl, resolveDepartment, storeThemes } from './storeThemes'
import departments from '../data/departments.json'

describe('department navigation', () => {
  it('resolves a distinct theme for each permanent category', () => {
    const themes = departments.map(({ name }) => storeThemes[resolveDepartment(name)].key)
    expect(new Set(themes).size).toBe(departments.length)
  })
  it('uses Diwali for the home page and safely falls back for invalid routes', () => {
    expect(storeThemes[resolveDepartment(null)].key).toBe('diwali')
    expect(resolveDepartment('unknown')).toBe('All')
    expect(resolveDepartment('__proto__')).toBe('All')
  })
  it('preserves category names through URL encoding', () => {
    const url = new URL(departmentUrl('Rice & grains'), 'http://localhost')
    expect(resolveDepartment(url.searchParams.get('department'))).toBe('Rice & grains')
    expect(departmentUrl('All')).toBe('/')
  })
})
