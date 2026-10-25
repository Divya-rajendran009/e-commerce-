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

const categoryPhotos = {
  Vegetables: { image: 'fresh-picks.webp', position: '88% center' },
  Pantry: { image: 'pantry-essentials.webp', position: '86% center' },
  'Rice & grains': { image: 'pantry-essentials.webp', position: '74% 82%' },
  Toiletries: { image: 'everyday-care.webp', position: '88% center' },
}

export default function CategoryVisual({ name = '', image }) {
  const match = matches.find(([pattern]) => pattern.test(name))
  const photo = !image && categoryPhotos[match?.[1]]
  const source = image || (photo ? `/images/storefront/${photo.image}` : departments.find(item => item.name === match?.[1])?.image_url)
  return <span className={`category-visual${photo ? ' category-visual-photo' : ''}`}>{source ? <img src={source} alt="" width="108" height="102" loading="lazy" decoding="async" style={photo ? { objectPosition: photo.position } : undefined} /> : <ShoppingBag size={29} aria-hidden="true" />}</span>
}
