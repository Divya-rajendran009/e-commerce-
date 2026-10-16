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
  return <section className="wrap section admin-page"><span className="eyebrow">STORE MANAGEMENT</span><h1>Customers</h1><label className="field customer-search"><span>Search customers</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or mobile number" /></label>{error ? <ErrorState message={error} /> : visible.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Customer</th><th>Mobile</th><th>Joined</th><th>Orders</th><th>Referrals</th><th>Status</th></tr></thead><tbody>{visible.map((customer) => <tr key={customer.id}><td><strong>{customer.full_name || 'Customer'}</strong><small>{customer.email}</small></td><td>{customer.phone}</td><td>{new Date(customer.joined_at).toLocaleDateString()}</td><td>{customer.orders_count}</td><td>{customer.referrals_count}</td><td>{customer.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div> : <p className="muted">No customers found.</p>}</section>
}
