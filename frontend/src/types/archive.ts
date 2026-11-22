/** 学生实训档案（/archive） */

export type PracticeType = 'hot' | 'cold' | 'pastry' | 'western'

export const PRACTICE_TYPE_LABEL: Record<PracticeType, string> = {
  hot: '中餐热菜',
  cold: '冷菜拼摆',
  pastry: '面点',
  western: '西餐',
}

export interface ArchiveStage {
  key: string
  label: string
  score: number
  weight: number
}

/** 一次实训的归档结果 */
export interface ArchiveSession {
  id: string
  taskId: string
  courseTitle: string
  dish: string
  type: PracticeType
  /** 学期，如 2026-2027-1 */
  semester: string
  finishedAt: string
  stages: ArchiveStage[]
  /** 加权总分（已含教师现场扣分） */
  total: number
  grade: string
  /** 本次暴露的主要问题，来自各模块的复核结论 */
  issues: string[]
  /** 教师评语 */
  comment: string
  teacher: string
  archived: boolean
}

export interface ArchiveStudent {
  id: number
  name: string
  studentNo: string
  className: string
  seat: string
  facePhoto?: string
}

export interface ArchiveSummary {
  count: number
  average: number
  best: number
  /** 0~1 */
  passRate: number
  /** 最近一次相对上一次的变化，正数为进步 */
  trend: number
}

export interface StudentArchive {
  student: ArchiveStudent
  sessions: ArchiveSession[]
  summary: ArchiveSummary
  semesters: string[]
  courses: string[]
}

export interface ArchiveQuery {
  semester?: string
  courseTitle?: string
  type?: PracticeType | ''
}
