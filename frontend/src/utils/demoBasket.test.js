import { describe, expect, it } from 'vitest'
import { demoBasketSummary, readDemoBasket, setDemoQuantity, isDemoShoppingPath } from './demoBasket'

describe('isolated demo basket', () => {
  it('keeps clothing variants separate and calculates totals by quantity', () => {
    let items = setDemoQuantity([], 'demo-83', 'M', 2)
    items = setDemoQuantity(items, 'demo-83', 'L', 1)
    items = setDemoQuantity(items, 'demo-118', '', 3)
    expect(demoBasketSummary(items)).toMatchObject({count:6, subtotal:699 * 3 + 199 * 3})
    expect(demoBasketSummary(items).lines).toHaveLength(3)
    items = setDemoQuantity(items, 'demo-83', 'M', 0)
    expect(items).toEqual([{id:'demo-83',size:'L',quantity:1},{id:'demo-118',size:'',quantity:3}])
  })
  it('rejects live IDs, invalid sizes and invalid quantities', () => {
    expect(setDemoQuantity([], 83, '', 1)).toEqual([])
    expect(setDemoQuantity([], 'demo-83', 'XXXL', 1)).toEqual([])
    expect(setDemoQuantity([], 'demo-83', '', 1)).toEqual([])
    expect(setDemoQuantity([], 'demo-118', 'L', 1)).toEqual([])
    expect(setDemoQuantity([], 'demo-118', '', 1.5)).toEqual([])
    expect(setDemoQuantity([], 'demo-118', '', NaN)).toEqual([])
    expect(setDemoQuantity([], 'demo-118', '', 100)[0].quantity).toBe(99)
  })
  it('restores only validated selections, ignoring stored prices and duplicates', () => {
    expect(readDemoBasket('bad JSON')).toEqual([])
    expect(readDemoBasket('{}')).toEqual([])
    const restored = readDemoBasket(JSON.stringify([null,{id:1,quantity:2},{id:'demo-118',quantity:2,price:1},{id:'demo-118',quantity:4,price:0}]))
    expect(restored).toEqual([{id:'demo-118',size:'',quantity:4}])
    expect(demoBasketSummary(restored).subtotal).toBe(199 * 4)
  })
  it('never substitutes a demo basket on real product or checkout routes', () => {
    expect(isDemoShoppingPath('/')).toBe(true)
    expect(isDemoShoppingPath('/demo-basket')).toBe(true)
    expect(isDemoShoppingPath('/categories')).toBe(true)
    expect(isDemoShoppingPath('/products')).toBe(false)
    expect(isDemoShoppingPath('/cart')).toBe(false)
    expect(isDemoShoppingPath('/checkout')).toBe(false)
  })
})
