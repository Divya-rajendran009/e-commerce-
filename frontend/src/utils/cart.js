export function normalizeCart(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || item.id == null) return []
    const price = Number(item.price)
    const quantity = Number(item.quantity)
    const stock = item.stock == null ? null : Number(item.stock)
    if (!Number.isFinite(price) || !Number.isInteger(quantity) || quantity < 1) return []
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return []
    return [{
      ...item,
      price,
      quantity: Math.min(quantity, 99),
      ...(stock === null ? {} : { stock }),
    }]
  })
}

export function readSavedCart(storageValue) {
  try {
    return normalizeCart(JSON.parse(storageValue || '[]'))
  } catch {
    return []
  }
}
