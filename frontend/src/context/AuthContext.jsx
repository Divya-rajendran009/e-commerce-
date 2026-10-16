import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sm_user')) } catch { return null }
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const access = localStorage.getItem('sm_access')
    if (!access) { setReady(true); return }
    api.get('/auth/me/').then(({ data }) => {
      setUser(data)
      localStorage.setItem('sm_user', JSON.stringify(data))
    }).catch(() => {
      localStorage.removeItem('sm_access')
      localStorage.removeItem('sm_refresh')
      localStorage.removeItem('sm_user')
      setUser(null)
    }).finally(() => setReady(true))
  }, [])

  const acceptSession = (payload) => {
    localStorage.setItem('sm_access', payload.access)
    localStorage.setItem('sm_refresh', payload.refresh)
    localStorage.setItem('sm_user', JSON.stringify(payload.user))
    setUser(payload.user)
  }

  const logout = async () => {
    const refresh = localStorage.getItem('sm_refresh')
    try { if (refresh) await api.post('/auth/logout/', { refresh }) }
    finally {
      localStorage.removeItem('sm_access')
      localStorage.removeItem('sm_refresh')
      localStorage.removeItem('sm_user')
      setUser(null)
    }
  }

  return <AuthContext.Provider value={{ user, ready, acceptSession, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
