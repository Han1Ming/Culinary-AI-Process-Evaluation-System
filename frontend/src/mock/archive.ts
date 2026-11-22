/**
 * 实训档案 Mock
 * ----------------------------------------------------------------------------
 * 每个学生都有一份「能看出进步」的历史：分数由学号后两位做扰动，
 * 保证不同学生打开不是同一张表；趋势整体向上，但保留一次回落，
 * 否则「成绩趋势」这个图就没有信息量。
 */
import { mockStudents } from './students'
import type {
  ArchiveSession,
  ArchiveStage,
  ArchiveStudent,
  PracticeType,
  StudentArchive,
} from '@/types/archive'

const STAGE_DEFS: Array<Pick<ArchiveStage, 'key' | 'label' | 'weight'>> = [
  { key: 'checkin', label: '签到与着装', weight: 0.15 },
  { key: 'ingredient', label: '食材预处理', weight: 0.2 },
  { key: 'cooking', label: '烹饪过程', weight: 0.3 },
  { key: 'dish', label: '菜肴成品', weight: 0.3 },
  { key: 'qa', label: '课堂问答', weight: 0.05 },
]

interface Seed {
  courseTitle: string
  dish: string
  type: PracticeType
  semester: string
  finishedAt: string
  base: number
  issues: string[]
  comment: string
  archived: boolean
}

/** 8 次实训，时间从远到近；base 是整体水平，用于生成五项分数 */
const SEEDS: Seed[] = [
  {
    courseTitle: '《烹饪基本功》—— 刀工基础',
    dish: '青椒土豆丝',
    type: 'hot',
    semester: '2025-2026-1',
    finishedAt: '2025-10-16 11:20',
    base: 78,
    issues: ['成丝粗细不匀', '砧板未分生熟'],
    comment: '基本功尚可，切配速度偏慢，注意手腕发力与猫爪手势。',
    archived: true,
  },
  {
    courseTitle: '《烹饪基本功》—— 火候认知',
    dish: '清炒时蔬',
    type: 'hot',
    semester: '2025-2026-1',
    finishedAt: '2025-11-06 11:15',
    base: 81,
    issues: ['下锅油温偏低'],
    comment: '火候判断有进步，出锅前尝味习惯已养成。',
    archived: true,
  },
  {
    courseTitle: '《冷菜工艺》—— 拼摆构图',
    dish: '什锦冷盘',
    type: 'cold',
    semester: '2025-2026-2',
    finishedAt: '2026-03-19 15:40',
    base: 76,
    issues: ['摆盘与标准图差异明显'],
    comment: '构图想法不错，但主体不够突出，留白比例需要再练。',
    archived: true,
  },
  {
    courseTitle: '《中式热菜制作》—— 挂糊与复炸',
    dish: '糖醋里脊',
    type: 'hot',
    semester: '2025-2026-2',
    finishedAt: '2026-04-09 11:30',
    base: 85,
    issues: ['复炸时间不足'],
    comment: '挂糊厚度控制到位，复炸第二遍时间偏短，脆度略欠。',
    archived: true,
  },
  {
    courseTitle: '《面点工艺》—— 水调面团',
    dish: '手擀面',
    type: 'pastry',
    semester: '2025-2026-2',
    finishedAt: '2026-05-14 15:05',
    base: 83,
    issues: ['面条粗细不匀'],
    comment: '和面水量合适，擀制时用力不均，需加强手臂稳定性。',
    archived: true,
  },
  {
    courseTitle: '《西餐工艺》—— 基础酱汁',
    dish: '黑椒牛柳',
    type: 'western',
    semester: '2026-2027-1',
    finishedAt: '2026-10-22 11:25',
    base: 88,
    issues: [],
    comment: '酱汁浓度与黑椒比例准确，牛排熟度控制稳定。',
    archived: true,
  },
  {
    courseTitle: '《中式热菜制作》—— 焯水与调味',
    dish: '上汤娃娃菜',
    type: 'hot',
    semester: '2026-2027-1',
    finishedAt: '2026-11-06 11:10',
    base: 86,
    issues: ['焯水时长偏短'],
    comment: '汤色清亮，娃娃菜断生略欠，下次水沸后计时。',
    archived: true,
  },
  {
    courseTitle: '《中式热菜制作》—— 糖醋里脊',
    dish: '糖醋里脊',
    type: 'hot',
    semester: '2026-2027-1',
    finishedAt: '2026-11-21 11:40',
    base: 89,
    issues: ['疑似跳步：锅未烧干直接下油'],
    comment: '酸甜比 1:1.2 把握准确，出锅前收汁漂亮；烧干锅环节需补做确认。',
    archived: false,
  },
]

function gradeOf(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}

/** 用学号做扰动，保证同一学生的历史稳定、不同学生不同 */
export function buildArchive(studentId: number): StudentArchive | null {
  const stu = mockStudents.find((item) => item.id === studentId)
  if (!stu) return null

  const jitter = ((studentId % 7) - 3) * 1.6

  const sessions: ArchiveSession[] = SEEDS.map((seed, index) => {
    const drift = jitter + (index - 4) * 0.9
    const stages = STAGE_DEFS.map((def, stageIndex) => {
      // 成品与过程权重高，波动也稍大，更接近真实评分
      const wave = Math.sin((studentId + index * 3 + stageIndex * 5) * 0.7) * 2.4
      const score = Math.max(
        55,
        Math.min(100, Math.round(seed.base + drift + wave + (stageIndex === 0 ? 8 : 0))),
      )
      return { ...def, score }
    })
    const total = Math.round(stages.reduce((sum, item) => sum + item.score * item.weight, 0))
    return {
      id: `ar_${stu.id}_${index + 1}`,
      taskId: `task_${seed.finishedAt.slice(0, 10).replace(/-/g, '')}_0${index + 1}`,
      courseTitle: seed.courseTitle,
      dish: seed.dish,
      type: seed.type,
      semester: seed.semester,
      finishedAt: seed.finishedAt,
      stages,
      total,
      grade: gradeOf(total),
      issues: seed.issues,
      comment: seed.comment,
      teacher: index % 2 === 0 ? '陈立群' : '李慧敏',
      archived: seed.archived,
    }
  })

  const totals = sessions.map((item) => item.total)
  const summary = {
    count: sessions.length,
    average: Number((totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)),
    best: Math.max(...totals),
    passRate: Number((totals.filter((item) => item >= 60).length / totals.length).toFixed(3)),
    trend: totals.at(-1)! - totals.at(-2)!,
  }

  const student: ArchiveStudent = {
    id: stu.id,
    name: stu.name,
    studentNo: stu.studentNo,
    className: stu.className,
    seat: stu.seat,
    facePhoto: stu.facePhoto,
  }

  return {
    student,
    sessions,
    summary,
    semesters: [...new Set(sessions.map((item) => item.semester))].sort().reverse(),
    courses: [...new Set(sessions.map((item) => item.courseTitle))],
  }
}

/** 汇总常见问题：按出现次数排序，取前 4 条 */
export function topIssues(sessions: ArchiveSession[]): Array<{ label: string; count: number }> {
  const map = new Map<string, number>()
  sessions.forEach((session) => {
    session.issues.forEach((issue) => map.set(issue, (map.get(issue) ?? 0) + 1))
  })
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
}
