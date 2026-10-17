import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, Loading } from '../components/Shared'
import api, { errorMessage } from '../services/api'

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`
}

export default function AdminReferralNetwork() {
  const { customerId } = useParams()
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/admin/referrals/network/${customerId}/`)
      .then(({ data }) => setNetwork(data))
      .catch((exception) => setError(errorMessage(exception)))
  }, [customerId])

  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!network) return <Loading label="Loading customer referral network…" />

  const { customer } = network
  return <section className="wrap section admin-page referral-customer-detail">
    <Link to="/admin/referrals" className="text-link">← Referral network</Link>
    <span className="eyebrow">CUSTOMER NETWORK DETAIL</span>
    <h1>{customer.full_name || 'Customer'}</h1>
    <p>{customer.email} · {customer.phone} · Referral code <strong>{customer.referral_code}</strong></p>
    <div className="referral-admin-metrics">
      <article><span>Account status</span><strong>{customer.is_active ? 'Active' : 'Inactive'}</strong></article>
      <article><span>Joined</span><strong>{new Date(customer.date_joined).toLocaleDateString()}</strong></article>
      <article><span>Direct referrer</span><strong>{network.direct_referrer?.email || 'None'}</strong></article>
      <article><span>Wallet balance</span><strong>{money(network.wallet_balance)}</strong></article>
      <article><span>Direct referrals</span><strong>{network.direct_referral_count}</strong></article>
    </div>

    <h2>Downline by level</h2>
    <div className="referral-level-summary">{network.level_counts.map(({ level, count }) => <article key={level}><span>Level {level}</span><strong>{count}</strong></article>)}</div>
    <h2>Direct referrals</h2>
    {network.direct_referrals.length ? <div className="referral-directory">{network.direct_referrals.map((member) => <article className="referral-directory-row" key={member.id}>
      <span className="referral-directory-avatar">{(member.full_name || member.email).slice(0, 1).toUpperCase()}</span>
      <span className="referral-directory-customer"><strong>{member.full_name || 'Customer'}</strong><small>{member.email} · {member.referral_code}</small></span>
      <span className={`status status-${member.status}`}>{member.status}</span>
      <Link className="button secondary small" to={`/admin/referrals/network/${member.id}`}>Inspect</Link>
    </article>)}</div> : <p className="muted">No direct referrals yet.</p>}
    {network.direct_referral_count > network.direct_referrals.length && <p className="muted">Showing the 100 most recently registered direct referrals of {network.direct_referral_count}.</p>}

    <h2>Reward history for this customer’s network</h2>
    {network.rewards.length ? <div className="referral-directory">{network.rewards.map((reward) => <article className="referral-directory-row" key={reward.id}>
      <span className="referral-directory-customer"><strong>{reward.recipient_email}</strong><small>{reward.order_number ? `Order ${reward.order_number}` : 'Legacy reward'} · Level {reward.level} · {new Date(reward.created_at).toLocaleDateString()}</small></span>
      <span className={`status status-${reward.status}`}>{reward.status}</span><strong>{money(reward.amount)}</strong>
    </article>)}</div> : <p className="muted">No referral rewards for this network.</p>}

    <h2>Wallet transaction history</h2>
    {network.wallet_transactions.length ? <div className="referral-directory">{network.wallet_transactions.map((entry) => <article className="referral-directory-row" key={entry.id}>
      <span className="referral-directory-customer"><strong>{entry.description}</strong><small>{entry.transaction_type} · {entry.order || 'No order'} · {new Date(entry.created_at).toLocaleDateString()}</small></span>
      <span className={`status status-${entry.status}`}>{entry.status}</span><strong>{money(entry.amount)}</strong>
    </article>)}</div> : <p className="muted">No wallet transactions.</p>}
  </section>
}
