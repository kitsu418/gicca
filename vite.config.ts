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
        globPatterns: ['**/*.{css,html,svg,png,ico,woff2}', '**/index-*.js', '**/JsBarcode-*.js', '**/browser-*.js', '**/_commonjsHelpers-*.js', '**/workbox-window*.js'],
        // The scanner chunk (@zxing/browser) is large and only needed when the
        // user opens the barcode scanner. Keep it out of the precache and let
        // the SW grab it on first use, then cache it for subsequent offline use.
        globIgnores: ['**/scanner-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/scanner-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gicca-scanner',
              expiration: { maxEntries: 4 },
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
        },
      },
    },
  },
});
