import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/** 格式化日期时间，默认 2026-11-20 14:30 */
export function formatDateTime(value: string | number | Date | null | undefined, template = 'YYYY-MM-DD HH:mm'): string {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format(template) : '—'
}

/** 仅时间：14:30:05 */
export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDateTime(value, 'HH:mm:ss')
}

/** 相对时间：3 分钟前 */
export function formatFromNow(value: string | number | Date | null | undefined): string {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.fromNow() : '—'
}

/** 相似度 0.931 → 93.1% */
export function formatSimilarity(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

/** 千分位 */
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}
