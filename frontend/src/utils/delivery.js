export function deliveryQuote(subtotal, settings = {}) {
  const amount = Number(Number(subtotal || 0).toFixed(2))
  const config = settings ?? {}
  const minimum = Number(config.minimum_order_value ?? 300)
  const fee = Number(config.delivery_fee ?? 30)
  const threshold = Number(config.free_delivery_threshold ?? 1000)
  const eligible = amount >= minimum
  const freeDelivery = eligible && amount > threshold
  const deliveryFee = !eligible || freeDelivery ? 0 : fee
  const remainingForFree = Math.max(0, (Math.round((threshold - amount) * 100) + 1) / 100)

  return {
    eligible,
    freeDelivery,
    deliveryFee,
    estimatedTotal: amount + deliveryFee,
    remainingForMinimum: Math.max(0, minimum - amount),
    remainingForFree,
  }
}
