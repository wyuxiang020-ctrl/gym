import { createServer } from 'vite'

const server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 4175, strictPort: true } })
await server.listen()
console.log('Gym V4 companion local experiment: http://127.0.0.1:4175/?companion-lab=1')
console.log('Frontend environment files are disabled. Equipment API uses the local 4177 service. Press Ctrl+C to stop.')
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0) })
