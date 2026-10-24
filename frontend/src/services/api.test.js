import { describe, expect, it, vi, afterEach } from 'vitest'
import api, { errorMessage } from './api'
import { AxiosError } from 'axios'

const originalAdapter = api.defaults.adapter
afterEach(() => { api.defaults.adapter = originalAdapter; vi.unstubAllGlobals() })

it('refreshes an expired session once for concurrent requests', async () => {
  const values = new Map([['sm_access', 'expired'], ['sm_refresh', 'refresh-one']])
  vi.stubGlobal('localStorage', { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) })
  let refreshes = 0
  api.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh/') {
      refreshes += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { status: 200, data: { access: 'fresh', refresh: 'refresh-two' }, headers: {}, config }
    }
    if (config.headers.Authorization !== 'Bearer fresh') throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {}, config })
    return { status: 200, data: { ok: true }, headers: {}, config }
  }
  const responses = await Promise.all([api.get('/orders/'), api.get('/auth/me/')])
  expect(responses.every((response) => response.data.ok)).toBe(true)
  expect(refreshes).toBe(1)
  expect(values.get('sm_refresh')).toBe('refresh-two')
})

it('does not attempt refresh for an invalid login', async () => {
  vi.stubGlobal('localStorage', { getItem: () => 'old-token' })
  let calls = 0
  api.defaults.adapter = async (config) => {
    calls += 1
    throw new AxiosError('invalid login', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {}, config })
  }
  await expect(api.post('/auth/login/', {})).rejects.toThrow('invalid login')
  expect(calls).toBe(1)
})

describe('errorMessage', () => {
  it('uses a useful server detail message', () => {
    expect(errorMessage({ response: { data: { detail: 'Stock is unavailable.' } } })).toBe('Stock is unavailable.')
  })

  it('uses the first field validation error', () => {
    expect(errorMessage({ response: { data: { address: ['Enter a delivery address.'] } } })).toBe('Enter a delivery address.')
  })
})
