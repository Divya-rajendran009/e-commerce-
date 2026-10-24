import products from '../data/demoProducts.json'

// Shared switch for the preview homepage and its search. Real checkout is separate.
export const SHOW_CATALOGUE_PREVIEW = true

const aliases = {
  Clothing: 'clothes fashion shirt shirts tshirt outfits wear',
  Toiletries: 'toiletry care hygiene',
  Perfumes: 'perfume fragrance fragrances gifting scent',
  Vegetables: 'vegetable produce groceries grocery',
  Dairy: 'milk ice cream groceries grocery',
  'Rice & grains': 'rice grain grains groceries grocery',
  Pantry: 'oil honey groceries grocery',
}

export function searchDemoProducts(query = '') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return products.filter(product => {
    const text = `${product.name} ${product.category_name} ${product.pack_size || ''} ${aliases[product.category_name] || ''}`.toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  })
}
