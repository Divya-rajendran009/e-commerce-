import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

export default function AdminReferrals() {
  const [settings, setSettings] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    Promise.all([api.get('/admin/referral-settings/'), api.get('/admin/referrals/')]).then(([s, r]) => { setSettings(s.data); setReferrals(r.data) }).catch((e) => setError(errorMessage(e)))
  }, [])
  const save = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    try { const { data } = await api.patch('/admin/referral-settings/', settings); setSettings(data); setMessage('Referral settings saved.') }
    catch (e) { setError(errorMessage(e)) }
  }
  if (error && !settings) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!settings) return <Loading />
  return <section className="wrap section admin-page"><span className="eyebrow">STORE MANAGEMENT</span><h1>Referral program</h1>{error && <ErrorState message={error} />}{message && <div className="notice success">{message}</div>}<div className="admin-edit-grid"><form className="checkout-form" onSubmit={save}><h2>Program settings</h2><label className="check-field"><input type="checkbox" checked={settings.active} onChange={(e) => setSettings({ ...settings, active: e.target.checked })} /> Program active</label><label className="field"><span>Reward type</span><select value={settings.reward_type} onChange={(e) => setSettings({ ...settings, reward_type: e.target.value })}><option value="wallet">Wallet credit</option></select></label><label className="field"><span>Referrer reward (₹)</span><input required type="number" min="0" step="0.01" value={settings.referrer_reward} onChange={(e) => setSettings({ ...settings, referrer_reward: e.target.value })} /></label><label className="field"><span>New customer reward (₹)</span><input required type="number" min="0" step="0.01" value={settings.customer_reward} onChange={(e) => setSettings({ ...settings, customer_reward: e.target.value })} /></label><label className="field"><span>Minimum qualifying order (₹)</span><input required type="number" min="0" step="0.01" value={settings.minimum_order_amount} onChange={(e) => setSettings({ ...settings, minimum_order_amount: e.target.value })} /></label><label className="field"><span>Maximum reward per person (₹, optional)</span><input type="number" min="0" step="0.01" value={settings.max_reward_per_referral || ''} onChange={(e) => setSettings({ ...settings, max_reward_per_referral: e.target.value || null })} /></label><button className="button primary">Save settings</button></form><div><h2>Referral activity</h2>{referrals.length ? <div className="orders-list">{referrals.map((ref) => <article className="order-card" key={ref.id}><div className="order-card-head"><div><strong>{ref.referred_email}</strong><small>Invited by {ref.referrer_email}</small></div><span className={`status status-${ref.status}`}>{ref.status}</span></div>{ref.order_number && <small>Order {ref.order_number}</small>}{ref.rewards.map((reward) => <div className="summary-line" key={reward.id}><span>{reward.recipient_type} wallet reward</span><strong>₹{Number(reward.amount).toFixed(2)}</strong></div>)}</article>)}</div> : <p className="muted">No referral activity yet.</p>}</div></div></section>
}
