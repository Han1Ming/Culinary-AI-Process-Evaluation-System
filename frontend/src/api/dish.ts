import { http } from '@/utils/request'
import { USE_MOCK } from '@/utils/env'
import { mockDelay } from '@/mock'
import { mockDishAnalysis, mockDishHistory } from '@/mock/dish'
import { dishGrade } from '@/types/dish'
import type { DishAnalysis, DishOverride, DishRecord } from '@/types/dish'

/**
 * 菜肴成品接口
 *   POST /dish/analyze           { fileId, taskId, studentId, rubricId }
 *   GET  /dish/history           本人 / 指定学生的历史成品评价
 *   PUT  /dish/{id}/override     教师改分（保留 AI 原始结果）
 *
 * 图片先走 /files 上传拿 fileId，再调 analyze；不把 base64 塞进 JSON。
 */

export interface DishAnalyzePayload {
  fileId: string
  taskId: string
  studentId: number
  rubricId?: number
}

export async function analyzeDish(payload: DishAnalyzePayload, seed = 0): Promise<DishAnalysis> {
  if (USE_MOCK) {
    await mockDelay(1500)
    void payload.fileId
    return mockDishAnalysis(seed || payload.studentId)
  }
  return http.post<DishAnalysis>('/dish/analyze', payload, { timeout: 60000 })
}

export async function fetchDishHistory(studentId: number): Promise<DishRecord[]> {
  if (USE_MOCK) {
    await mockDelay(240)
    // 花名册里除陈子豪外的人也给一份，避免换人后页面空白
    if (studentId === 1001) return mockDishHistory.map((item) => ({ ...item }))
    return mockDishHistory.slice(0, 2).map((item) => ({
      ...item,
      id: `${item.id}_${studentId}`,
      total: Math.max(60, item.total - (studentId % 6)),
    }))
  }
  return http.get<DishRecord[]>('/dish/history', { studentId })
}

/** 与教研组配置的五维权重一致；真实环境由后端按 rubric 计算 */
const DIM_WEIGHTS: Record<string, number> = {
  appearance: 0.25,
  plating: 0.2,
  color: 0.2,
  craft: 0.2,
  creativity: 0.15,
}

export async function overrideDish(recordId: string, payload: DishOverride): Promise<DishRecord | null> {
  if (USE_MOCK) {
    await mockDelay(320)
    const record = mockDishHistory.find((item) => item.id === recordId)
    if (!record) return null
    const total = Math.round(
      payload.dimensions.reduce(
        (sum, item) => sum + item.score * (DIM_WEIGHTS[item.key] ?? 0),
        0,
      ),
    )
    record.total = total
    record.grade = dishGrade(total)
    record.reviewed = true
    return { ...record }
  }
  return http.put<DishRecord>(`/dish/${recordId}/override`, payload)
}

/* ------------------------------ 复核三操作 ------------------------------ */

export type DishReviewAction = 'confirm' | 'reject' | 'hold'

/**
 * 确认 / 驳回 / 转复核这次 AI 分析
 * ----------------------------------------------------------------------------
 * 与「改分」是两件事：改分是修正某个维度的分，复核是「这次分析的结果我认不认」。
 * 驳回与转复核必须写原因，原因会跟着记录走，学生能看到为什么被退回。
 */
export async function reviewDish(
  recordId: string,
  action: DishReviewAction,
  note = '',
): Promise<{ reviewState: 'confirmed' | 'rejected' | 'reviewing'; reviewedAt: string; reviewedBy: string }> {
  if (USE_MOCK) {
    await mockDelay(240)
    const reviewState = action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'reviewing'
    return {
      reviewState,
      reviewedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reviewedBy: '陈立群',
    }
  }
  return http.post<{
    reviewState: 'confirmed' | 'rejected' | 'reviewing'
    reviewedAt: string
    reviewedBy: string
  }>(`/dish/${recordId}/review`, { action, note })
}
