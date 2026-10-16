import { createContext, useContext, useMemo, useState } from 'react'

const CartContext = createContext(null)
const savedCart = () => {
  try { return JSON.parse(localStorage.getItem('sm_cart')) || [] } catch { return [] }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(savedCart)
  const update = (next) => {
    setItems(next)
    localStorage.setItem('sm_cart', JSON.stringify(next))
  }
  const add = (product, quantity = 1) => {
    const found = items.find((item) => item.id === product.id)
    update(found ? items.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + quantity, 99) } : item) : [...items, { ...product, quantity }])
  }
  const setQuantity = (id, quantity) => update(quantity < 1 ? items.filter((item) => item.id !== id) : items.map((item) => item.id === id ? { ...item, quantity: Math.min(quantity, 99) } : item))
  const remove = (id) => update(items.filter((item) => item.id !== id))
  const clear = () => update([])
  const count = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  const value = useMemo(() => ({ items, add, setQuantity, remove, clear, count, subtotal }), [items, count, subtotal])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
