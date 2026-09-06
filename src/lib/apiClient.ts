type ErrorBody = {
  error?: unknown
}

function messageFromErrorBody(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback
  const message = (body as ErrorBody).error
  if (typeof message !== 'string' || !message.trim()) return fallback
  if (message.includes('OPENAI_API_KEY')) {
    return 'AI 服务尚未配置,请在部署环境设置 OPENAI_API_KEY。'
  }
  if (message.includes('no credits remaining') || message.includes('insufficient_quota')) {
    return 'OpenAI API 账户没有可用额度,请先在 OpenAI Platform 添加余额后重试。'
  }
  return message
}

export async function postJson(url: string, payload: unknown, fallback: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('无法连接 AI 服务,请检查网络后重试。')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (response.status === 404) {
      throw new Error('本地开发环境未启动 AI 接口,请使用 vercel dev 或部署后的地址测试。')
    }
    throw new Error('AI 服务返回了无法读取的响应,请稍后重试。')
  }

  if (!response.ok) throw new Error(messageFromErrorBody(body, fallback))
  return body
}
