import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(getGitCommit()),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    build: {
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      cssMinify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react-dom')) return 'vendor-react'
            if (id.includes('node_modules/react')) return 'vendor-react'
            if (id.includes('node_modules/dexie')) return 'vendor-dexie'
            if (id.includes('node_modules/react-router')) return 'vendor-router'
            if (id.includes('node_modules')) return 'vendor'
          },
        },
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'LaneLogic Coaching',
          short_name: 'SwimSheet',
          description: 'Swim coaching session management and timing',
          start_url: '/',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          background_color: '#f7f9fb',
          theme_color: '#1e40af',
          orientation: 'portrait-primary',
          categories: ['sports', 'productivity', 'education'],
          lang: 'en',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})