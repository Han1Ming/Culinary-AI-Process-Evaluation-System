import { USE_MOCK } from '@/utils/env'
import { http } from '@/utils/request'
import { mockDelay } from '@/mock'
import { RULE_VERSION } from '@/config/rules'
import { mockSummaryStudents, mockSummaryTask, scoreGrade, weightedTotal } from '@/mock/summary'
import type { ReviewState, SummaryReportData, SummaryRoster } from '@/types/summary'

/**
 * 综合评价接口（统一前缀 /api/v1）
 * ----------------------------------------------------------------------------
 *   GET  /summary/roster?taskId=       名单 + 各环节得分（教师 / 管理员）
 *   GET  /summary/{id}/report          单人报告（学生本人、教师、管理员共用）
 *   POST /summary/{id}/archive         归档：冻结分数、规则版本与原始分项
 *
 * 导出成绩单没有对应的后端接口：CSV 由前端按当前名单即时生成，
 * 保证「导出的就是屏幕上这份」。若后端要做服务端导出（xlsx），
 * 前端只需替换 utils/export.ts 的调用方式，见 docs/后端开发任务书.md。
 */

/** Mock 下归档状态是内存的：刷新页面回到种子状态，属于预期行为 */
const roster = mockSummaryStudents.map((stu) => ({ ...stu }))

export async function fetchSummaryRoster(): Promise<SummaryRoster> {
  if (USE_MOCK) {
    await mockDelay(280)
    return {
      task: { ...mockSummaryTask },
      students: roster.map((stu) => ({ ...stu, stages: stu.stages.map((s) => ({ ...s })) })),
    }
  }
  return http.get<SummaryRoster>('/summary/roster')
}

export async function fetchSummaryReport(studentId: number): Promise<SummaryReportData> {
  if (USE_MOCK) {
    await mockDelay(220)
    const student = roster.find((item) => item.id === studentId)
    if (!student) throw new Error('没有找到这名学生的实训记录')
    const total = weightedTotal(student.stages)
    return {
      student: { ...student, stages: student.stages.map((s) => ({ ...s })) },
      total,
      grade: scoreGrade(total),
      task: { ...mockSummaryTask },
      generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
  }
  return http.get<SummaryReportData>(`/summary/${studentId}/report`)
}

/** 归档：冻结分数、规则版本与各项原始分，之后调整权重不影响这一批 */
export async function archiveSummary(studentId: number): Promise<string> {
  if (USE_MOCK) {
    await mockDelay(320)
    const student = roster.find((item) => item.id === studentId)
    if (!student) throw new Error('没有找到这名学生的实训记录')
    const at = new Date().toISOString().slice(0, 16).replace('T', ' ')
    student.confirmed = true
    student.archivedAt = at
    student.ruleVersion = RULE_VERSION
    student.archivedTotal = weightedTotal(student.stages)
    return at
  }
  const result = await http.post<{ archivedAt: string }>(`/summary/${studentId}/archive`, {
    // 快照随请求一起提交：后端按这份原始分项落库，日后改权重也不追溯
    ruleVersion: RULE_VERSION,
    stages: roster.find((item) => item.id === studentId)?.stages ?? [],
  })
  return result.archivedAt
}

/* ------------------------------ 教师复核 ------------------------------ */

/**
 * 复核动作：确认 / 驳回 / 转复核
 * ----------------------------------------------------------------------------
 * 三个动作的语义必须分清，否则流程会乱：
 *   confirm —— 认这个分，可以进入归档；
 *   reject  —— 分不成立，退回学生补做（必须写原因，学生要看得到）；
 *   hold    —— 当场判不了，挂起留给课后或教研组（必须写原因）。
 * 归档的前置条件是 confirmed：没确认就归档，等于替教师做了决定。
 */
export type ReviewAction = 'confirm' | 'reject' | 'hold'

export async function reviewSummaryStudent(
  studentId: number,
  action: ReviewAction,
  note = '',
): Promise<{ reviewState: ReviewState; reviewedAt: string; reviewedBy: string }> {
  if (USE_MOCK) {
    await mockDelay(280)
    const student = roster.find((item) => item.id === studentId)
    if (!student) throw new Error('没有找到这名学生')
    const reviewState: ReviewState =
      action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'reviewing'
    const reviewedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    student.reviewState = reviewState
    student.reviewNote = note || undefined
    student.reviewedAt = reviewedAt
    student.reviewedBy = '陈立群'
    return { reviewState, reviewedAt, reviewedBy: '陈立群' }
  }
  return http.post<{ reviewState: ReviewState; reviewedAt: string; reviewedBy: string }>(
    `/summary/${studentId}/review`,
    { action, note },
  )
}

/**
 * 改单条来源记录的分
 * ----------------------------------------------------------------------------
 * 改的是「这一张图、这一次事件」的分，不是环节分。环节分由来源重新合成，
 * 这样追溯链不会断：改动点永远落在最原始的那一层。
 */
export async function overrideSourceScore(
  studentId: number,
  stageKey: string,
  sourceId: string,
  score: number,
  reason: string,
): Promise<{ stageScore: number }> {
  if (USE_MOCK) {
    await mockDelay(260)
    const student = roster.find((item) => item.id === studentId)
    const stage = student?.stages.find((item) => item.key === stageKey)
    const source = stage?.sources?.find((item) => item.id === sourceId)
    if (!stage || !source) throw new Error('来源记录不存在')
    source.score = score
    source.detail = `${source.detail}（教师改分：${reason}）`
    const scored = (stage.sources ?? []).filter((item) => typeof item.score === 'number')
    const next = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length)
      : stage.score
    stage.score = next
    stage.reviewScore = next
    stage.reviewed = true
    return { stageScore: next }
  }
  return http.patch<{ stageScore: number }>(`/summary/${studentId}/stages/${stageKey}/sources/${sourceId}`, {
    score,
    reason,
  })
}
