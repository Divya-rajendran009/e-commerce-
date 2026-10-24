export const storeThemes = {
  All: { key: 'diwali', title: 'Festival of deals', subtitle: 'The Diwali edit', ink: '#fff8df', background: '#850d19', panel: '#fff7df' },
  Diwali: { key: 'festive', title: 'Bring home the celebration', subtitle: 'Ready for Diwali', ink: '#fff0ce', background: '#870c48', panel: '#fff2dc' },
  Clothing: { key: 'clothing', title: 'Dress for the occasion', subtitle: 'Your festive wardrobe', ink: '#fff5df', background: '#183944', panel: '#eef4ef' },
  Toiletries: { key: 'care', title: 'Your everyday care', subtitle: 'Small rituals. A little care.', ink: '#552348', background: '#f9e2ec', panel: '#fff5f9' },
  Perfumes: { key: 'fragrance', title: 'Find your signature', subtitle: 'The fragrance edit', ink: '#fff2dd', background: '#35223e', panel: '#f7edf7' },
  Vegetables: { key: 'fresh', title: 'Fresh picks for your home', subtitle: 'From the produce aisle', ink: '#194c36', background: '#dcebd3', panel: '#f6faef' },
  Dairy: { key: 'dairy', title: 'Everyday goodness', subtitle: 'Milk & more', ink: '#184753', background: '#d9f0f2', panel: '#f4fcfd' },
  'Rice & grains': { key: 'grains', title: 'Stock up on the essentials', subtitle: 'For the family pantry', ink: '#654a23', background: '#f0e4ce', panel: '#fffaf0' },
  Pantry: { key: 'pantry', title: 'A well-stocked home', subtitle: 'The pantry edit', ink: '#603c28', background: '#edddcb', panel: '#fff8ef' },
}

export function resolveDepartment(value) {
  return Object.hasOwn(storeThemes, value) ? value : 'All'
}

export function departmentUrl(name) {
  return name === 'All' ? '/' : `/?department=${encodeURIComponent(name)}`
}
