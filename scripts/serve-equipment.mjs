import { spawn } from 'node:child_process'

const children = []
let closing = false
function close(code = 0) { if (closing) return; closing = true; for (const child of children) child.kill(); process.exitCode = code }
async function probe(url, test) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); return response.ok && await test(response) } catch { return false }
}
for (const service of [
  { url: 'http://127.0.0.1:4177/api/equipment-status', script: 'scripts/serve-equipment-api.mjs', test: async response => typeof (await response.json()).available === 'boolean' },
  { url: 'http://127.0.0.1:4175/?equipment-scan=1', script: 'scripts/serve-companion-v4.mjs', test: async response => (await response.text()).includes('/src/main.tsx') },
]) {
  if (await probe(service.url, service.test)) continue
  const child = spawn(process.execPath, [service.script], { stdio: 'inherit', windowsHide: true })
  children.push(child)
  child.on('error', () => { console.error('本地服务无法启动。'); close(1) })
  child.on('exit', code => { if (!closing) close(code || 1) })
}
console.log('器械扫描入口：http://127.0.0.1:4175/?equipment-scan=1；启动不会发送照片或调用模型。')
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => close())
