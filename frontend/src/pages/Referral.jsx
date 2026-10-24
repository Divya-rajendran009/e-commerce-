import { Check, Copy, Gift, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'
import { copyText } from '../utils/clipboard'

export default function Referral() {
  const { user } = useAuth()
  const [referralCode, setReferralCode] = useState(user?.referral_code || '')
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    if (!user) return
    api.get('/referrals/me/')
      .then(({ data }) => {
        setDashboard(data)
        setReferralCode(data.referral_code)
      })
      .catch((exception) => setError(errorMessage(exception)))
  }, [user])

  const link = `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`
  const copyValue = async (value, label, setCopiedState) => {
    try {
      await copyText(value)
      setCopiedState(true)
      setShareMessage(`${label} copied.`)
      window.setTimeout(() => { setCopiedState(false); setShareMessage('') }, 1800)
    } catch (exception) {
      setShareMessage(exception.message || `Could not copy the ${label.toLowerCase()}.`)
    }
  }
  const copy = () => copyValue(link, 'Referral link', setCopied)
  const copyCode = () => copyValue(referralCode, 'Referral code', setCopiedCode)
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join Pandiyan Store', text: 'Use my referral link to join the shop.', url: link })
        setShareMessage('Invite shared.')
      } else await copy()
    } catch (exception) {
      if (exception.name !== 'AbortError') await copy()
    }
  }

  if (!user) return <section className="wrap section"><div className="empty-state"><Gift size={36} /><h2>Good things are better shared</h2><p>Sign in to get your personal invite code and link.</p><Link to="/login" className="button primary">Sign in</Link></div></section>
  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!dashboard || !referralCode) return <Loading label="Loading your referral progress…" />

  return <section className="wrap section referral-page">
    <div className="referral-hero">
      <div>
        <span className="eyebrow">PASS ON THE GOODNESS</span>
        <h1>Invite your people.<br /><em>Shop together.</em></h1>
        <p>Share your personal invite code or link with someone new to Pandiyan Store.</p>
        <div className="referral-code-row">
          <span><small>Your referral code</small><strong>{referralCode}</strong></span>
          <button type="button" className="button secondary" onClick={copyCode}>{copiedCode ? <Check size={16} /> : <Copy size={16} />} {copiedCode ? 'Copied' : 'Copy code'}</button>
        </div>
        <div className="ref-link"><span>{link}</span><button type="button" onClick={copy} aria-label="Copy referral link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
        <button className="button primary" type="button" onClick={share}><Share2 size={17} /> Share your invite</button>
        {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
      </div>
      <div className="gift-art" aria-hidden="true">🎁<span>+</span></div>
    </div>
    <section className="referral-network-panel">
      <span className="eyebrow">YOUR QUALIFICATION</span>
      <h2>{dashboard.is_qualified ? 'You are eligible for referral commissions' : 'Build qualification with your own orders'}</h2>
      <p>Qualifying spend: {amount(dashboard.qualifying_self_purchase_total)} of {amount(dashboard.qualification_threshold)} in your own delivered purchases. Referral purchases do not count. Cancelled, refunded, and completed-return orders are excluded or adjusted.</p>
      <div role="progressbar" aria-label="Referral qualification progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={dashboard.qualification_progress_percent} className="referral-progress" style={{ height: 8, background: '#e5eee8', borderRadius: 999, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${dashboard.qualification_progress_percent}%`, background: '#176b45' }} /></div>
      <p>Commissions are considered only after a referred order is delivered. COD orders are not rewarded merely for being placed.</p>
      <h3>Commission rates</h3>
      <p>Commission categories: {dashboard.commission_category_scope === 'specific' ? 'Selected categories only' : 'All Categories'}</p>
      <div className="referral-level-summary">{dashboard.commission_rates.map((rule) => <article key={`${rule.level}-${rule.category_id ?? 'all'}`}><span>{rule.category_name ? `${rule.category_name} · Level ${rule.level}` : `All Categories · Level ${rule.level}`}</span><strong>{rule.reward_type === 'percentage' ? `${Number(rule.amount).toFixed(2)}%` : amount(rule.amount)}</strong></article>)}</div>
      <h3>Your network</h3>
      <div className="referral-level-summary">{dashboard.network_levels.map(({ level, count }) => <article key={level}><span>Level {level}</span><strong>{count} {count === 1 ? 'person' : 'people'}</strong></article>)}</div>
      <h3>Wallet balance</h3>
      <p>{amount(dashboard.wallet_balance)}</p>
      <h3>Eligible rewards and wallet history</h3>
      {dashboard.rewards.length > 0 && <div className="service-record-list">{dashboard.rewards.map((reward) => <article className="service-record" key={reward.id}><span>Level {reward.level} · {reward.status}{reward.order_number ? ` · ${reward.order_number}` : ''}</span><strong>{amount(reward.amount)}</strong></article>)}</div>}
      {dashboard.wallet_transactions.length > 0 ? <div className="service-record-list">{dashboard.wallet_transactions.map((entry) => <article className="service-record" key={entry.id}><span>{entry.description} · {new Date(entry.created_at).toLocaleDateString()}</span><strong>{amount(entry.amount)}</strong></article>)}</div> : <p className="fine-print">No wallet transactions yet.</p>}
    </section>
  </section>
}

function amount(value) {
  return `₹${Number(value || 0).toFixed(2)}`
}
