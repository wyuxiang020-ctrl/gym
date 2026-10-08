import './ts-test-loader.mjs'
import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { request } from 'node:http'
import { createEquipmentHttpServer } from './equipment-http.mjs'
const { getEquipmentHandoff, saveEquipmentHandoff, clearEquipmentHandoff } = await import('../src/lib/store.ts')

for (const key of ['OPENAI_API_KEY', 'VERCEL_ENV', 'GYM_DEMO_ACCESS_CODE', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'AI_BUDGET_ALERT_WEBHOOK_URL']) delete process.env[key]
Object.assign(process.env, { AI_ALLOW_LOCAL_MEMORY_GUARD: 'true', AI_DAILY_REQUEST_LIMIT: '20', AI_REQUESTS_PER_MINUTE: '20', AI_DAILY_BUDGET_MICRO_USD: '2000000' })
let modelCalls = 0
const candidate = { equipmentId: 'seated_chest_press', confidence: 'mid', evidence: ['固定响应测试'], uncertain: '未进行真实识别' }
globalThis.__equipmentHttpModel = async () => { modelCalls++; return { value: candidate, metadata: { model: 'fixed', responseId: 'fixed', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } } } }
registerHooks({ load(url, context, next) {
  if (url.endsWith('/api/_lib/openai.ts')) return { format: 'module', shortCircuit: true, source: 'export const askOpenAIForJson = options => globalThis.__equipmentHttpModel(options)' }
  return next(url, context)
} })
const { default: identify } = await import('../api/identify-equipment.ts')
const { default: status } = await import('../api/equipment-status.ts')
const port = 4187
const server = createEquipmentHttpServer({ identify, status, port })
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${port}`
const jpeg = (await sharp({ create: { width: 20, height: 20, channels: 3, background: '#cccccc' } }).jpeg().toBuffer()).toString('base64')
const payload = { imageBase64: jpeg, mediaType: 'image/jpeg' }
const results = []
async function test(name, run) { const row = { name, pass: false }; try { await run(); row.pass = true } catch (error) { row.error = error.message; process.exitCode = 1 } results.push(row); console.log(JSON.stringify(row)) }
const post = (body, headers = {}) => fetch(`${base}/api/identify-equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const rawPost = headers => new Promise((resolve, reject) => {
  const req = request(`${base}/api/identify-equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
  req.on('error', reject); req.end(JSON.stringify(payload))
})
try {
  await test('configuration status never calls the model or discloses keys', async () => {
    let response = await fetch(`${base}/api/equipment-status`); assert.equal((await response.json()).available, false)
    process.env.OPENAI_API_KEY = 'synthetic-placeholder-never-used'
    response = await fetch(`${base}/api/equipment-status`); const text = await response.text(); assert.equal(JSON.parse(text).available, true); assert.ok(!text.includes(process.env.OPENAI_API_KEY)); assert.equal(modelCalls, 0)
  })
  await test('host and browser origin checks precede model calls', async () => {
    assert.equal(await rawPost({ Origin: 'https://other-site.example' }), 403, 'Origin')
    assert.equal(await rawPost({ Host: 'other-site.example' }), 403, 'Host')
    assert.equal(await rawPost({ 'Sec-Fetch-Site': 'cross-site' }), 403, 'Sec-Fetch-Site'); assert.equal(modelCalls, 0)
  })
  await test('readiness matches disabled or partial local guards without model calls', async () => {
    for (const patch of [{ AI_ALLOW_LOCAL_MEMORY_GUARD: 'false' }, { UPSTASH_REDIS_REST_URL: 'https://unused.invalid' }, { KV_REST_API_TOKEN: 'synthetic-unused' }, { VERCEL_ENV: 'preview' }]) {
      const original = Object.fromEntries(Object.keys(patch).map(key => [key, process.env[key]]))
      Object.assign(process.env, patch)
      try {
        assert.equal((await (await fetch(`${base}/api/equipment-status`)).json()).available, false)
        assert.equal((await post(payload)).status, 503)
        assert.equal(modelCalls, 0)
      } finally { for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } }
    }
  })
  await test('HTTP malformed JSON and bounded bodies', async () => {
    assert.equal((await fetch(`${base}/api/identify-equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400)
    assert.equal((await post({ huge: 'x'.repeat(4 * 1024 * 1024 + 5000) })).status, 413)
    assert.equal((await fetch(`${base}/api/other`)).status, 404); assert.equal(modelCalls, 0)
  })
  await test('real HTTP adapter to guarded handler with fixed upstream', async () => {
    const response = await post(payload, { Origin: 'http://127.0.0.1:4175' }); assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).result, candidate); assert.equal(modelCalls, 1)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  })
  await test('access code guard applies through HTTP', async () => {
    process.env.GYM_DEMO_ACCESS_CODE = 'test-only-code'
    assert.equal((await post(payload)).status, 401)
    assert.equal((await post(payload, { 'X-Gym-Access-Code': 'test-only-code' })).status, 200); assert.equal(modelCalls, 2)
  })
  await test('handoff is bounded, expiring and excludes photos', () => {
    const map = new Map(); globalThis.sessionStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }
    assert.equal(saveEquipmentHandoff(true), true); assert.equal(getEquipmentHandoff().modelMatched, true)
    const [key, raw] = [...map][0]; assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['confirmedAt', 'equipmentId', 'modelMatched'])
    for (const patch of [{ confirmedAt: Date.now() - 31 * 60000 }, { confirmedAt: Date.now() + 100000 }, { equipmentId: 'invented' }]) { map.set(key, JSON.stringify({ ...JSON.parse(raw), ...patch })); assert.equal(getEquipmentHandoff(), null) }
    clearEquipmentHandoff(); assert.equal(getEquipmentHandoff(), null)
    globalThis.sessionStorage.setItem = () => { throw new Error('quota') }; assert.equal(saveEquipmentHandoff(false), false)
  })
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
const out = `evals/equipment-scan/http-${Date.now()}`; mkdirSync(out, { recursive: true })
writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'loopback HTTP, synthetic image, fixed upstream; no real cloud calls', results }, null, 2)); console.log(out)
