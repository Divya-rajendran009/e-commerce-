// Usage: node scripts/verify-deployment.mjs https://your-deployment.vercel.app
// Read-only checks. No authentication credentials or customer data are used.
const base = new URL(process.argv[2] || 'http://127.0.0.1:5173')
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Provide an HTTP(S) deployment URL.')
if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Provide the deployment origin, without credentials, paths or query parameters.')
const checks = [
  ['/api/health/', data => data?.status === 'ok' && data?.service === 'pandiyan-api'],
  ['/api/v1/categories/', data => Array.isArray(data) || Array.isArray(data?.results)],
  ['/api/v1/products/', data => Array.isArray(data) || Array.isArray(data?.results)],
  ['/api/v1/system-settings/public/', data => typeof data?.store_name === 'string' && Array.isArray(data?.delivery_pin_codes)],
]
let failed = false
for (const [path, validate] of checks) {
  try {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000), redirect: 'follow', headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Expected JSON; check the project root and API service routing.')
    if (!validate(await response.json())) throw new Error('Unexpected API response shape.')
    console.log(`PASS ${path}`)
  } catch (error) { failed = true; console.error(`FAIL ${path}: ${error.message}`) }
}
try {
  const response = await fetch(new URL('/products', base), { signal: AbortSignal.timeout(20000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !(await response.text()).includes('id="root"')) throw new Error('The storefront deep link did not return the React application.')
  console.log('PASS /products (SPA deep link)')
} catch (error) { failed = true; console.error(`FAIL /products: ${error.message}`) }
process.exitCode = failed ? 1 : 0
