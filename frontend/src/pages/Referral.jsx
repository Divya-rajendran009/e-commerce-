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
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    if (!user) return
    api.get('/referrals/me/')
      .then(({ data }) => setReferralCode(data.referral_code))
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
        await navigator.share({ title: 'Join SUPER MARKET', text: 'Use my referral link to join the shop.', url: link })
        setShareMessage('Invite shared.')
      } else await copy()
    } catch (exception) {
      if (exception.name !== 'AbortError') await copy()
    }
  }

  if (!user) return <section className="wrap section"><div className="empty-state"><Gift size={36} /><h2>Good things are better shared</h2><p>Sign in to get your personal invite code and link.</p><Link to="/login" className="button primary">Sign in</Link></div></section>
  if (error) return <section className="wrap section"><ErrorState message={error} /></section>
  if (!referralCode) return <Loading label="Loading your invite code…" />

  return <section className="wrap section referral-page">
    <div className="referral-hero">
      <div>
        <span className="eyebrow">PASS ON THE GOODNESS</span>
        <h1>Invite your people.<br /><em>Shop together.</em></h1>
        <p>Share your personal invite code or link with someone new to SUPER MARKET.</p>
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
    <p className="fine-print">This page only provides your personal invite code and link.</p>
  </section>
}
