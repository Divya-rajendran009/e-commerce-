import { Check, Copy, Gift, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { errorMessage } from '../services/api'
import { ErrorState, Loading } from '../components/Shared'

export default function Referral() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  useEffect(() => { if (user) api.get('/referrals/me/').then(({ data: payload }) => setData(payload)).catch((e) => setError(errorMessage(e))) }, [user])
  const link = `${window.location.origin}/register?ref=${data?.referral_code || user?.referral_code || ''}`
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link)
      else {
        const input = document.createElement('textarea')
        input.value = link
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.append(input)
        input.select()
        const copiedLink = document.execCommand('copy')
        input.remove()
        if (!copiedLink) throw new Error('Clipboard access is not available on this device.')
      }
      setCopied(true)
      setShareMessage('Referral link copied.')
      window.setTimeout(() => { setCopied(false); setShareMessage('') }, 1800)
    } catch (e) {
      setShareMessage(e.message || 'Could not copy the link. Please select and copy it.')
    }
  }
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join SUPER MARKET', text: 'Use my referral link to join the shop.', url: link })
        setShareMessage('Invite shared.')
      } else await copy()
    } catch (e) {
      if (e.name !== 'AbortError') setShareMessage(e.message || 'Could not open the share sheet.')
    }
  }
  if (!user) return <section className="wrap section"><div className="empty-state"><Gift size={36} /><h2>Good things are better shared</h2><p>Sign in to see your referral code and rewards.</p><Link to="/login" className="button primary">Sign in</Link></div></section>
  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!data) return <Loading />
  const rewardsByStatus = data.rewards.reduce((totals, reward) => {
    totals[reward.status] = (totals[reward.status] || 0) + 1
    return totals
  }, {})
  return <section className="wrap section referral-page"><div className="referral-hero"><div><span className="eyebrow">PASS ON THE GOODNESS</span><h1>Invite your people.<br /><em>Earn together.</em></h1><p>Share your referral code and follow your growing network. Rewards are calculated by the store’s current referral rules.</p><div className="ref-link"><span>{link}</span><button onClick={copy} aria-label="Copy referral link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><button className="button primary" onClick={share}><Share2 size={17} /> Share your invite</button>{shareMessage && <p className="share-message" role="status">{shareMessage}</p>}</div><div className="gift-art">🎁<span>₹</span></div></div>
    <div className="stats-grid"><article><span>Direct referrals</span><strong>{data.direct_referrals}</strong></article><article><span>Total downline</span><strong>{data.total_downline}</strong></article><article><span>Wallet balance</span><strong>₹{Number(data.wallet_balance).toFixed(2)}</strong></article><article><span>Pending rewards</span><strong>{data.pending_rewards}</strong></article><article><span>Credited rewards</span><strong>{rewardsByStatus.credited || 0}</strong></article><article><span>Reversed rewards</span><strong>{rewardsByStatus.reversed || 0}</strong></article></div>
    <div className="section-heading referral-list-heading"><div><span className="eyebrow">YOUR NETWORK</span><h2>Members by referral level</h2></div></div>
    <div className="referral-level-summary">{data.level_counts.map(({ level, count }) => <article key={level}><span>Level {level}</span><strong>{count}</strong></article>)}</div>
    <div className="section-heading referral-list-heading"><div><span className="eyebrow">YOUR INVITES</span><h2>Referral activity</h2></div></div>
    {data.referrals.length ? <div className="orders-list">{data.referrals.map((referral) => <article className="order-card order-card-head" key={referral.id}><span><strong>Referral member</strong><small>Joined {new Date(referral.created_at).toLocaleDateString()}</small></span><span className={`status status-${referral.status}`}>{referral.status === 'completed' ? 'Qualifying order complete' : 'Waiting for qualifying order'}</span></article>)}</div> : <p className="muted">No referrals yet. Share your link to invite someone.</p>}
    <div className="section-heading referral-list-heading"><div><span className="eyebrow">WALLET ACTIVITY</span><h2>Reward transactions</h2></div></div>
    {data.wallet_transactions.length ? <div className="orders-list">{data.wallet_transactions.map((entry) => <article className="order-card order-card-head" key={entry.id}><span><strong>{entry.description}</strong><small>{new Date(entry.created_at).toLocaleDateString()} · {entry.transaction_type}</small></span><strong className={entry.amount < 0 ? 'wallet-debit' : 'wallet-credit'}>{entry.amount < 0 ? '−' : '+'}₹{Math.abs(Number(entry.amount)).toFixed(2)}</strong></article>)}</div> : <p className="muted">No wallet transactions yet.</p>}
    <p className="fine-print">Only your referral counts, reward amounts, and wallet activity are shown here. Personal details of network members are not disclosed.</p>
  </section>
}
