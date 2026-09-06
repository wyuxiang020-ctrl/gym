import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AIResponseMetadata } from './openai.js'

type Backend = 'upstash' | 'memory'

export type AiRequestPermit = {
  backend: Backend
  traceId: string
  route: string
  clientHash: string
  dayKey: string
  reserveMicros: number
  startedAt: number
}

type FinalizeInput = {
  status: number
  outcome: 'success' | 'model_parse_failed' | 'model_validation_failed' | 'upstream_failed'
  metadata?: AIResponseMetadata
}

const memoryMinute = new Map<string, { count: number; resetAt: number }>()
const memoryDay = new Map<string, { requests: number; reservedMicros: number; spentMicros: number }>()
const memoryAudit: string[] = []
const memoryAlerts = new Set<string>()
const MAX_MEMORY_CLIENTS = 10_000
const MAX_AUDIT_EVENTS = 1_000
const MIN_PUBLIC_SECRET_CHARACTERS = 16

function envInt(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback
}

function isPublicDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview'
}

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function clientIp(req: VercelRequest): string {
  const forwarded = header(req, 'x-forwarded-for')?.split(',')[0]?.trim()
  return (forwarded || header(req, 'x-real-ip') || req.socket.remoteAddress || 'unknown').slice(0, 128)
}

function secureEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest()
  const rightHash = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftHash, rightHash)
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function secondsUntilUtcDayEnds(now = new Date()): number {
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1_000) + 86_400)
}

function sendError(res: VercelResponse, status: number, error: string, code: string): null {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json({ error, code })
  return null
}

function hashClient(req: VercelRequest): string | null {
  const salt = process.env.AI_AUDIT_HASH_SALT
  if ((!salt || salt.length < MIN_PUBLIC_SECRET_CHARACTERS) && isPublicDeployment()) return null
  return createHash('sha256')
    .update(`${salt || 'gym-local-development-only'}:${clientIp(req)}`)
    .digest('hex')
    .slice(0, 24)
}

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)?.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

async function redisPipeline(commands: Array<Array<string | number>>): Promise<Array<{ result?: unknown; error?: string }>> {
  const config = redisConfig()
  if (!config) throw new Error('Upstash REST is not configured')
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Upstash REST returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload) || payload.some((item) => item?.error)) throw new Error('Upstash pipeline failed')
  return payload
}

function redisNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('Upstash returned a non-numeric counter')
  return parsed
}

function cleanupMemory(now: number) {
  if (memoryMinute.size < 1_000) return
  for (const [key, value] of memoryMinute) if (value.resetAt <= now) memoryMinute.delete(key)
  while (memoryMinute.size >= MAX_MEMORY_CLIENTS) {
    const oldest = memoryMinute.keys().next().value
    if (typeof oldest !== 'string') break
    memoryMinute.delete(oldest)
  }
}

async function reserveMemory(permit: AiRequestPermit, perMinute: number, dailyRequests: number, dailyBudgetMicros: number) {
  const now = Date.now()
  cleanupMemory(now)
  const minuteKey = `${permit.clientHash}:${Math.floor(now / 60_000)}`
  const minute = memoryMinute.get(minuteKey) ?? { count: 0, resetAt: now + 60_000 }
  minute.count += 1
  memoryMinute.set(minuteKey, minute)
  const day = memoryDay.get(permit.dayKey) ?? { requests: 0, reservedMicros: 0, spentMicros: 0 }
  day.requests += 1
  day.reservedMicros += permit.reserveMicros
  memoryDay.set(permit.dayKey, day)
  return {
    minuteCount: minute.count,
    minuteResetAt: minute.resetAt,
    dailyCount: day.requests,
    projectedMicros: day.spentMicros + day.reservedMicros,
    allowed: minute.count <= perMinute && day.requests <= dailyRequests && day.spentMicros + day.reservedMicros <= dailyBudgetMicros,
  }
}

async function releaseReservation(permit: AiRequestPermit) {
  if (permit.backend === 'memory') {
    const day = memoryDay.get(permit.dayKey)
    if (day) day.reservedMicros = Math.max(0, day.reservedMicros - permit.reserveMicros)
    return
  }
  const ttl = secondsUntilUtcDayEnds()
  await redisPipeline([
    ['DECRBY', `gym:ai:${permit.dayKey}:reserved_micro_usd`, permit.reserveMicros],
    ['EXPIRE', `gym:ai:${permit.dayKey}:reserved_micro_usd`, ttl],
  ])
}

