import { createContext, useContext, useEffect, useState } from 'react'
import { DEMO_BASKET_STORAGE_KEY, demoBasketSummary, demoLineKey, readDemoBasket, setDemoQuantity } from '../utils/demoBasket'

const DemoBasketContext = createContext(null)

function savedBasket() {
  try { return readDemoBasket(sessionStorage.getItem(DEMO_BASKET_STORAGE_KEY)) }
  catch { return [] }
}

export function DemoBasketProvider({ children }) {
  const [items, setItems] = useState(savedBasket)
  useEffect(() => {
    try { sessionStorage.setItem(DEMO_BASKET_STORAGE_KEY, JSON.stringify(items)) }
    catch { /* The preview still works if browser storage is unavailable. */ }
  }, [items])

  const changeQuantity = (id, size, delta) => setItems(current => {
    const quantity = current.find(item => demoLineKey(item.id, item.size) === demoLineKey(id, size))?.quantity || 0
    return setDemoQuantity(current, id, size, quantity + delta)
  })
  const remove = (id, size) => setItems(current => setDemoQuantity(current, id, size, 0))
  const clear = () => setItems([])

  return <DemoBasketContext.Provider value={{ ...demoBasketSummary(items), changeQuantity, remove, clear }}>
    {children}
  </DemoBasketContext.Provider>
}

export const useDemoBasket = () => useContext(DemoBasketContext)
