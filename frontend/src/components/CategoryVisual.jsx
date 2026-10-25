import { ShoppingBag } from 'lucide-react'
import departments from '../data/departments.json'

const matches = [
  [/vegetable|fruit|fresh|produce/i, 'Vegetables'],
  [/dairy|milk|bread|egg/i, 'Dairy'],
  [/rice|grain|dal|atta/i, 'Rice & grains'],
  [/pantry|oil|masala|grocery|groceries|staple/i, 'Pantry'],
  [/toiletr|care|bath|hygiene|clean/i, 'Toiletries'],
  [/perfume|fragrance/i, 'Perfumes'],
  [/cloth|fashion|apparel|wear/i, 'Clothing'],
]

export default function CategoryVisual({ name = '', image }) {
  const match = matches.find(([pattern]) => pattern.test(name))
  const source = image || departments.find(item => item.name === match?.[1])?.image_url
  return <span className="category-visual">{source ? <img src={source} alt="" width="88" height="88" loading="lazy" /> : <ShoppingBag size={29} aria-hidden="true" />}</span>
}
