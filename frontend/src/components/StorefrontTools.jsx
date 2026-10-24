import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock3, MapPin, Search, X } from 'lucide-react'
import api from '../services/api'

export const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0)
export function readPin() { try { return localStorage.getItem('pandiyan_pin') || '' } catch { return '' } }

export function StoreSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const [recent, setRecent] = useState(() => { try { const list = JSON.parse(localStorage.getItem('pandiyan_searches') || '[]'); return Array.isArray(list) ? list.filter(x => typeof x === 'string').slice(0, 5) : [] } catch { return [] } })
  useEffect(() => { setQuery(new URLSearchParams(location.search).get('search') || ''); setOpen(false) }, [location])
  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); setStatus(''); return }
    const controller = new AbortController()
    setStatus('Searching…')
    setResults([])
    const timer = setTimeout(() => api.get('/products/', { params: { search: query.trim(), page_size: 5 }, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      const rows = data.results || data
      setResults(rows); setStatus(rows.length ? '' : 'No matches. Try a product or category name.')
    }).catch(() => { if (!controller.signal.aborted) setStatus('Suggestions unavailable. Press Search to try again.') }), 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, open])
  const remember = (term) => { const next = [term, ...recent.filter(x => x !== term)].slice(0, 5); setRecent(next); try { localStorage.setItem('pandiyan_searches', JSON.stringify(next)) } catch { /* Storage is optional. */ } }
  const search = (term) => { const text = term.trim(); if (text) remember(text); setOpen(false); navigate(`/products${text ? `?search=${encodeURIComponent(text)}` : ''}`) }
  return <div className="store-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
    <form className="search-box" role="search" onSubmit={e => { e.preventDefault(); search(query) }}><Search size={20} aria-hidden="true" /><input aria-label="Search products" aria-controls={open ? 'search-suggestions' : undefined} placeholder="Search for milk, rice, daily essentials…" value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true) }} />{query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}<button type="submit">Search</button></form>
    {open && <div className="search-suggestions" id="search-suggestions"><strong>{query.trim() ? 'Matching products' : recent.length ? 'Recent searches' : 'Find your everyday favourites'}</strong>{status && <p role="status">{status}</p>}{query.trim() ? results.map(p => <Link key={p.id} to={`/products/${p.id}`} onClick={() => { remember(query.trim()); setOpen(false) }}><Search size={16} /><span>{p.name}</span><small>{money(p.price)}</small></Link>) : (recent.length ? recent : ['Rice', 'Milk', 'Snacks']).map(term => <button type="button" key={term} onClick={() => search(term)}><Clock3 size={16} />{term}<ArrowRight size={14} /></button>)}</div>}
  </div>
}

export function DeliveryPicker({ store, unavailable }) {
  const [pin, setPin] = useState(readPin)
  const [draft, setDraft] = useState(pin)
  const [message, setMessage] = useState('')
  const dialog = useRef(null)
  const supported = store.delivery_pin_codes?.includes(pin)
  const submit = (e) => {
    e.preventDefault()
    if (unavailable || !Array.isArray(store.delivery_pin_codes)) { setMessage('Delivery information is unavailable. Please try again shortly.'); return }
    if (!store.delivery_pin_codes.includes(draft)) { setMessage('We don’t deliver to this PIN yet. You can still browse our store.'); return }
    setPin(draft); try { localStorage.setItem('pandiyan_pin', draft) } catch { /* Browsing works without persistence. */ }
    dialog.current.close()
  }
  return <><button className="delivery-picker" onClick={() => { setDraft(pin); setMessage(''); dialog.current.showModal() }}><MapPin size={19} /><span><strong>{supported ? `Delivery in ${store.delivery_timeline || 'your local area'}` : 'Delivery to your doorstep'}</strong><small>{supported ? `Deliver to ${pin}` : 'Choose your delivery PIN'} <ChevronDown size={13} /></small></span></button>
    <dialog ref={dialog} aria-labelledby="delivery-title" className="delivery-dialog" onClick={e => { if (e.target === dialog.current) dialog.current.close() }}><button className="dialog-close" aria-label="Close delivery location" onClick={() => dialog.current.close()}><X size={20} /></button><div className="location-symbol"><MapPin size={28} /></div><h2 id="delivery-title">A little closer to home.</h2><p>Check delivery availability in your neighbourhood.</p><form onSubmit={submit}><label htmlFor="delivery-pin">Your PIN code</label><input id="delivery-pin" autoFocus required pattern="[1-9][0-9]{5}" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit PIN" value={draft} onChange={e => { setDraft(e.target.value.replace(/\D/g, '')); setMessage('') }} /><button className="button primary full">Check delivery</button></form>{message && <p role="status" className="notice">{message}</p>}<small>Serving {store.delivery_pin_codes?.join(' & ') || 'our local neighbourhood'}. Availability is verified again at checkout.</small></dialog>
  </>
}

export function ProductSkeletons({ count = 6 }) { return <div className="product-grid" role="status" aria-label="Loading products">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><span /><span /></div>)}</div> }
