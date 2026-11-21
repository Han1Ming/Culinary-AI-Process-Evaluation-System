/**
 * 综合评价 · Mock 数据
 * ----------------------------------------------------------------------------
 * 名单不在这里另抄一份，直接从 mock/students.ts 推导——花名册是唯一来源，
 * 这里只补「分数」这一层。真实环境里两步都由后端完成：
 *   GET /v1/classes/{class_id}/students → 名单
 *   GET /v1/summary/roster?task_id=...  → 名单 + 各环节得分
 *
 * 分数刻意保留两位小数级别的差异（如 91.35），页面上四舍五入，
 * 这样「总分不是满分口径」这类说明能对得上号。
 */
import { mockStudents } from './students'
import type { SummaryClassStat, SummaryStage, SummaryStudent, SummaryTask } from '@/types/summary'

/** 五个环节的固定口径：权重合计必须为 1，改之前先和教研组对齐 */
const STAGE_DEFS: Array<Pick<SummaryStage, 'key' | 'label' | 'weight' | 'records'>> = [
  { key: 'checkin', label: '签到与着装', weight: 0.15, records: 1 },
  { key: 'ingredient', label: '食材预处理', weight: 0.2, records: 12 },
  { key: 'cooking', label: '烹饪过程', weight: 0.3, records: 6 },
  { key: 'dish', label: '菜肴成品', weight: 0.3, records: 1 },
  { key: 'qa', label: '课堂问答', weight: 0.05, records: 4 },
]

/** 学籍号段 → 各环节得分，顺序与 STAGE_DEFS 一致 */
const SCORES: Record<number, number[]> = {
  1001: [100, 91, 88, 90, 95],
  1002: [100, 86, 92, 87, 80],
  1003: [92, 78, 74, 82, 70],
  1004: [100, 95, 90, 93, 88],
  1005: [85, 70, 66, 74, 60],
  1006: [100, 88, 84, 86, 92],
}

/** 班级名 → 主键。真实环境由 /v1/classes 返回，这里写死只为筛选可用 */
const CLASS_IDS: Record<string, number> = {
  '烹饪工艺与营养 2301': 12,
  '西餐工艺 2302': 13,
}

/** 已归档的学生与归档时间 */
const ARCHIVED: Record<number, string> = {
  1001: '2026-11-21 09:32',
  1004: '2026-11-21 09:33',
}

export const mockSummaryTask: SummaryTask = {
  id: 'task_20261121_01',
  courseTitle: '《中式热菜制作》—— 糖醋里脊',
  className: '烹饪工艺与营养 2301',
  lessonAt: '2026-11-21 08:00',
  teacher: '陈立群',
}

export const mockSummaryStudents: SummaryStudent[] = mockStudents.map((stu) => {
  const scores = SCORES[stu.id] ?? STAGE_DEFS.map(() => 0)
  return {
    id: stu.id,
    name: stu.name,
    studentNo: stu.studentNo,
    className: stu.className,
    classId: CLASS_IDS[stu.className] ?? 0,
    seat: stu.seat,
    confirmed: Boolean(ARCHIVED[stu.id]),
    archivedAt: ARCHIVED[stu.id],
    stages: STAGE_DEFS.map((def, i) => ({ ...def, score: scores[i] ?? 0 })),
  }
})

/** 加权总分（不含教师现场扣分），保留整数 */
export function weightedTotal(stages: SummaryStage[]): number {
  return Math.round(stages.reduce((sum, s) => sum + s.score * s.weight, 0))
}

/** 等级：与教务的「优秀 / 良好 / 中等 / 及格 / 不及格」五档一致 */
export function scoreGrade(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}

/** 按班级聚合：均分、及格率、五档分布 */
export function buildClassStats(students: SummaryStudent[]): SummaryClassStat[] {
  const byClass = new Map<number, SummaryStudent[]>()
  for (const stu of students) {
    const list = byClass.get(stu.classId) ?? []
    list.push(stu)
    byClass.set(stu.classId, list)
  }

  return [...byClass.entries()].map(([classId, list]) => {
    const totals = list.map((s) => weightedTotal(s.stages))
    const distribution = { excellent: 0, good: 0, medium: 0, pass: 0, fail: 0 }
    for (const score of totals) {
      if (score >= 90) distribution.excellent += 1
      else if (score >= 80) distribution.good += 1
      else if (score >= 70) distribution.medium += 1
      else if (score >= 60) distribution.pass += 1
      else distribution.fail += 1
    }
    return {
      classId,
      className: list[0]?.className ?? '未分班',
      count: list.length,
      average: Number((totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)),
      passRate: Number((totals.filter((s) => s >= 60).length / totals.length).toFixed(3)),
      distribution,
    }
  })
}
