import { createServer } from 'node:http'

export function createEquipmentHttpServer({ identify, status, port = 4177 }) {
  const allowedOrigins = new Set([4175, 4177, 5173, 3000].flatMap(value => [`http://127.0.0.1:${value}`, `http://localhost:${value}`]))
  const server = createServer(async (req, res) => {
    const send = (code, payload) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)) } }
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) { send(403, { error: '仅允许本机访问。' }); return }
    if ((req.headers.origin && !allowedOrigins.has(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') { send(403, { error: '不允许来自其他站点的请求。' }); return }
    const path = req.url?.split('?')[0]
    const handler = path === '/api/identify-equipment' ? identify : path === '/api/equipment-status' ? status : null
    if (!handler) { send(404, { error: '接口不存在。' }); return }
    // Avoid constructing an unbounded buffer before the shared API validation runs.
    const limit = 4 * 1024 * 1024 + 4096
    if (Number(req.headers['content-length']) > limit) { send(413, { error: '请求内容过大。' }); req.resume(); return }
    try {
      let size = 0; const chunks = []
      for await (const chunk of req) {
        size += chunk.length
        if (size > limit) { send(413, { error: '请求内容过大。' }); return }
        chunks.push(chunk)
      }
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw) { try { req.body = JSON.parse(raw) } catch { send(400, { error: '请求内容不是有效 JSON。' }); return } }
      // The local adapter uses the same handler and guards as Vercel.
      res.status = code => { res.statusCode = code; return res }
      res.json = payload => { if (!res.destroyed && !res.writableEnded) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)) } return res }
      await handler(req, res)
    } catch { send(500, { error: '本机识别接口暂时不可用，请稍后重试。' }) }
  })
  server.requestTimeout = 15000
  server.headersTimeout = 10000
  return server
}
