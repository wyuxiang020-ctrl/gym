import './ts-test-loader.mjs'
import { existsSync } from 'node:fs'
import { createEquipmentHttpServer } from './equipment-http.mjs'

// Load existing server configuration once before authorization, never into Vite.
// Node preserves host-provided values; no keys or environment values are printed.
if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const { default: identify } = await import('../api/identify-equipment.ts')
const { default: status } = await import('../api/equipment-status.ts')
const server = createEquipmentHttpServer({ identify, status })
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '器械 API 的 4177 端口已被占用。' : '器械 API 无法启动。'); process.exitCode = 1 })
server.listen(4177, '127.0.0.1', () => console.log('Gym 器械 API 已启动：http://127.0.0.1:4177（仅本机；不会自动调用模型）'))
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)))
