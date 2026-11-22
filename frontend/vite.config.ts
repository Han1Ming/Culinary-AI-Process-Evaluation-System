import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vite 配置
 * - @ 别名指向 src
 * - dev 环境通过 /api 代理到 FastAPI，规避跨域，同时保证 SSE 不被缓冲
 * - /ws 走 WebSocket 代理（烹饪过程事件推送）
 * - production 构建强制校验 Mock 开关，避免把演示数据发上线
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mockOn = env.VITE_USE_MOCK === 'true'
  const allowMock = env.VITE_ALLOW_MOCK_IN_PROD === 'true'

  /** 生产构建禁止携带 Mock：误发一次就会污染线上数据，宁可直接失败 */
  const guardMock = (): Plugin => ({
    name: 'guard-mock-in-production',
    apply: 'build',
    configResolved(config) {
      if (config.mode === 'production' && mockOn && !allowMock) {
        throw new Error(
          '[build] VITE_USE_MOCK=true 不允许出现在生产构建中。\n' +
            '要么把它改成 false，要么显式设置 VITE_ALLOW_MOCK_IN_PROD=true（仅限答辩演示包）。',
        )
      }
    },
  })

  return {
    plugins: [vue(), guardMock()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          // 所有 .vue / .scss 文件可直接引用 variables.scss 中的 SCSS 变量
          additionalData: `@use "@/assets/styles/variables.scss" as *;`,
          api: 'modern-compiler',
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          // SSE 场景下不要压缩、不要缓冲
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              delete proxyRes.headers['content-encoding']
            })
          },
        },
        '/ws': {
          target: 'ws://127.0.0.1:8000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            element: ['element-plus', '@element-plus/icons-vue'],
          },
        },
      },
    },
  }
})
