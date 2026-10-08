import {
  __getDemoSafetyMemorySnapshotForTests,
  __resetDemoSafetyMemoryForTests,
  authorizeAiRequest,
  finalizeAiRequest,
} from '../api/_lib/demoSafety.ts'

type MockResponse = {
  statusCode: number
  body: unknown
  headers: Map<string, string>
  setHeader(name: string, value: string): void
  status(code: number): MockResponse
  json(body: unknown): MockResponse
}

function response(): MockResponse {
  return {
    statusCode: 200,
    body: null,
    headers: new Map(),
    setHeader(name, value) { this.headers.set(name.toLowerCase(), String(value)) },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

function request(ip: string, accessCode?: string) {
  return {
    headers: { 'x-forwarded-for': ip, ...(accessCode ? { 'x-gym-access-code': accessCode } : {}) },
    socket: { remoteAddress: ip },
  }
}

const envNames = [
  'VERCEL_ENV', 'GYM_DEMO_ACCESS_CODE', 'AI_AUDIT_HASH_SALT',
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL', 'KV_REST_API_TOKEN',
  'AI_ALLOW_LOCAL_MEMORY_GUARD', 'AI_REQUESTS_PER_MINUTE',
  'AI_DAILY_REQUEST_LIMIT', 'AI_DAILY_BUDGET_MICRO_USD',
  'AI_REQUEST_RESERVE_MICRO_USD', 'AI_BUDGET_ALERT_PERCENT',
  'AI_BUDGET_ALERT_WEBHOOK_URL',
] as const
const saved = Object.fromEntries(envNames.map((name) => [name, process.env[name]]))
const clear = () => envNames.forEach((name) => delete process.env[name])
let passed = 0
let warningCount = 0
const originalWarn = console.warn
const originalFetch = globalThis.fetch

function expect(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAIL ${label}`)
  passed += 1
  console.log(`PASS ${label}`)
}

try {
  clear()
  __resetDemoSafetyMemoryForTests()
  process.env.VERCEL_ENV = 'production'
  let res = response()
  let permit = await authorizeAiRequest(request('198.51.100.1') as never, res as never, 'test')
  expect(permit === null && res.statusCode === 503, '公开部署缺少访问码时 fail closed')

  process.env.GYM_DEMO_ACCESS_CODE = 'too-short'
  res = response()
  permit = await authorizeAiRequest(request('198.51.100.1', 'too-short') as never, res as never, 'test')
  expect(permit === null && res.statusCode === 503, '公开部署拒绝过短访问码')

  process.env.GYM_DEMO_ACCESS_CODE = 'correct-test-code'
  res = response()
  permit = await authorizeAiRequest(request('198.51.100.2', 'wrong') as never, res as never, 'test')
  expect(permit === null && res.statusCode === 401, '错误访问码被拒绝')

  res = response()
  permit = await authorizeAiRequest(request('198.51.100.2', 'correct-test-code') as never, res as never, 'test')
  expect(permit === null && res.statusCode === 503, '公开部署缺少脱敏与共享存储时 fail closed')

  const redisValues = new Map<string, number | string>()
  const redisLists = new Map<string, string[]>()
  globalThis.fetch = async (_input, init) => {
    const commands = JSON.parse(String(init?.body)) as Array<Array<string | number>>
    const result = commands.map((command) => {
      const operation = String(command[0]).toUpperCase()
      const key = String(command[1])
      if (operation === 'INCR' || operation === 'INCRBY' || operation === 'DECRBY') {
        const delta = operation === 'INCR' ? 1 : Number(command[2]) * (operation === 'DECRBY' ? -1 : 1)
        const value = Number(redisValues.get(key) ?? 0) + delta
        redisValues.set(key, value)
        return { result: value }
      }
      if (operation === 'GET') return { result: redisValues.get(key) ?? null }
      if (operation === 'EXPIRE' || operation === 'LTRIM') return { result: 1 }
      if (operation === 'SET') {
        if (redisValues.has(key)) return { result: null }
        redisValues.set(key, String(command[2]))
        return { result: 'OK' }
      }
      if (operation === 'LPUSH') {
        const list = redisLists.get(key) ?? []
        list.unshift(String(command[2]))
        redisLists.set(key, list)
        return { result: list.length }
      }
      return { error: `Unsupported fake Redis command: ${operation}` }
    })
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  process.env.AI_AUDIT_HASH_SALT = 'independent-audit-salt-value'
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-test-token'
  process.env.AI_REQUESTS_PER_MINUTE = '1'
  process.env.AI_DAILY_REQUEST_LIMIT = '10'
  process.env.AI_DAILY_BUDGET_MICRO_USD = '1000000'
  process.env.AI_REQUEST_RESERVE_MICRO_USD = '25000'
  res = response()
  permit = await authorizeAiRequest(request('198.51.100.3', 'correct-test-code') as never, res as never, 'public-test')
  expect(permit?.backend === 'upstash', '公开部署使用 Upstash 跨实例保护')
  if (permit) await finalizeAiRequest(permit, {
    status: 200,
    outcome: 'success',
    metadata: {
      responseId: 'resp-public-test',
      model: 'gpt-5-mini-2025-08-07',
      usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
    },
  })
  const publicAudit = JSON.parse(redisLists.get('gym:ai:audit')?.[0] ?? '{}') as Record<string, unknown>
  expect(publicAudit.response_id === 'resp-public-test' && !JSON.stringify(publicAudit).includes('198.51.100.3'), 'Upstash 审计写入模型证据且不含原始 IP')
  const publicLimitRes = response()
  const publicLimitPermit = await authorizeAiRequest(request('198.51.100.3', 'correct-test-code') as never, publicLimitRes as never, 'public-test')
  expect(publicLimitPermit === null && publicLimitRes.statusCode === 429, '公开部署跨实例限流拒绝超额请求')

  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  process.env.KV_REST_API_URL = 'https://fake-upstash.example'
  process.env.KV_REST_API_TOKEN = 'fake-test-token'
  process.env.AI_REQUESTS_PER_MINUTE = '100'
  const aliasRes = response()
  const aliasPermit = await authorizeAiRequest(request('198.51.100.4', 'correct-test-code') as never, aliasRes as never, 'alias-test')
  expect(aliasPermit?.backend === 'upstash', '兼容 Vercel Marketplace 的 KV REST 变量名')
  if (aliasPermit) await finalizeAiRequest(aliasPermit, { status: 500, outcome: 'upstream_failed' })

  clear()
  globalThis.fetch = originalFetch
  __resetDemoSafetyMemoryForTests()
  process.env.VERCEL_ENV = 'development'
  process.env.AI_REQUESTS_PER_MINUTE = '2'
  process.env.AI_DAILY_REQUEST_LIMIT = '100'
  process.env.AI_DAILY_BUDGET_MICRO_USD = '1000000'
  process.env.AI_REQUEST_RESERVE_MICRO_USD = '1000'
  for (let index = 0; index < 2; index += 1) {
    res = response()
    permit = await authorizeAiRequest(request('203.0.113.10') as never, res as never, 'test')
    expect(Boolean(permit), `本地内存限流允许第 ${index + 1} 次请求`)
    if (permit) await finalizeAiRequest(permit, {
      status: 200,
      outcome: 'success',
      metadata: {
        responseId: `resp-test-${index}`,
        model: 'gpt-5-mini-2025-08-07',
        usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 5, reasoningTokens: 0, totalTokens: 15 },
      },
    })
  }
  res = response()
  permit = await authorizeAiRequest(request('203.0.113.10') as never, res as never, 'test')
  expect(permit === null && res.statusCode === 429, '本地内存限流拒绝超额请求')
  expect(res.headers.has('x-ai-ratelimit-limit'), '限流响应包含可观测头')
  const snapshot = __getDemoSafetyMemorySnapshotForTests()
  const audit = snapshot.audit.map((item) => JSON.parse(item) as Record<string, unknown>)
  const expectedAuditKeys = ['at', 'trace_id', 'route', 'client_hash', 'status', 'outcome', 'model', 'response_id', 'total_tokens', 'cost_micro_usd', 'latency_ms'].sort()
  expect(audit.length === 2 && audit.every((event) => JSON.stringify(Object.keys(event).sort()) === JSON.stringify(expectedAuditKeys)), '审计只包含允许字段')
  expect(!snapshot.audit.join('').includes('203.0.113.10') && !snapshot.audit.join('').includes('correct-test-code'), '审计不包含原始 IP 或访问码')

  __resetDemoSafetyMemoryForTests()
  process.env.AI_REQUESTS_PER_MINUTE = '100'
  process.env.AI_DAILY_BUDGET_MICRO_USD = '1000'
  process.env.AI_REQUEST_RESERVE_MICRO_USD = '600'
  const firstRes = response()
  const first = await authorizeAiRequest(request('203.0.113.20') as never, firstRes as never, 'budget-test')
  expect(Boolean(first), '预算预留允许首个并发请求')
  console.warn = () => { warningCount += 1 }
  const secondRes = response()
  const second = await authorizeAiRequest(request('203.0.113.21') as never, secondRes as never, 'budget-test')
  expect(second === null && secondRes.statusCode === 429 && (secondRes.body as { code?: string })?.code === 'AI_DAILY_BUDGET_EXCEEDED', '预算预留阻止并发超支')
  if (first) await finalizeAiRequest(first, { status: 500, outcome: 'upstream_failed' })
  const thirdRes = response()
  await authorizeAiRequest(request('203.0.113.22') as never, thirdRes as never, 'budget-test')
  expect(warningCount === 1 && __getDemoSafetyMemorySnapshotForTests().alertKeys.length === 1, '预算告警在同一天去重')
  const budgetSnapshot = __getDemoSafetyMemorySnapshotForTests()
  const day = Object.values(budgetSnapshot.days)[0]
  expect(Boolean(day && day.spentMicros === 600), '无 usage 的上游失败按预留成本保守记账')

  console.log(`PASS ${passed}/${passed}; demo safety fail-closed, access, rate and budget checks`)
} finally {
  console.warn = originalWarn
  globalThis.fetch = originalFetch
  clear()
  for (const [name, value] of Object.entries(saved)) if (value !== undefined) process.env[name] = value
}
