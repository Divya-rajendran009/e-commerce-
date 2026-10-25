export const orderLabels = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  processing: 'Preparing',
  packed: 'Packed',
  picked_up: 'Picked up',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}
export const orderStages = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'picked_up',
  'out_for_delivery',
  'delivered'
]
export const customerCancelable = ['pending', 'confirmed', 'processing', 'packed', 'picked_up']
export const orderDate = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Not scheduled'
export const orderMoney = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const historyLabel = (event) =>
  event.kind === 'reopened'
    ? 'Cancellation reversed · Order placed'
    : event.kind === 'recorded'
      ? `${orderLabels[event.status]} · Existing status recorded`
      : event.kind === 'customer_cancelled'
        ? 'Cancelled by customer'
        : orderLabels[event.status] || event.status