async function maybeSendBudgetAlert(permit: AiRequestPermit, projectedMicros: number, budgetMicros: number, blocked: boolean) {
  const thresholdPercent = envInt('AI_BUDGET_ALERT_PERCENT', 80, 1, 100)
  if (projectedMicros * 100 < budgetMicros * thresholdPercent && !blocked) return
  const alertKey = `gym:ai:${permit.dayKey}:budget_alert:${thresholdPercent}`
  let shouldSend = false
  try {
    if (permit.backend === 'memory') {
      if (!memoryAlerts.has(alertKey)) {
        memoryAlerts.add(alertKey)
        shouldSend = true
      }
    } else {
      const result = await redisPipeline([['SET', alertKey, '1', 'EX', secondsUntilUtcDayEnds(), 'NX']])
      shouldSend = result[0]?.result === 'OK'
    }
  } catch (error) {
    console.error('AI budget alert dedupe failed', error instanceof Error ? error.message : 'unknown error')
    return
  }
  if (!shouldSend) return

  const payload = {
    event: 'gym_ai_budget_alert', day_utc: permit.dayKey, threshold_percent: thresholdPercent,
    projected_usd: projectedMicros / 1_000_000, budget_usd: budgetMicros / 1_000_000,
    request_blocked: blocked,
  }
  const webhook = process.env.AI_BUDGET_ALERT_WEBHOOK_URL
  if (!webhook) {
    console.warn('AI daily budget alert', payload)
    return
  }
  try {
    const response = await fetch(webhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) console.error(`AI budget alert webhook returned HTTP ${response.status}`)
  } catch (error) {
    console.error('AI budget alert webhook failed', error instanceof Error ? error.message : 'unknown error')
  }
}

export async function authorizeAiRequest(req: VercelRequest, res: VercelResponse, route: string): Promise<AiRequestPermit | null> {
  const accessCode = process.env.GYM_DEMO_ACCESS_CODE
  if (accessCode && (!isPublicDeployment() || accessCode.length >= MIN_PUBLIC_SECRET_CHARACTERS)) {
    const supplied = header(req, 'x-gym-access-code') ?? ''
    if (!supplied || !secureEqual(supplied, accessCode)) return sendError(res, 401, '请输入有效的演示访问码后重试。', 'DEMO_ACCESS_REQUIRED')
  } else if (isPublicDeployment()) {
    return sendError(res, 503, '公开演示尚未配置访问保护。', 'DEMO_SAFETY_NOT_CONFIGURED')
  }

  const clientHash = hashClient(req)
  if (!clientHash) return sendError(res, 503, '公开演示缺少审计脱敏配置。', 'DEMO_SAFETY_NOT_CONFIGURED')
  const redis = redisConfig()
  const partialRedisConfig = Boolean(
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_URL ||
    process.env.KV_REST_API_TOKEN,
  ) && !redis
  const allowMemory = !isPublicDeployment() && process.env.AI_ALLOW_LOCAL_MEMORY_GUARD !== 'false'
  if (partialRedisConfig || (!redis && !allowMemory)) return sendError(res, 503, '共享限流尚未配置，请联系演示维护者。', 'DEMO_SAFETY_NOT_CONFIGURED')

  const perMinute = envInt('AI_REQUESTS_PER_MINUTE', 20, 1, 1_000)
  const dailyRequests = envInt('AI_DAILY_REQUEST_LIMIT', 200, 1, 100_000)
  const dailyBudgetMicros = envInt('AI_DAILY_BUDGET_MICRO_USD', 2_000_000, 1_000, 1_000_000_000)
  const reserveMicros = envInt('AI_REQUEST_RESERVE_MICRO_USD', 25_000, 100, 10_000_000)
  const dayKey = utcDay()
  const permit: AiRequestPermit = { backend: redis ? 'upstash' : 'memory', traceId: randomUUID(), route, clientHash, dayKey, reserveMicros, startedAt: Date.now() }

  try {
    let counters: {
      minuteCount: number
      minuteResetAt: number
      dailyCount: number
      projectedMicros: number
      allowed: boolean
    }
    if (redis) {
      const minuteBucket = Math.floor(Date.now() / 60_000)
      const minuteKey = `gym:ai:minute:${clientHash}:${minuteBucket}`
      const requestKey = `gym:ai:${dayKey}:requests`
      const reserveKey = `gym:ai:${dayKey}:reserved_micro_usd`
      const spendKey = `gym:ai:${dayKey}:spent_micro_usd`
      const ttl = secondsUntilUtcDayEnds()
      const result = await redisPipeline([
        ['INCR', minuteKey], ['EXPIRE', minuteKey, 120, 'NX'],
        ['INCR', requestKey], ['EXPIRE', requestKey, ttl, 'NX'],
        ['INCRBY', reserveKey, reserveMicros], ['EXPIRE', reserveKey, ttl, 'NX'],
        ['GET', spendKey],
      ])
      const minuteCount = redisNumber(result[0]?.result)
      const dailyCount = redisNumber(result[2]?.result)
      const projectedMicros = redisNumber(result[4]?.result) + redisNumber(result[6]?.result ?? 0)
      counters = {
        minuteCount,
        minuteResetAt: (minuteBucket + 1) * 60_000,
        dailyCount,
        projectedMicros,
        allowed: minuteCount <= perMinute && dailyCount <= dailyRequests && projectedMicros <= dailyBudgetMicros,
      }
    } else {
      counters = await reserveMemory(permit, perMinute, dailyRequests, dailyBudgetMicros)
    }

    res.setHeader('X-AI-RateLimit-Limit', String(perMinute))
    res.setHeader('X-AI-RateLimit-Remaining', String(Math.max(0, perMinute - counters.minuteCount)))
    res.setHeader('X-AI-RateLimit-Reset', String(Math.ceil(counters.minuteResetAt / 1_000)))
    res.setHeader('X-AI-Daily-Remaining', String(Math.max(0, dailyRequests - counters.dailyCount)))
    const budgetExceeded = counters.projectedMicros > dailyBudgetMicros
    await maybeSendBudgetAlert(permit, counters.projectedMicros, dailyBudgetMicros, budgetExceeded)
    if (!counters.allowed) {
      await releaseReservation(permit)
      return sendError(res, 429, budgetExceeded ? '今天的 AI 演示预算已用完，请明天再试。' : 'AI 演示请求过于频繁，请稍后再试。', budgetExceeded ? 'AI_DAILY_BUDGET_EXCEEDED' : 'AI_RATE_LIMITED')
    }
    return permit
  } catch (error) {
    console.error('AI demo safety backend unavailable', error instanceof Error ? error.message : 'unknown error')
    return sendError(res, 503, 'AI 演示保护服务暂时不可用，请稍后再试。', 'DEMO_SAFETY_UNAVAILABLE')
  }
}

