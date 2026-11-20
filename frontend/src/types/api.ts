/**
 * 统一响应与分页类型
 * 约定后端所有接口返回：{ code, data, message }
 * code === 0 或 200 视为成功（与 FastAPI 端实现保持一致）
 */

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface PageQuery {
  page: number
  pageSize: number
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 后端错误体（FastAPI 默认 detail 字段也兼容） */
export interface ApiErrorBody {
  code?: number
  message?: string
  detail?: string
}
