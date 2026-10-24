import { describe, expect, it } from 'vitest'
import { normalizeCart, readSavedCart } from './cart'

describe('saved cart normalization', () => {
  it('returns an empty cart for malformed or unexpected stored values', () => {
    expect(readSavedCart('{bad json')).toEqual([])
    expect(readSavedCart('{"id": 1}')).toEqual([])
    expect(readSavedCart('null')).toEqual([])
  })

  it('drops invalid entries and normalizes usable persisted items', () => {
    expect(normalizeCart([
      { id: 3, name: 'Rice', price: '120.5', quantity: '2', stock: '5' },
      { id: 4, price: 'not-a-price', quantity: 1 },
      { id: 5, price: '10', quantity: 0 },
      null,
    ])).toEqual([
      { id: 3, name: 'Rice', price: 120.5, quantity: 2, stock: 5 },
    ])
  })

  it('caps persisted quantities at the cart limit', () => {
    expect(normalizeCart([{ id: 1, price: 10, quantity: 120 }])[0].quantity).toBe(99)
  })
})