function costMicros(metadata: AIResponseMetadata | undefined, conservativeFallback: number): number {
  const usage = metadata?.usage
  if (!usage) return conservativeFallback
  const cached = usage.cachedInputTokens ?? 0
  const uncached = Math.max(0, usage.inputTokens - cached)
  const usd = (uncached * 0.25 + cached * 0.025 + usage.outputTokens * 2) / 1_000_000
  return Math.max(0, Math.round(usd * 1_000_000))
}

export async function finalizeAiRequest(permit: AiRequestPermit, input: FinalizeInput): Promise<void> {
  // If the upstream connection failed after a request may have reached the model,
  // keep the full reservation as spend rather than assuming a free request.
  const actualMicros = costMicros(input.metadata, permit.reserveMicros)
  const event = JSON.stringify({
    at: new Date().toISOString(), trace_id: permit.traceId, route: permit.route,
    client_hash: permit.clientHash, status: input.status, outcome: input.outcome,
    model: input.metadata?.model ?? null, response_id: input.metadata?.responseId ?? null,
    total_tokens: input.metadata?.usage?.totalTokens ?? null, cost_micro_usd: actualMicros,
    latency_ms: Date.now() - permit.startedAt,
  })
  try {
    if (permit.backend === 'memory') {
      const day = memoryDay.get(permit.dayKey)
      if (day) {
        day.reservedMicros = Math.max(0, day.reservedMicros - permit.reserveMicros)
        day.spentMicros += actualMicros
        await maybeSendBudgetAlert(
          permit,
          day.spentMicros + day.reservedMicros,
          envInt('AI_DAILY_BUDGET_MICRO_USD', 2_000_000, 1_000, 1_000_000_000),
          day.spentMicros + day.reservedMicros > envInt('AI_DAILY_BUDGET_MICRO_USD', 2_000_000, 1_000, 1_000_000_000),
        )
      }
      memoryAudit.unshift(event)
      if (memoryAudit.length > MAX_AUDIT_EVENTS) memoryAudit.length = MAX_AUDIT_EVENTS
      return
    }
    const ttl = secondsUntilUtcDayEnds()
    const result = await redisPipeline([
      ['DECRBY', `gym:ai:${permit.dayKey}:reserved_micro_usd`, permit.reserveMicros],
      ['INCRBY', `gym:ai:${permit.dayKey}:spent_micro_usd`, actualMicros],
      ['EXPIRE', `gym:ai:${permit.dayKey}:spent_micro_usd`, ttl],
      ['LPUSH', 'gym:ai:audit', event],
      ['LTRIM', 'gym:ai:audit', 0, MAX_AUDIT_EVENTS - 1],
      ['EXPIRE', 'gym:ai:audit', 2_592_000],
    ])
    const projectedMicros = Math.max(0, redisNumber(result[0]?.result)) + redisNumber(result[1]?.result)
    const dailyBudgetMicros = envInt('AI_DAILY_BUDGET_MICRO_USD', 2_000_000, 1_000, 1_000_000_000)
    await maybeSendBudgetAlert(permit, projectedMicros, dailyBudgetMicros, projectedMicros > dailyBudgetMicros)
  } catch (error) {
    console.error('AI demo audit write failed', error instanceof Error ? error.message : 'unknown error')
  }
}

export function __getDemoSafetyMemorySnapshotForTests() {
  return {
    days: structuredClone(Object.fromEntries(memoryDay)),
    audit: [...memoryAudit],
    alertKeys: [...memoryAlerts],
  }
}

export function __resetDemoSafetyMemoryForTests(): void {
  memoryMinute.clear()
  memoryDay.clear()
  memoryAudit.length = 0
  memoryAlerts.clear()
}
