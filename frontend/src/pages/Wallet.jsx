import { Link, useOutletContext } from 'react-router-dom'
import { ArrowLeft, WalletCards, Gift, ReceiptText, ShieldCheck, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { money } from '../components/StorefrontTools'

export default function Wallet() {
  const { user } = useAuth()
  const { wallet, walletError, refreshWallet } = useOutletContext()
  return <section className="wallet-page personal-page">
    <div className="simple-page-title"><Link to="/account" aria-label="Back to profile"><ArrowLeft size={21} /></Link><h1>Wallet</h1></div>
    <div className="wallet-masthead"><span className="wallet-emblem" aria-hidden="true"><WalletCards size={48} strokeWidth={1.5} /></span><small>PANIAM STORES</small><h2>Your wallet</h2>
      <p>Referral rewards, in one place.</p>
      {user ? <div className="wallet-amount"><span>Current balance</span><strong>{wallet ? money(wallet.balance) : '—'}</strong></div> : <Link className="button primary full" to="/login">Sign in to view your balance</Link>}
    </div>
    <div className="wallet-content">
      {user && walletError && <div className="notice error" role="alert"><p>{walletError}</p><button className="button secondary" onClick={refreshWallet}>Try again</button></div>}
      {user && !wallet && !walletError && <p role="status">Loading your wallet…</p>}
      <div className="wallet-features">
        <article><Gift size={24} /><div><h3>Your earned rewards</h3><p>View rewards credited through the store’s referral programme.</p></div></article>
        <article><ReceiptText size={24} /><div><h3>A clear record</h3><p>Check the amount, date and status of every wallet entry.</p></div></article>
        <article><ShieldCheck size={24} /><div><h3>Wallet availability</h3><p>{wallet ? (wallet.spending_enabled ? 'Wallet spending is enabled by the store. Eligibility is checked at checkout.' : 'Wallet spending is currently disabled by the store.') : 'Sign in to check your wallet and its availability.'}</p></div></article>
      </div>
      <Link className="wallet-rewards-link" to="/referrals"><Gift size={21} /><span>Explore referral rewards</span><ChevronRight size={18} /></Link>
      <section className="wallet-history"><h2>Transaction history</h2>{!user ? <p>Sign in to see your transactions.</p> : wallet ? (wallet.transactions.length ? wallet.transactions.map(entry => <article key={entry.id}><div><strong>{entry.description || 'Wallet entry'}</strong><small>{new Date(entry.created_at).toLocaleDateString('en-IN')} · {entry.status.replaceAll('_', ' ')}</small></div><b className={Number(entry.amount) < 0 ? 'is-debit' : ''}>{Number(entry.amount) > 0 ? '+' : ''}{money(entry.amount)}</b></article>) : <p>No transactions yet. Your credited rewards will appear here.</p>) : <p>History will appear once your wallet loads.</p>}</section>
    </div>
  </section>
}
