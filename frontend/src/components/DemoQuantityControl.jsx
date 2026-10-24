import { Minus, Plus } from 'lucide-react'
import { useDemoBasket } from '../context/DemoBasketContext'
import { DEMO_QUANTITY_LIMIT, demoLineKey } from '../utils/demoBasket'

export default function DemoQuantityControl({ product, size = '' }) {
  const { lines, changeQuantity } = useDemoBasket()
  const quantity = lines.find(item => item.key === demoLineKey(product.id, size))?.quantity || 0
  const name = `${product.name}${size ? `, size ${size}` : ''}`
  if (!quantity) return <button type="button" className="demo-add" aria-label={`Add ${name} to demo basket`} onClick={() => changeQuantity(product.id, size, 1)}>ADD</button>
  return <div className="demo-stepper" role="group" aria-label={`Demo quantity for ${name}`}>
    <button type="button" aria-label={`Decrease ${name} demo quantity`} onClick={() => changeQuantity(product.id, size, -1)}><Minus size={15} aria-hidden="true" /></button>
    <span aria-live="polite" aria-atomic="true">{quantity}</span>
    <button type="button" aria-label={`Increase ${name} demo quantity`} disabled={quantity >= DEMO_QUANTITY_LIMIT} onClick={() => changeQuantity(product.id, size, 1)}><Plus size={15} aria-hidden="true" /></button>
  </div>
}
