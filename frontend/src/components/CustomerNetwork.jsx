import { useEffect, useState } from 'react'
import api, { errorMessage } from '../services/api'

export default function CustomerNetwork({ levels }) {
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    api.get('/referrals/me/network/', { params: { level, page }, signal: controller.signal })
      .then(({ data }) => setData(data))
      .catch((e) => { if (!controller.signal.aborted) setError(errorMessage(e)) })
    return () => controller.abort()
  }, [level, page])
  return <section><h3>My downline</h3><label className="field">Referral level<select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1) }}><option value="">All enabled levels</option>{levels.map(({ level }) => <option key={level} value={level}>Level {level}</option>)}</select></label>{error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading members…</p> : <><p>{data.count} members</p><div className="service-record-list">{data.results.map((member) => <article className="service-record" key={member.id}><span>{member.name} · Level {member.level}<small>Joined {new Date(member.joined).toLocaleDateString()}</small></span><strong>Earned ₹{Number(member.commission_earned).toFixed(2)}</strong></article>)}</div>{!data.count && <p>Your invited members will appear here.</p>}<nav className="pagination-controls" aria-label="Network pages"><button className="button secondary" disabled={!data.previous} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="button secondary" disabled={!data.next} onClick={() => setPage(page + 1)}>Next</button></nav></>}</section>
}
