import { describe, expect, it } from 'vitest'
import { deliveryQuote } from './delivery'

describe('deliveryQuote', () => {
  it.each([
    [299, 0, false],
    [300, 30, false],
    [800, 30, false],
    [999, 30, false],
    [1000, 30, false],
    [1001, 0, true],
  ])('calculates delivery for subtotal ₹%s', (subtotal, fee, freeDelivery) => {
    const quote = deliveryQuote(subtotal)
    expect(quote.deliveryFee).toBe(fee)
    expect(quote.freeDelivery).toBe(freeDelivery)
  })

  it('reports the amount needed to reach minimum and strictly exceed the free-delivery threshold', () => {
    expect(deliveryQuote(299).remainingForMinimum).toBe(1)
    expect(deliveryQuote(999).remainingForFree).toBe(1.01)
    expect(deliveryQuote(1000).remainingForFree).toBe(0.01)
    expect(deliveryQuote(1001).remainingForFree).toBe(0)
  })

  it('uses defaults while delivery settings are not yet loaded', () => {
    expect(deliveryQuote(800, null)).toMatchObject({
      eligible: true,
      freeDelivery: false,
      deliveryFee: 30,
      estimatedTotal: 830,
    })
  })
})
