/** 登录令牌读写（localStorage），供 request / sse / store 复用 */

const TOKEN_KEY = 'culinary_ai_token'

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略即可（本次会话内仍可访问）
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

/** 鉴权请求头：SSE 用 fetch，无法复用 axios 拦截器，故单独抽一层 */
export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
