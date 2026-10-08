import './ts-test-loader.mjs'
import { registerHooks } from 'node:module'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { validateEquipmentResult } from '../src/lib/equipment.ts'

const good = { equipmentId: 'seated_chest_press', confidence: 'mid', evidence: ['合成返回：座椅与推臂可见'], uncertain: '固定响应，仅测软件，未识别真实器械。' }
const meta = { model: 'fixed-test-response', responseId: 'test-only', sdkMaxRetries: 0, timeoutMs: 110000, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
let calls = 0
globalThis.__equipmentModel = async options => { calls++; assert.equal(options.schemaName, 'equipment_candidate'); assert.equal(options.input[1].type, 'input_image'); return { value: good, metadata: meta } }
registerHooks({ load(url, context, next) {
  if (url.endsWith('/api/_lib/openai.ts')) return { format: 'module', shortCircuit: true, source: 'export const askOpenAIForJson = options => globalThis.__equipmentModel(options)' }
  return next(url, context)
} })
// Isolated process; no .env loading, live upstream, Redis or alerts.
for (const key of ['VERCEL_ENV', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'AI_BUDGET_ALERT_WEBHOOK_URL']) delete process.env[key]
Object.assign(process.env, { GYM_DEMO_ACCESS_CODE: 'equipment-test-only', AI_ALLOW_LOCAL_MEMORY_GUARD: 'true', AI_DAILY_REQUEST_LIMIT: '20', AI_DAILY_BUDGET_MICRO_USD: '2000000', AI_REQUEST_RESERVE_MICRO_USD: '25000' })
globalThis.fetch = () => { throw new Error('External calls are forbidden in this test') }
const { default: handler } = await import('../api/identify-equipment.ts')
const { __resetDemoSafetyMemoryForTests: reset } = await import('../api/_lib/demoSafety.ts')
const jpeg = (await sharp({ create: { width: 32, height: 32, channels: 3, background: '#eeeeee' } }).jpeg().toBuffer()).toString('base64')
const body = { mediaType: 'image/jpeg', imageBase64: jpeg }
async function invoke(overrides = {}) {
  const req = { method: 'POST', headers: { 'content-type': 'application/json', 'x-gym-access-code': 'equipment-test-only' }, socket: { remoteAddress: '127.0.0.1' }, body, ...overrides }
  const res = { statusCode: 200, headers: {}, payload: null, setHeader(key, value) { this.headers[key] = value }, status(value) { this.statusCode = value; return this }, json(value) { this.payload = value; return this } }
  await handler(req, res); return res
}
const results = []
async function test(name, run) { reset(); const row = { name, pass: false }; try { await run(); row.pass = true } catch (error) { row.error = error.message; process.exitCode = 1 } results.push(row); console.log(JSON.stringify(row)) }
await test('bounded candidate and unknown contracts', () => {
  assert.deepEqual(validateEquipmentResult(good), good)
  assert.equal(validateEquipmentResult({ ...good, equipmentId: 'unknown', confidence: 'low', evidence: [] }).equipmentId, 'unknown')
  for (const patch of [{ equipmentId: 'shoulder_press' }, { confidence: 0.9 }, { evidence: [] }, { uncertain: '' }, { evidence: ['x'.repeat(161)] }, { tutorial: 'invented' }, { equipmentId: 'unknown', confidence: 'high' }]) assert.throws(() => validateEquipmentResult({ ...good, ...patch }))
})
await test('method, content type and invalid image never reach model', async () => {
  const before = calls
  assert.equal((await invoke({ method: 'GET' })).statusCode, 405)
  assert.equal((await invoke({ headers: { 'content-type': 'text/plain' } })).statusCode, 415)
  assert.equal((await invoke({ body: { imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' } })).statusCode, 400)
  assert.equal((await invoke({ body: { ...body, mediaType: 'image/png' } })).statusCode, 400)
  assert.equal(calls, before)
})
await test('access guard stops valid images before model', async () => {
  const before = calls
  const response = await invoke({ headers: { 'content-type': 'application/json' } })
  assert.equal(response.statusCode, 401); assert.equal(calls, before)
})
await test('one guarded call with normalized image and no-store', async () => {
  const before = calls; const response = await invoke()
  assert.equal(calls, before + 1); assert.equal(response.statusCode, 200)
  assert.deepEqual(response.payload.result, good); assert.equal(response.headers['Cache-Control'], 'no-store')
})
await test('malformed model output is 422, not a guessed candidate', async () => {
  globalThis.__equipmentModel = async () => ({ value: { ...good, equipmentId: 'invented' }, metadata: meta })
  const response = await invoke(); assert.equal(response.statusCode, 422); assert.ok(response.payload.rawText); assert.equal(response.payload.result, undefined)
})
await test('upstream error has no retry', async () => {
  let failures = 0; globalThis.__equipmentModel = async () => { failures++; throw new Error('fixed upstream failure') }
  assert.equal((await invoke()).statusCode, 500); assert.equal(failures, 1)
})
await test('daily request ceiling protects new endpoint', async () => {
  process.env.AI_DAILY_REQUEST_LIMIT = '1'
  globalThis.__equipmentModel = async () => ({ value: good, metadata: meta })
  assert.equal((await invoke()).statusCode, 200); assert.equal((await invoke()).statusCode, 429)
})
const out = `evals/equipment-scan/contracts-${Date.now()}`; mkdirSync(out, { recursive: true })
writeFileSync(`${out}/results.json`, JSON.stringify({ kind: 'fixed model responses and synthetic pixels; no live recognition', modelCalls: 0, results }, null, 2))
console.log(out)
