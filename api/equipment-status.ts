import type { VercelRequest, VercelResponse } from '@vercel/node'

// Configuration readiness only; never probes OpenAI or exposes credential values.
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: '仅支持 GET 请求。' }); return }
  const publicDeployment = ['production', 'preview'].includes(process.env.VERCEL_ENV ?? '')
  const configured = Boolean(process.env.OPENAI_API_KEY?.trim())
  const accessRequired = Boolean(process.env.GYM_DEMO_ACCESS_CODE)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  const redisReady = Boolean(redisUrl && redisToken)
  const partialRedis = Boolean(redisUrl || redisToken) && !redisReady
  const limiterReady = !partialRedis && (redisReady || (!publicDeployment && process.env.AI_ALLOW_LOCAL_MEMORY_GUARD !== 'false'))
  const protectionConfigured = limiterReady && (!publicDeployment || (
    (process.env.GYM_DEMO_ACCESS_CODE?.length ?? 0) >= 16 &&
    (process.env.AI_AUDIT_HASH_SALT?.length ?? 0) >= 16
  ))
  res.status(200).json({ available: configured && protectionConfigured, accessRequired, message: !configured ? '识别服务尚未配置，可先手动选择。' : !protectionConfigured ? '识别服务保护配置未完成，可先手动选择。' : '识别接口已连接。上传后才发起识别，实际结果以本次响应为准。' })
}
