import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { readSavedCart } from '../utils/cart'

const CartContext = createContext(null)
const savedCart = () => {
  try { return readSavedCart(localStorage.getItem('sm_cart')) } catch { return [] }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(savedCart)
  const update = (next) => {
    setItems(next)
    localStorage.setItem('sm_cart', JSON.stringify(next))
  }
  const syncProduct = useCallback((product) => {
    setItems((current) => {
      const next = current.map((item) => item.id === product.id ? { ...item, ...product, quantity: item.quantity } : item)
      localStorage.setItem('sm_cart', JSON.stringify(next))
      return next
    })
  }, [])
  const add = (product, quantity = 1) => {
    const found = items.find((item) => item.id === product.id)
    const availableStock = Number.isInteger(product.stock) ? product.stock : 99
    update(found
      ? items.map((item) => item.id === product.id ? { ...item, ...product, quantity: Math.min(item.quantity + quantity, availableStock, 99) } : item)
      : [...items, { ...product, quantity: Math.min(quantity, availableStock, 99) }])
  }
  const setQuantity = (id, quantity) => update(quantity < 1
    ? items.filter((item) => item.id !== id)
    : items.map((item) => item.id === id ? { ...item, quantity: Math.min(quantity, item.stock ?? 99, 99) } : item))
  const remove = (id) => update(items.filter((item) => item.id !== id))
  const clear = () => update([])
  const count = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const value = useMemo(() => ({ items, add, setQuantity, remove, clear, count, subtotal, syncProduct }), [items, count, subtotal, syncProduct])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
