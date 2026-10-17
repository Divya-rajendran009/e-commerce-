import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

const next = { pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['packed', 'cancelled'], packed: ['out_for_delivery', 'cancelled'], out_for_delivery: ['delivered'], delivered: [], cancelled: [] }
export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ count: 0, next: null, previous: null })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const load = (pageNumber = page, nextFilters = filters) => {
    setLoading(true)
    setError('')
    return api.get('/admin/orders/', { params: { page: pageNumber, ...nextFilters } })
      .then(({ data }) => {
        setOrders(data.results || data)
        setPagination({ count: data.count ?? data.length, next: data.next ?? null, previous: data.previous ?? null })
        setPage(pageNumber)
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(1, filters) }, [])
  const change = async (order, status) => {
    try { await api.patch(`/admin/orders/${order.id}/`, { status }); await load(page, filters) } catch (e) { setError(errorMessage(e)) }
  }
  if (loading) return <Loading />
  const applyFilters = (event) => {
    event.preventDefault()
    const nextFilters = { ...filters, search: searchInput }
    setFilters(nextFilters)
    load(1, nextFilters)
  }
  return <section className="wrap section admin-page admin-orders-page">
    <span className="eyebrow">STORE MANAGEMENT</span><h1>Orders</h1>
    <form className="admin-list-filters" onSubmit={applyFilters}>
      <label className="field"><span>Search orders</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Order number or customer" /></label>
      <label className="field"><span>Status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{Object.keys(next).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
      <button className="button primary">Apply filters</button>
    </form>
    {error && <ErrorState message={error} />}
    {orders.length ? <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}>
      <div className="order-card-head"><div><strong>{order.order_number}</strong><small>{order.customer_name} · {order.phone}</small></div><span className={`status status-${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div>
      <p>{order.address}</p>
      <div className="order-card-foot"><strong>₹{Number(order.total).toFixed(2)} · {order.payment_method?.toUpperCase() || 'COD'}</strong><label className="admin-status">Update status<select value={order.status} onChange={(event) => change(order, event.target.value)}><option value={order.status}>{order.status.replaceAll('_', ' ')}</option>{next[order.status].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label></div>
    </article>)}</div> : <p className="muted">No orders match these filters.</p>}
    <div className="admin-pagination"><span>{pagination.count} orders · page {page}</span><div><button type="button" className="button secondary small" disabled={!pagination.previous} onClick={() => load(page - 1)}>Previous</button><button type="button" className="button secondary small" disabled={!pagination.next} onClick={() => load(page + 1)}>Next</button></div></div>
  </section>
}
