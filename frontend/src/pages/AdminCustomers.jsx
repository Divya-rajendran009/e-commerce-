import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/admin/customers/').then(({ data }) => setCustomers(data)).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false)) }, [])
  const visible = customers.filter((customer) => `${customer.email} ${customer.full_name} ${customer.phone}`.toLowerCase().includes(search.toLowerCase()))
  if (loading) return <Loading />
  return <section className="wrap section admin-page">
    <span className="eyebrow">STORE MANAGEMENT</span><h1>Customers</h1>
    <label className="field customer-search"><span>Search customers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or mobile number" /></label>
    {error ? <ErrorState message={error} /> : visible.length ? <>
      <div className="admin-table-wrap admin-customer-table"><table className="admin-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Joined</th><th>Orders</th><th>Referrals</th><th>Status</th></tr></thead><tbody>{visible.map((customer) => <tr key={customer.id}><td><strong>{customer.full_name || 'Customer'}</strong><small>{customer.email}</small></td><td>{customer.phone}</td><td>{new Date(customer.joined_at).toLocaleDateString()}</td><td>{customer.orders_count}</td><td>{customer.referrals_count}</td><td><span className={`status status-${customer.is_active ? 'delivered' : 'cancelled'}`}>{customer.is_active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div>
      <div className="admin-customer-cards">{visible.map((customer) => <article className="admin-customer-card" key={customer.id}>
        <span className="admin-customer-avatar">{(customer.full_name || customer.email || 'C').slice(0, 1).toUpperCase()}</span>
        <div className="admin-customer-identity"><strong>{customer.full_name || 'Customer'}</strong><small>{customer.email}</small><small>{customer.phone}</small></div>
        <span className={`status status-${customer.is_active ? 'delivered' : 'cancelled'}`}>{customer.is_active ? 'Active' : 'Inactive'}</span>
        <div className="admin-customer-stats"><span>{customer.orders_count} orders</span><span>{customer.referrals_count} referrals</span><span>Joined {new Date(customer.joined_at).toLocaleDateString()}</span></div>
      </article>)}</div>
    </> : <p className="muted">No customers found.</p>}
  </section>
}
