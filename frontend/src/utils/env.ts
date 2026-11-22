/**
 * 运行时环境常量
 * 统一从这里读取 env，避免各处散落 import.meta.env
 *
 * 【Mock 纪律】甲方要求「生产环境默认关闭 Mock」「生产构建不包含开发 Mock 数据」。
 * 这里做双保险：
 *   1. 运行期：PROD 下即使 .env 里写了 VITE_USE_MOCK=true 也不生效，
 *      除非显式再加 VITE_ALLOW_MOCK_IN_PROD=true（只允许答辩演示包这样用）；
 *   2. 构建期：vite.config.ts 在 production build 时直接报错，避免误发。
 */

const mockRequested: boolean = import.meta.env.VITE_USE_MOCK === 'true'
const mockAllowedInProd: boolean = import.meta.env.VITE_ALLOW_MOCK_IN_PROD === 'true'

export const IS_PROD: boolean = import.meta.env.PROD

/** 是否启用前端 mock：后端未就绪时保证页面可完整演示 */
export const USE_MOCK: boolean = mockRequested && (!IS_PROD || mockAllowedInProd)

/** 生产包请求了 mock 但被拦下：启动时在控制台留一条痕迹，方便联调排查 */
export const MOCK_STRIPPED: boolean = IS_PROD && mockRequested && !mockAllowedInProd

/** 后端接口前缀，统一带版本号；开发走 Vite 代理，生产由 Nginx 反代 */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')

/** WebSocket 前缀（AI 事件推送、四路画面状态），与 HTTP 同域反代 */
export const WS_BASE_URL: string = import.meta.env.VITE_WS_BASE_URL || '/ws'

export const APP_TITLE: string = import.meta.env.VITE_APP_TITLE || '烹饪AI过程评价系统'

/** 统一请求超时（毫秒）；长任务接口在调用处单独覆盖 */
export const REQUEST_TIMEOUT = 20000

if (MOCK_STRIPPED) {
  console.warn('[env] 生产环境已强制关闭 Mock；如需演示包请设置 VITE_ALLOW_MOCK_IN_PROD=true')
}
