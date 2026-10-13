import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Versão mostrada no Perfil: data e hora da publicação (horário de Brasília).
const versao = new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// https://vite.dev/config/
export default defineConfig({
  // Caminhos relativos: funciona em qualquer hospedagem (inclusive GitHub Pages).
  base: './',
  define: { __VERSAO__: JSON.stringify(versao) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // O registro é feito em src/lib/atualizacao.ts, que também procura versões novas.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon-32x32.png', 'logo.svg', 'logo-vertical.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Axé Plantas',
        short_name: 'Axé Plantas',
        description: 'Encontre e compartilhe onde estão as folhas sagradas.',
        lang: 'pt-BR',
        theme_color: '#2f5d3a',
        background_color: '#f6f3ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Recebe as notificações (public/push-sw.js).
        importScripts: ['push-sw.js'],
        skipWaiting: true,
        clientsClaim: true,
        // Guarda os pedaços do mapa já vistos, para abrir mesmo com sinal fraco.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa',
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
