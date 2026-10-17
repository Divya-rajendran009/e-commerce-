import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ErrorState, Loading } from '../components/Shared'
import api, { errorMessage } from '../services/api'

const ORDER_STATUSES = [
  ['confirmed', 'Confirmed'],
  ['processing', 'Processing'],
  ['packed', 'Packed'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
]

const emptyStats = {
  total_customers: 0,
  customers_with_referrer: 0,
  total_direct_referrals: 0,
  total_downline_members: 0,
  active_referrals: 0,
  inactive_referrals: 0,
  pending_rewards: 0,
  credited_rewards: 0,
  reversed_rewards: 0,
  ineligible_rewards: 0,
  wallet_credits_issued: 0,
  reward_liability: 0,
  members_by_level: [],
}

function amount(value) {
  return `₹${Number(value || 0).toFixed(2)}`
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `wallet-adjustment-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function AdminReferrals() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [stats, setStats] = useState(emptyStats)
  const [customers, setCustomers] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState({ search: '', ancestor_id: '', level: '', status: '', referral_status: '', date_from: '', date_to: '' })
  const [query, setQuery] = useState(filters)
  const [page, setPage] = useState(1)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [adjustment, setAdjustment] = useState({
    customer_id: '',
    amount: '',
    transaction_type: 'credit',
    reason: '',
    idempotency_key: createIdempotencyKey(),
  })
  const [loading, setLoading] = useState(true)
  const loadNetwork = useCallback(async (params = query, pageNumber = page) => {
    setError('')
    try {
      const { data } = await api.get('/admin/referrals/network/', { params: { ...params, page: pageNumber } })
      setCustomers(data)
    } catch (exception) {
      setError(errorMessage(exception))
    }
  }, [query, page])

  useEffect(() => {
    Promise.all([
      api.get('/admin/referral-settings/'),
      api.get('/admin/referrals/stats/'),
      api.get('/admin/referrals/network/'),
      api.get('/admin/rewards/'),
    ]).then(([programResponse, statsResponse, networkResponse, ledgerResponse]) => {
      setSettings(programResponse.data)
      setStats(statsResponse.data)
      setCustomers(networkResponse.data)
      setLedger(ledgerResponse.data)
    }).catch((exception) => setError(errorMessage(exception))).finally(() => setLoading(false))
  }, [])

  const setSetting = (name, value) => setSettings((current) => ({ ...current, [name]: value }))
  const setRule = (level, key, value) => setSettings((current) => ({
    ...current,
    level_rules: current.level_rules.map((rule) => rule.level === level ? { ...rule, [key]: value } : rule),
  }))
  const setDepth = (depth) => {
    setSettings((current) => {
      const existing = new Map(current.level_rules.map((rule) => [rule.level, rule]))
      return {
        ...current,
        max_depth: depth,
        level_rules: Array.from({ length: depth }, (_, index) => existing.get(index + 1) || {
          level: index + 1,
          reward_type: 'fixed',
          amount: '0.00',
          active: false,
        }),
      }
    })
  }
  const save = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const { data } = await api.patch('/admin/referral-settings/', settings)
      setSettings(data)
      setMessage('Referral programme settings saved. New rules apply to future eligibility; existing relationships and ledger entries are retained.')
      const statsResponse = await api.get('/admin/referrals/stats/')
      setStats(statsResponse.data)
    } catch (exception) {
      setError(errorMessage(exception))
    }
  }
  const applyFilters = async (event) => {
    event.preventDefault()
    const nextQuery = { ...filters }
    setQuery(nextQuery)
    setPage(1)
    await loadNetwork(nextQuery, 1)
  }
  const changePage = async (nextPage) => {
    setPage(nextPage)
    await loadNetwork(query, nextPage)
  }
  const loadLedger = async (search = ledgerSearch, pageNumber = ledgerPage) => {
    setError('')
    try {
      const { data } = await api.get('/admin/rewards/', { params: { search, page: pageNumber } })
      setLedger(data)
    } catch (exception) {
      setError(errorMessage(exception))
    }
  }
  const searchLedger = async (event) => {
    event.preventDefault()
    setLedgerPage(1)
    await loadLedger(ledgerSearch, 1)
  }
  const submitAdjustment = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.post('/admin/referrals/wallet-adjustments/', adjustment)
      setMessage('Wallet adjustment recorded and added to the audit log.')
      setAdjustment({ ...adjustment, customer_id: '', amount: '', reason: '', idempotency_key: createIdempotencyKey() })
      const [statsResponse] = await Promise.all([
        api.get('/admin/referrals/stats/'),
        loadLedger(ledgerSearch, ledgerPage),
      ])
      setStats(statsResponse.data)
    } catch (exception) {
      setError(errorMessage(exception))
    }
  }

  if (loading) return <Loading label="Loading referral network…" />
  if (!settings) return <section className="wrap section"><ErrorState message={error || 'Referral programme settings are unavailable.'} /></section>

  const statuses = new Set(settings.qualifying_order_statuses)
  return <section className="wrap section admin-page referral-admin-page">
    <span className="eyebrow">CUSTOMER GROWTH</span>
    <h1>Referral network</h1>
    <p>Configure multi-level rewards, inspect customer relationships and audit wallet credits. Configuration changes apply to future reward decisions.</p>
    {error && <ErrorState message={error} />}
    {message && <div className="notice success" role="status">{message}</div>}

    <div className="referral-admin-metrics">
      {[
        ['Customers', stats.total_customers],
        ['With a referrer', stats.customers_with_referrer],
        ['Direct referrals', stats.total_direct_referrals],
        ['Downline memberships', stats.total_downline_members],
        ['Active relationships', stats.active_referrals],
        ['Pending rewards', stats.pending_rewards],
        ['Credited rewards', stats.credited_rewards],
        ['Reversed rewards', stats.reversed_rewards],
        ['Credits issued', amount(stats.wallet_credits_issued)],
        ['Reward liability', amount(stats.reward_liability)],
      ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div>

    <div className="referral-level-summary">{stats.members_by_level.map(({ level, count }) => <article key={level}><span>Level {level}</span><strong>{count}</strong></article>)}</div>

    <form className="account-service-form referral-program-form" onSubmit={save}>
      <fieldset className="referral-settings-controls" disabled={!settings.can_manage_settings}>
      <div className="section-heading"><div><span className="eyebrow">PROGRAMME RULES</span><h2>Reward configuration</h2></div><label className="check-field"><input type="checkbox" checked={settings.active} onChange={(event) => setSetting('active', event.target.checked)} /> Programme enabled</label></div>
      <div className="service-form-grid">
        <label className="field"><span>Maximum referral depth</span><select value={settings.max_depth} onChange={(event) => setDepth(Number(event.target.value))}>{[1, 2, 3, 4, 5, 6].map((depth) => <option value={depth} key={depth}>{depth} level{depth === 1 ? '' : 's'}</option>)}</select></label>
        <label className="field"><span>Minimum qualifying order (₹)</span><input type="number" min="0" step="0.01" required value={settings.minimum_order_amount} onChange={(event) => setSetting('minimum_order_amount', event.target.value)} /></label>
        <label className="field"><span>Maximum reward per recipient (₹, optional)</span><input type="number" min="0" step="0.01" value={settings.max_reward_per_referral || ''} onChange={(event) => setSetting('max_reward_per_referral', event.target.value || null)} /></label>
        <label className="field"><span>New referred-customer bonus (₹)</span><input type="number" min="0" step="0.01" value={settings.customer_reward} onChange={(event) => setSetting('customer_reward', event.target.value)} /></label>
        <label className="check-field"><input type="checkbox" checked={settings.reward_on_first_qualifying_order_only} onChange={(event) => setSetting('reward_on_first_qualifying_order_only', event.target.checked)} /> First qualifying order only</label>
        <label className="check-field"><input type="checkbox" checked={settings.reward_referrer} onChange={(event) => setSetting('reward_referrer', event.target.checked)} /> Reward direct referrer</label>
        <label className="check-field"><input type="checkbox" checked={settings.reward_ancestors} onChange={(event) => setSetting('reward_ancestors', event.target.checked)} /> Reward higher-level ancestors</label>
        <label className="check-field"><input type="checkbox" checked={settings.reward_referred_customer} onChange={(event) => setSetting('reward_referred_customer', event.target.checked)} /> Reward referred customer</label>
        <label className="check-field"><input type="checkbox" checked={settings.reverse_on_full_refund} onChange={(event) => setSetting('reverse_on_full_refund', event.target.checked)} /> Reverse credits after full refunds</label>
        <label className="check-field"><input type="checkbox" checked={settings.reverse_on_cancellation} onChange={(event) => setSetting('reverse_on_cancellation', event.target.checked)} /> Reverse credits after cancellations</label>
        <label className="check-field"><input type="checkbox" checked={settings.wallet_spending_enabled} disabled readOnly /> Wallet spending at checkout (not implemented)</label>
        <label className="field"><span>Wallet credit expiry (not implemented)</span><input type="number" min="1" value={settings.wallet_expiry_days || ''} disabled readOnly /></label>
      </div>
      <p className="form-hint">Wallet redemption during checkout and automatic credit expiry are not active. These stored settings do not affect orders.</p>
      <fieldset className="referral-status-fieldset"><legend>Order statuses that qualify</legend><div>{ORDER_STATUSES.map(([value, label]) => <label className="check-field" key={value}><input type="checkbox" checked={statuses.has(value)} onChange={(event) => setSetting('qualifying_order_statuses', event.target.checked ? [...statuses, value] : [...statuses].filter((item) => item !== value))} />{label}</label>)}</div></fieldset>
      <h3>Ancestor reward per level</h3>
      <div className="referral-rule-grid">{settings.level_rules.filter((rule) => rule.level <= settings.max_depth).map((rule) => <article className="referral-rule-card" key={rule.level}>
        <strong>Level {rule.level}</strong>
        <label className="check-field"><input type="checkbox" checked={rule.active} onChange={(event) => setRule(rule.level, 'active', event.target.checked)} /> Active</label>
        <label className="field"><span>Reward type</span><select value={rule.reward_type} onChange={(event) => setRule(rule.level, 'reward_type', event.target.value)}><option value="fixed">Fixed credit (₹)</option><option value="percentage">Percent of order (%)</option></select></label>
        <label className="field"><span>{rule.reward_type === 'percentage' ? 'Percentage' : 'Amount'}</span><input type="number" min="0" max={rule.reward_type === 'percentage' ? 100 : undefined} step="0.01" value={rule.amount} onChange={(event) => setRule(rule.level, 'amount', event.target.value)} /></label>
      </article>)}</div>
      <button className="button primary">Save referral settings</button>
      </fieldset>
      {!settings.can_manage_settings && <p className="form-hint" role="status">Read-only access. An administrator must explicitly grant you permission to change referral settings.</p>}
    </form>

    <section className="referral-network-panel">
      <div className="section-heading"><div><span className="eyebrow">NETWORK DIRECTORY</span><h2>Customers and downlines</h2></div></div>
      <form className="referral-network-filters" onSubmit={applyFilters}>
        <label className="field"><span>Name, email, phone, or referral code</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label className="field"><span>Ancestor customer ID (optional)</span><input type="number" min="1" value={filters.ancestor_id} onChange={(event) => setFilters({ ...filters, ancestor_id: event.target.value })} /></label>
        <label className="field"><span>Level</span><select value={filters.level} onChange={(event) => setFilters({ ...filters, level: event.target.value })}><option value="">All levels</option>{Array.from({ length: settings.max_depth }, (_, index) => index + 1).map((level) => <option key={level} value={level}>Level {level}</option>)}</select></label>
        <label className="field"><span>Account status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className="field"><span>Referral status</span><select value={filters.referral_status} onChange={(event) => setFilters({ ...filters, referral_status: event.target.value })}><option value="">All</option><option value="pending">Pending order</option><option value="completed">Reward issued</option><option value="inactive">Inactive</option><option value="unreferred">No referrer</option></select></label>
        <label className="field"><span>Registered from</span><input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} /></label>
        <label className="field"><span>Registered to</span><input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} /></label>
        <button className="button primary">Search network</button>
      </form>
      {customers?.results?.length ? <div className="referral-directory">{customers.results.map((customer) => <article className="referral-directory-row" key={customer.id}>
        <span className="referral-directory-avatar">{(customer.full_name || customer.email).slice(0, 1).toUpperCase()}</span>
        <span className="referral-directory-customer"><strong>{customer.full_name || 'Customer'}</strong><small>{customer.email} · {customer.phone} · {customer.referral_code}</small></span>
        <span className="referral-directory-meta"><strong>{customer.level ? `Level ${customer.level}` : 'Direct account'}</strong><small>Referrer: {customer.direct_referrer?.email || '—'}</small></span>
        <Link className="button secondary small" to={`/admin/referrals/network/${customer.id}`}>Inspect</Link>
      </article>)}</div> : <p className="muted">No customers match these filters.</p>}
      <div className="referral-pagination"><span>{customers?.count || 0} customers · page {page} of {Math.max(1, Math.ceil((customers?.count || 0) / 25))}</span><div><button className="button secondary small" disabled={!customers?.previous} onClick={() => changePage(page - 1)}>Previous</button><button className="button secondary small" disabled={!customers?.next} onClick={() => changePage(page + 1)}>Next</button></div></div>
    </section>

    <section className="referral-ledger-panel">
      <span className="eyebrow">AUDITABLE WALLET</span><h2>Wallet transactions</h2>
      <form className="referral-ledger-search" onSubmit={searchLedger}><label className="field"><span>Search customer name, email, phone, or code</span><input value={ledgerSearch} onChange={(event) => setLedgerSearch(event.target.value)} /></label><button className="button secondary">Search ledger</button></form>
      {ledger?.results?.length ? <div className="referral-directory">{ledger.results.map((entry) => <article className="referral-directory-row" key={entry.id}>
        <span className="referral-directory-customer"><strong>{entry.customer_email}</strong><small>{entry.description} · {entry.order ? `Order ${entry.order}` : 'No order'} · Level {entry.level ?? '—'}</small></span>
        <span className={`status status-${entry.transaction_type}`}>{entry.transaction_type} · {entry.status}</span>
        <strong className={Number(entry.amount) < 0 ? 'wallet-debit' : 'wallet-credit'}>{amount(entry.amount)}</strong>
      </article>)}</div> : <p className="muted">No wallet transactions match this search.</p>}
      <div className="referral-pagination"><span>{ledger?.count || 0} transactions · page {ledgerPage} of {Math.max(1, Math.ceil((ledger?.count || 0) / 25))}</span><div><button className="button secondary small" disabled={!ledger?.previous} onClick={async () => { const next = ledgerPage - 1; setLedgerPage(next); await loadLedger(ledgerSearch, next) }}>Previous</button><button className="button secondary small" disabled={!ledger?.next} onClick={async () => { const next = ledgerPage + 1; setLedgerPage(next); await loadLedger(ledgerSearch, next) }}>Next</button></div></div>
      {['admin', 'super_admin'].includes(user?.role) && <details className="referral-adjustment"><summary>Authorized manual wallet adjustment</summary>
        <p>Only administrator and super-administrator roles may post signed ledger adjustments. The change is audited and requires an idempotency key.</p>
        <form className="service-form-grid" onSubmit={submitAdjustment}>
          <label className="field"><span>Customer account ID</span><input type="number" min="1" required value={adjustment.customer_id} onChange={(event) => setAdjustment({ ...adjustment, customer_id: event.target.value })} /></label>
          <label className="field"><span>Amount (₹)</span><input type="number" min="0.01" step="0.01" required value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></label>
          <label className="field"><span>Adjustment</span><select value={adjustment.transaction_type} onChange={(event) => setAdjustment({ ...adjustment, transaction_type: event.target.value })}><option value="credit">Credit</option><option value="debit">Debit</option></select></label>
          <label className="field"><span>Reason</span><input maxLength="180" required value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></label>
          <button className="button primary">Record adjustment</button>
        </form>
      </details>}
    </section>
  </section>
}
