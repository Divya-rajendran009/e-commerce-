import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Check, Copy, Gift, Share2 } from 'lucide-react'
import {
  BookOpen, CircleHelp, ClipboardList, Headset, Heart, Info, MapPin, ShieldCheck,
  MessageSquare, Package, Store, TicketPercent,
} from 'lucide-react'
import { hasAdminAccess } from '../utils/adminAccess'

const services = [
  [Package, 'My Orders', 'Track orders, see details, and request eligible returns.', '/orders'],
  [TicketPercent, 'Rewards', 'Review earned referral rewards and wallet activity.', '/account/rewards'],
  [CircleHelp, 'Asked Questions', 'Ask a question and read the store team’s response.', '/account/questions'],
  [MapPin, 'My Addresses', 'Save and manage delivery addresses.', '/account/addresses'],
  [ClipboardList, 'My Requests', 'Submit feedback or a request and track its status.', '/account/requests'],
  [BookOpen, 'Blogs', 'Read published news and helpful store articles.', '/blogs'],
  [Heart, 'Wishlist', 'Keep products you may want to order later.', '/account/wishlist'],
  [Headset, 'Contact Support', 'Contact the store and track support tickets.', '/account/support'],
  [Store, 'Reseller', 'Apply to the separate reseller programme and track commissions.', '/account/reseller'],
  [Info, 'Information', 'View store details and configured policies.', '/account/information'],
]

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [shareMessage, setShareMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code || ''}`
  const accountServices = hasAdminAccess(user)
    ? [...services, [ShieldCheck, 'Admin dashboard', 'Open your authorized store-management workspace.', '/admin']]
    : services

  const copyReferralLink = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(referralLink)
      else {
        const input = document.createElement('textarea')
        input.value = referralLink
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.append(input)
        input.select()
        const didCopy = document.execCommand('copy')
        input.remove()
        if (!didCopy) throw new Error('Clipboard access is not available on this device.')
      }
      setCopied(true)
      setShareMessage('Referral link copied.')
      window.setTimeout(() => { setCopied(false); setShareMessage('') }, 1800)
    } catch (error) {
      setShareMessage(error.message || 'Could not copy the link.')
    }
  }

  const shareReferralLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join SUPER MARKET', text: 'Use my referral link to join the shop.', url: referralLink })
        setShareMessage('Invite shared.')
      } else await copyReferralLink()
    } catch (error) {
      if (error.name !== 'AbortError') setShareMessage(error.message || 'Could not open the share sheet.')
    }
  }

  return <section className="wrap section account-page">
    <span className="eyebrow">YOUR ACCOUNT</span>
    <h1>Hello, {user?.first_name || 'there'}.</h1>
    <p>Manage your shopping, support requests, saved details and referral rewards.</p>
    <nav className="account-services-grid" aria-label="Account services">
      {accountServices.map(([Icon, title, description, to]) => <Link className="account-service-card" key={to} to={to} aria-label={`${title}: ${description}`}>
        <span className="account-service-icon"><Icon size={22} aria-hidden="true" /></span>
        <strong>{title}</strong>
        <span>{description}</span>
        <span className="account-service-action">Open <span aria-hidden="true">→</span></span>
      </Link>)}
    </nav>
    <section className="account-referral" aria-labelledby="account-referral-heading">
      <div className="account-referral-icon"><Gift size={21} /></div>
      <div className="account-referral-content">
        <span className="eyebrow">CUSTOMER REFERRALS</span>
        <h2 id="account-referral-heading">Your referral invite</h2>
        <p>Customer referrals remain separate from the reseller programme.</p>
        <div className="account-referral-code"><span>Your code</span><strong>{user?.referral_code || 'Loading code…'}</strong></div>
        <div className="ref-link account-referral-link"><span>{referralLink}</span><button type="button" onClick={copyReferralLink} aria-label="Copy referral link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
        <div className="account-referral-actions"><button type="button" className="button primary" onClick={shareReferralLink}><Share2 size={16} /> Share invite</button><Link to="/referrals" className="text-link">Referral dashboard →</Link></div>
        {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
      </div>
    </section>
    <button className="button secondary" onClick={() => logout().finally(() => navigate('/'))}>Sign out</button>
  </section>
}
