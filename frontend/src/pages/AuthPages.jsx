import { ArrowLeft, Leaf } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { hasAdminAccess } from '../utils/adminAccess'

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { acceptSession } = useAuth()
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true)
    try { const { data } = await api.post('/auth/login/', form); acceptSession(data); navigate(hasAdminAccess(data.user) ? '/admin' : '/account') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <AuthFrame title="Welcome back" intro="Sign in to pick up where you left off."><form onSubmit={submit} className="form-stack"><Field label="Email address" type="email" required value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Field label="Password" type="password" required value={form.password} onChange={(value) => setForm({ ...form, password: value })} />{error && <div className="notice error">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form><p className="auth-switch">New to Pandiyan Store? <Link to="/register">Create an account</Link></p></AuthFrame>
}

export function Register() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm_password: '', referral_code: params.get('ref') || '', reseller_code: params.get('reseller') || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { acceptSession } = useAuth()
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true)
    try { const { data } = await api.post('/auth/register/', form); acceptSession(data); navigate('/account') }
    catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <AuthFrame title="Join our table" intro="Create your account and make everyday shopping easier."><form onSubmit={submit} className="form-stack"><Field label="Full name" required value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} /><Field label="Email address" type="email" required value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Field label="Mobile number" type="tel" required value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Field label="Password" type="password" required minLength="8" value={form.password} onChange={(value) => setForm({ ...form, password: value })} /><Field label="Confirm password" type="password" required value={form.confirm_password} onChange={(value) => setForm({ ...form, confirm_password: value })} /><Field label="Referral code (optional)" value={form.referral_code} onChange={(value) => setForm({ ...form, referral_code: value.toUpperCase() })} /><Field label="Reseller code (optional)" value={form.reseller_code} onChange={(value) => setForm({ ...form, reseller_code: value.toUpperCase() })} />{error && <div className="notice error">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button></form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></AuthFrame>
}

function Field({ label, onChange, ...props }) {
  return <label className="field"><span>{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} /></label>
}

function AuthFrame({ title, intro, children }) {
  return <section className="auth-page"><div className="auth-card"><Link to="/" className="auth-brand"><span className="brand-mark"><Leaf size={21} /></span> Pandiyan Store</Link><span className="eyebrow">FRESHNESS, EVERY DAY</span><h1>{title}</h1><p>{intro}</p>{children}<Link to="/" className="text-link auth-back"><ArrowLeft size={15} /> Back to home</Link></div></section>
}
