/**
 * 统一响应与分页类型
 * 约定后端所有接口返回：{ code, data, message }
 * code === 0 或 200 视为成功（与 FastAPI 端实现保持一致）
 *
 * 分页 / 排序 / 筛选三件事全站只用这一套字段，后端按此收参即可：
 *   GET /api/v1/xxx?page=1&pageSize=20&sortBy=createdAt&order=desc&keyword=...
 */

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export type SortOrder = 'asc' | 'desc'

/** 所有列表查询共用的排序字段 */
export interface SortQuery {
  /** 排序字段名，需与后端白名单一致 */
  sortBy?: string
  order?: SortOrder
}

/** 所有列表查询共用的分页 + 关键字 */
export interface PageQuery extends SortQuery {
  page: number
  pageSize: number
  /** 模糊搜索关键字，后端按各模块约定决定搜索哪些列 */
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 日期区间（含首尾），统一 YYYY-MM-DD */
export interface DateRange {
  start?: string
  end?: string
}

/** 下拉选项的统一形状 */
export interface SelectOption<T extends string | number = string> {
  label: string
  value: T
  disabled?: boolean
}

/**
 * 页面数据状态
 * loading  —— 首次请求中
 * empty    —— 请求成功但无数据
 * error    —— 请求失败（可重试）
 * forbidden—— 已登录但无权限（不重试）
 */
export type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'forbidden'

/** 后端错误体（FastAPI 默认 detail 字段也兼容） */
export interface ApiErrorBody {
  code?: number
  message?: string
  detail?: string
}

/**
 * 错误码约定（与 docs/后端开发任务书.md 对齐）
 * 前端只对 401 / 403 做行为分支，其余按 message 提示，不再各自判断字符串。
 */
export const ERROR_CODE = {
  OK: 0,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER: 500,
} as const
