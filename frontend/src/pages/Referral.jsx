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
  return <section className="wrap section referral-page"><div className="referral-hero"><div><span className="eyebrow">PASS ON THE GOODNESS</span><h1>Invite your people.<br /><em>Earn together.</em></h1><p>When a friend joins with your link and completes their first qualifying delivered order, wallet credits are added for both of you.</p><div className="ref-link"><span>{link}</span><button onClick={copy} aria-label="Copy referral link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div><button className="button primary" onClick={share}><Share2 size={17} /> Share your invite</button>{shareMessage && <p className="share-message" role="status">{shareMessage}</p>}</div><div className="gift-art">🎁<span>₹</span></div></div><div className="stats-grid"><article><span>Successful referrals</span><strong>{data.successful_referrals}</strong></article><article><span>Waiting for first order</span><strong>{data.pending_referrals}</strong></article><article><span>Wallet balance</span><strong>₹{Number(data.wallet_balance).toFixed(2)}</strong></article></div><div className="section-heading referral-list-heading"><div><span className="eyebrow">YOUR INVITES</span><h2>Referral activity</h2></div></div>{data.referrals.length ? <div className="orders-list">{data.referrals.map((referral) => <article className="order-card" key={referral.id}><div className="order-card-head"><strong>{referral.referred_email}</strong><span className={`status status-${referral.status}`}>{referral.status === 'completed' ? 'Reward issued' : 'Pending first qualifying order'}</span></div>{referral.order_number && <small>Qualifying order {referral.order_number}</small>}</article>)}</div> : <p className="muted">No referrals yet. Share your link to invite someone.</p>}<p className="fine-print">Referral rewards are sample program settings. Credits are issued only after server verification of a delivered order meeting the configured minimum.</p></section>
}
