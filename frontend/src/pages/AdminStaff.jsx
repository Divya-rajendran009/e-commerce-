import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

const staffRoles = ['admin', 'super_admin', 'product_manager', 'order_manager', 'inventory_manager', 'customer_support', 'marketing_manager', 'finance_manager']

export default function AdminStaff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newRole, setNewRole] = useState('product_manager')
  const load = () => api.get('/admin/staff/').then(({ data }) => setStaff(Array.isArray(data) ? data : data.results || [])).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const createStaff = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setMessage('')
    setBusy(true)
    const payload = Object.fromEntries(new FormData(event.currentTarget))
    payload.grant_referral_settings = payload.grant_referral_settings === 'true'
    try {
      await api.post('/admin/staff/', payload)
      form.reset()
      setMessage('Staff account created.')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const updateStaff = async (member, changes) => {
    setError('')
    try {
      await api.patch(`/admin/staff/${member.id}/`, changes)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return <section className="wrap section admin-page">
    <Link to="/admin" className="text-link">← Admin dashboard</Link>
    <span className="eyebrow">ACCESS CONTROL</span><h1>Staff & permissions</h1>
    <p>Staff roles are enforced by the API. A super admin is required to grant the super admin role.</p>
    {error && <ErrorState message={error} />}{message && <p className="notice success" role="status">{message}</p>}
    <form className="account-service-form service-form-grid admin-staff-form" onSubmit={createStaff}>
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
      <label className="field"><span>First name</span><input name="first_name" required autoComplete="given-name" /></label>
      <label className="field"><span>Last name</span><input name="last_name" autoComplete="family-name" /></label>
      <label className="field"><span>Phone</span><input name="phone" required type="tel" autoComplete="tel" /></label>
      <label className="field"><span>Role</span><select name="role" value={newRole} onChange={(event) => setNewRole(event.target.value)}>{staffRoles.map((role) => <option value={role} key={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
      {newRole === 'marketing_manager' && <label className="check-field"><input type="checkbox" name="grant_referral_settings" value="true" /> Allow managing referral settings</label>}
      <label className="field"><span>Temporary password</span><input name="password" type="password" minLength="12" required autoComplete="new-password" /></label>
      <button className="button primary" disabled={busy}>{busy ? 'Creating…' : 'Create staff account'}</button>
    </form>
    <h2>Current staff</h2>
    {loading ? <Loading /> : <div className="service-record-list">{staff.map((member) => <article className="service-record admin-service-record" key={member.id}>
      <div className="admin-service-record-main"><h2>{member.full_name || member.email}</h2><p>{member.email} · {member.phone}</p><span className="status">{member.role.replaceAll('_', ' ')}</span></div>
      <div className="admin-service-controls">
        <label className="field"><span>Role</span><select value={member.role} onChange={(event) => updateStaff(member, { role: event.target.value })}>{staffRoles.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
        {member.role === 'marketing_manager' && <label className="check-field"><input type="checkbox" checked={member.can_manage_referral_settings} onChange={(event) => updateStaff(member, { grant_referral_settings: event.target.checked })} /> Allow managing referral settings</label>}
        <button className={`button ${member.is_active ? 'secondary' : 'primary'}`} onClick={() => updateStaff(member, { is_active: !member.is_active })}>{member.is_active ? 'Deactivate' : 'Reactivate'}</button>
      </div>
    </article>)}</div>}
  </section>
}
