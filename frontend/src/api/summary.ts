import { USE_MOCK } from '@/utils/env'
import { http } from '@/utils/request'
import { mockDelay } from '@/mock'
import { mockSummaryStudents, mockSummaryTask, scoreGrade, weightedTotal } from '@/mock/summary'
import type { SummaryReportData, SummaryRoster } from '@/types/summary'

/**
 * 综合评价接口
 * ----------------------------------------------------------------------------
 * 三个接口就够用：
 *   GET  /v1/summary/roster?taskId=    名单 + 各环节得分（教师 / 管理员）
 *   GET  /v1/summary/{id}/report       单人报告（学生本人、教师、管理员共用）
 *   POST /v1/summary/{id}/archive      归档，锁定分数并生成快照
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
  return http.get<SummaryRoster>('/v1/summary/roster')
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
  return http.get<SummaryReportData>(`/v1/summary/${studentId}/report`)
}

/** 归档：锁定分数，之后调整权重不影响这一批 */
export async function archiveSummary(studentId: number): Promise<string> {
  if (USE_MOCK) {
    await mockDelay(320)
    const student = roster.find((item) => item.id === studentId)
    if (!student) throw new Error('没有找到这名学生的实训记录')
    const at = new Date().toISOString().slice(0, 16).replace('T', ' ')
    student.confirmed = true
    student.archivedAt = at
    return at
  }
  const result = await http.post<{ archivedAt: string }>(`/v1/summary/${studentId}/archive`)
  return result.archivedAt
}
