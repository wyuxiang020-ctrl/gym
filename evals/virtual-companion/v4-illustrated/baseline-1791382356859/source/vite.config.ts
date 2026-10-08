import { defineConfig, type Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function workerHeaders(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url?.split('?')[0] === '/companion-assets/pose-worker.js') {
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'")
  }
  next()
}

const companionWorkerPolicy: Plugin = {
  name: 'companion-worker-local-policy',
  configureServer(server) { server.middlewares.use(workerHeaders) },
  configurePreviewServer(server) { server.middlewares.use(workerHeaders) },
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        chunkFileNames(chunk) {
          const experiment = chunk.moduleIds.some(id => /\/src\/companion\/|\/node_modules\/three\//.test(id.replaceAll('\\', '/')))
          return experiment ? 'assets/companion-[name]-[hash].js' : 'assets/[name]-[hash].js'
        },
      },
    },
  },
  plugins: [
    companionWorkerPolicy,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Gym',
        short_name: 'Gym',
        description: '训练与饮食记录',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // An ordinary Gym visit must not preload experimental renderers or pose models.
        globIgnores: ['**/companion-assets/**', '**/companion-*.js', '**/CompanionLab-*.css'],
      },
    }),
  ],
})
