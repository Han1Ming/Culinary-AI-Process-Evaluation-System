/**
 * 运行时环境常量
 * 统一从这里读取 env，避免各处散落 import.meta.env
 */

export const APP_TITLE: string = import.meta.env.VITE_APP_TITLE || '烹饪AI过程评价系统'

/** 后端接口前缀，如 /api（开发代理）或 http://127.0.0.1:8000/api/v1 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api'

/** 是否启用前端 mock：后端未就绪时保证页面可完整演示 */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true'
