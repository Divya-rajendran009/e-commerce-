import { describe, expect, it } from 'vitest'
import { searchDemoProducts } from './demoCatalogue'

describe('preview catalogue search', () => {
  it('finds perfume and clothing by common department words', () => {
    expect(searchDemoProducts(' perfume ').map(p => p.category_name)).toEqual(['Perfumes', 'Perfumes', 'Perfumes'])
    expect(searchDemoProducts('clothes')).toHaveLength(3)
  })
  it('matches multiple words without case sensitivity', () => {
    expect(searchDemoProducts('BODY WASH').map(p => p.id)).toEqual(['demo-119'])
  })
  it('returns no unrelated results and restores the full list for blank queries', () => {
    expect(searchDemoProducts('spaceship')).toHaveLength(0)
    expect(searchDemoProducts('  ')).toHaveLength(18)
  })
})
