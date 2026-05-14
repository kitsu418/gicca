import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'Gicca — Gift Card Vault',
        short_name: 'Gicca',
        description: 'Encrypted, local-first gift card manager',
        lang: 'en',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,html,svg,png,ico,woff2,js}'],
        // The scanner chunk (@zxing/browser) is large and only needed when the
        // user opens the barcode scanner. Keep it out of the precache and let
        // the SW grab it on first use, then cache it for subsequent offline use.
        // Fontsource ships seven subset woff2 files for Inter (latin, latin-ext,
        // cyrillic, cyrillic-ext, greek, greek-ext, vietnamese). The UI is
        // English-only so the browser only ever requests the latin subset via
        // the @font-face unicode-range — precaching the other six wastes ~180 KB.
        globIgnores: [
          '**/scanner-*.js',
          '**/ocr-*.js',
          '**/inter-cyrillic*.woff2',
          '**/inter-greek*.woff2',
          '**/inter-vietnamese*.woff2',
          '**/inter-latin-ext-*.woff2',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/scanner-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gicca-scanner',
              expiration: { maxEntries: 4 },
            },
          },
          {
            urlPattern: /\/assets\/ocr-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gicca-ocr',
              expiration: { maxEntries: 4 },
            },
          },
          // Tesseract.js fetches worker, wasm, and the eng language model
          // from a CDN on first use. Tesseract caches them in IndexedDB
          // itself, but we also let the SW serve the worker.min.js from
          // its own cache so subsequent loads don't hit the network.
          {
            urlPattern: /tesseract/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gicca-tesseract-assets',
              expiration: { maxEntries: 8 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@zxing')) return 'scanner';
          if (id.includes('tesseract.js')) return 'ocr';
        },
      },
    },
  },
});
