import axios from 'axios'
import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

import type { ApiErrorBody, ApiResponse } from '@/types'
import { API_BASE_URL } from './env'
import { authHeaders, clearToken } from './token'

/**
 * Axios 封装
 * 1. 自动携带 Bearer Token
 * 2. 自动拆解 { code, data, message }，业务层只拿到 data
 * 3. 统一错误提示 + 401 跳登录
 */

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

service.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  for (const [key, value] of Object.entries(authHeaders())) {
    config.headers.set(key, value)
  }
  return config
})

/** 401 只提示一次，避免并发请求刷屏 */
let redirecting = false

service.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status
    const payload = error.response?.data
    let message = payload?.message || payload?.detail || error.message

    // 主动取消（切换筛选、离开页面）不是错误，不弹提示
    if (error.code === 'ERR_CANCELED') {
      return Promise.reject(new Error('__canceled__'))
    }

    if (status === 401) {
      message = '登录状态已失效，请重新登录'
      if (!redirecting) {
        redirecting = true
        clearToken()
        void import('@/router').then(({ default: router }) => {
          void router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
          redirecting = false
        })
      }
    } else if (status === 403) {
      message = '当前账号无权访问该资源'
    } else if (status === 404) {
      message = '接口不存在，请核对后端路由'
    } else if (status === 409) {
      message = payload?.message || '数据状态已变化，请刷新后重试'
    } else if (status && status >= 500) {
      message = '服务器开小差了，请稍后重试'
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时，请检查网络或后端服务'
    } else if (!error.response) {
      message = '无法连接后端服务，请确认 FastAPI 已启动'
    }

    ElMessage.error(message)
    return Promise.reject(new Error(message))
  },
)

/** 拆包：兼容后端直接返回裸数据的场景 */
function unwrap<T>(payload: ApiResponse<T>): T {
  if (payload && typeof payload === 'object' && 'code' in payload) {
    if (payload.code === 0 || payload.code === 200) {
      return payload.data
    }
    ElMessage.error(payload.message || '请求失败')
    throw new Error(payload.message || '请求失败')
  }
  return payload as unknown as T
}

type Query = Record<string, unknown>

/** 上传参数：进度回调用于「上传中 62%」，AbortSignal 用于取消 */
export interface UploadOptions {
  onProgress?: (percent: number) => void
  timeout?: number
  signal?: AbortSignal
}

export const http = {
  get<T>(url: string, params?: Query, config?: AxiosRequestConfig): Promise<T> {
    return service.get<unknown, ApiResponse<T>>(url, { params, ...config }).then(unwrap)
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.post<unknown, ApiResponse<T>>(url, data, config).then(unwrap)
  },
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return service.put<unknown, ApiResponse<T>>(url, data, config).then(unwrap)
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete<unknown, ApiResponse<T>>(url, config).then(unwrap)
  },
  /**
   * multipart 上传（文件 / 表单）
   * 不手动设置 Content-Type，交给浏览器生成 boundary。
   * 上传进度以百分比回调，后端未接入时由本地模拟推进（见 api/upload.ts）。
   */
  upload<T>(url: string, form: FormData, options: UploadOptions = {}): Promise<T> {
    const { onProgress, timeout = 60000, signal } = options
    return service
      .post<unknown, ApiResponse<T>>(url, form, {
        timeout,
        signal,
        onUploadProgress: (event) => {
          if (!onProgress || !event.total) return
          onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
        },
      })
      .then((payload) => {
        onProgress?.(100)
        return unwrap(payload)
      })
  },
}

export default service
