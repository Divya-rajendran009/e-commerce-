import products from '../data/demoProducts.json'
import { SHOW_CATALOGUE_PREVIEW } from './demoCatalogue'

export const DEMO_BASKET_STORAGE_KEY = 'pandiyan_demo_basket_v1'
export const DEMO_QUANTITY_LIMIT = 99
const catalogue = new Map(products.map(product => [product.id, product]))

export const isDemoShoppingPath = path => SHOW_CATALOGUE_PREVIEW && ['/', '/categories', '/demo-basket'].includes(path)
export const demoLineKey = (id, size = '') => `${id}:${size}`

// Only known demo IDs and valid variants may enter this basket. Prices and
// images always come from the catalogue, never from browser storage.
export function setDemoQuantity(items, id, size, quantity) {
  const product = catalogue.get(id)
  if (!product || !Number.isInteger(quantity)) return items
  const variant = size || ''
  if (product.sizes ? !product.sizes.includes(variant) : variant !== '') return items
  const key = demoLineKey(id, variant)
  const nextQuantity = Math.max(0, Math.min(quantity, DEMO_QUANTITY_LIMIT))
  if (!nextQuantity) return items.filter(item => demoLineKey(item.id, item.size) !== key)
  const next = { id, size: variant, quantity: nextQuantity }
  return items.some(item => demoLineKey(item.id, item.size) === key)
    ? items.map(item => demoLineKey(item.id, item.size) === key ? next : item)
    : [...items, next]
}

export function readDemoBasket(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.reduce((items, item) => item && typeof item === 'object'
      ? setDemoQuantity(items, item.id, item.size, item.quantity) : items, [])
  } catch { return [] }
}

export function demoBasketSummary(items) {
  const lines = items.map(item => ({ ...catalogue.get(item.id), ...item, key: demoLineKey(item.id, item.size) }))
  return {
    lines,
    count: lines.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: lines.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }
}
