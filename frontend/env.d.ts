/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 站点标题，用于 document.title 与登录页 */
  readonly VITE_APP_TITLE: string
  /** FastAPI 服务地址，如 http://127.0.0.1:8000/api/v1 或 /api */
  readonly VITE_API_BASE_URL: string
  /** 是否启用前端 mock 数据：'true' | 'false' */
  readonly VITE_USE_MOCK: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
