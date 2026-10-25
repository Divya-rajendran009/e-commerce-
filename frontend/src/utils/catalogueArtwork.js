import departments from '../data/departments.json'
import artwork from '../data/catalogueArtwork.json'

const categoryAliases = [
  [/\b(toiletries|toiletry|personal care|skin care|bath|hygiene|cleaning)\b/i, 'Toiletries'],
  [/\b(vegetables?|fruits?|fresh|produce)\b/i, 'Vegetables'],
  [/\b(dairy|milk|bread|eggs?)\b/i, 'Dairy'],
  [/\b(rice|grains?|dal|atta)\b/i, 'Rice & grains'],
  [/\b(pantry|oils?|masala|grocery|groceries|staples?)\b/i, 'Pantry'],
  [/\b(perfumes?|fragrance)\b/i, 'Perfumes'],
  [/\b(clothing|clothes|fashion|apparel|wear)\b/i, 'Clothing'],
]

export function categoryImageSource(name = '') {
  const category = departments.find(item => item.name.toLowerCase() === name.trim().toLowerCase())
  const alias = categoryAliases.find(([pattern]) => pattern.test(name))?.[1]
  return (category || departments.find(item => item.name === alias))?.image_url || null
}

const productPhotos = new Map(artwork.map(item => [item.source, item.image_url]))

// Replace only identified sample URLs. Never substitute by category or product name:
// a real product's uploaded photo must remain the source of truth.
export function productImageSource(product) {
  const source = typeof product.image_url === 'string' ? product.image_url.trim() : ''
  if (!source) return null
  try {
    const url = new URL(source)
    if (url.origin === 'https://cdn.dummyjson.com' && !url.username && !url.password) {
      return productPhotos.get(`${url.origin}${url.pathname}`) || source
    }
  } catch {
    // Relative media URLs are valid product sources too.
  }
  return source
}
