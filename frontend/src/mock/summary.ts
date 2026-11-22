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
import { RULE_VERSION } from '@/config/rules'
import dishShot from '@/assets/images/dish-plated.jpg'
import prepShot from '@/assets/images/prep-cutting.jpg'
import uniformShot from '@/assets/images/uniform-students.jpg'
import wokShot from '@/assets/images/wok-frying.jpg'
import type {
  ScoreSource,
  SummaryClassStat,
  SummaryStage,
  SummaryStudent,
  SummaryTask,
} from '@/types/summary'

/** 当前评价规则版本；归档时冻结到成绩上（定义在 config/rules.ts） */

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

/** 每个环节的来源记录模板：分数不是凭空来的，点开要能看到凭据 */
const SOURCE_TEMPLATES: Record<string, Array<Omit<ScoreSource, 'id'>>> = {
  checkin: [
    {
      module: '签到',
      title: '人脸签到成功',
      at: '2026-11-21 08:12:31',
      detail: '相似度 96.4%，设备 CAM-A-001',
      snapshot: uniformShot,
    },
    {
      module: '着装',
      title: '着装规范检测 · 合规',
      at: '2026-11-21 08:14:02',
      detail: '厨师服 / 厨师帽 / 围裙 / 饰物 5 项全部通过',
      snapshot: uniformShot,
    },
  ],
  ingredient: [
    {
      module: '食材预处理',
      title: '切配频率分析',
      at: '2026-11-21 08:36:20',
      detail: '累计 186 刀，平均 2.4 次/秒，均匀度 87%',
      snapshot: prepShot,
    },
    {
      module: '食材预处理',
      title: '成丝规格抽帧',
      at: '2026-11-21 08:38:05',
      detail: '截面 2.9mm × 3.1mm，与课程标准 3mm 偏差 3%',
      snapshot: prepShot,
    },
  ],
  cooking: [
    {
      module: '烹饪过程',
      title: '六步骤分段完成',
      at: '2026-11-21 09:02:40',
      detail: '备菜 / 焯水 / 烧干锅 / 加油润锅 / 翻炒 / 装盘 全部识别完成',
      snapshot: wokShot,
    },
    {
      module: '烹饪过程',
      title: '疑似跳步：锅未烧干直接下油',
      at: '2026-11-21 08:50:31',
      detail: '教师复核后确认误判：画面遮挡导致温度曲线缺失',
      snapshot: wokShot,
    },
  ],
  dish: [
    {
      module: '菜肴成品',
      title: '成品多模态评分',
      at: '2026-11-21 11:32:18',
      detail: '食材外观 90 / 摆盘 86 / 色彩 91 / 工艺 87 / 创意 84',
      snapshot: dishShot,
    },
  ],
  qa: [
    {
      module: '课堂问答',
      title: '本节课堂问答 4 题',
      at: '2026-11-21 10:42:00',
      detail: '正确 4 题，平均用时 38s',
    },
  ],
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

/** AI 初评与教师复核的差异：负数表示机器给低了，教师改高 */
const AI_OFFSETS = [-2, 1, -3, 0, 2]

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
    ruleVersion: ARCHIVED[stu.id] ? RULE_VERSION : undefined,
    archivedTotal: ARCHIVED[stu.id]
      ? Math.round(
          STAGE_DEFS.reduce((sum, def, i) => sum + (scores[i] ?? 0) * def.weight, 0),
        )
      : undefined,
    changes:
      stu.id === 1001
        ? [
            {
              id: 'chg_1001_1',
              at: '2026-11-21 09:18',
              by: '陈立群',
              target: 'stage',
              stageLabel: '烹饪过程',
              from: 86,
              to: 88,
              reason: '疑似跳步为画面遮挡误判，复核后恢复 2 分',
            },
          ]
        : stu.id === 1003
          ? [
              {
                id: 'chg_1003_1',
                at: '2026-11-21 09:22',
                by: '李慧敏',
                target: 'stage',
                stageLabel: '菜肴成品',
                from: 78,
                to: 74,
                reason: '餐具边缘有明显指印，扣 4 分',
              },
            ]
          : [],
    /**
     * 复核状态：演示时三种状态都要能看到，否则教师不知道「驳回」长什么样。
     * 已归档的一定是 confirmed；1002 留给「已驳回」，1004 留给「转复核」。
     */
    reviewState: ARCHIVED[stu.id]
      ? 'confirmed'
      : stu.id === 1002
        ? 'rejected'
        : stu.id === 1004
          ? 'reviewing'
          : 'pending',
    reviewNote:
      stu.id === 1002
        ? '成品照片反光严重，无法判断芡汁挂壁，请重新拍摄后提交'
        : stu.id === 1004
          ? '刀工段与烹饪段的视频时间戳对不上，留待教研组核对'
          : undefined,
    reviewedBy: ARCHIVED[stu.id] ? '陈立群' : stu.id === 1002 ? '陈立群' : stu.id === 1004 ? '陈立群' : undefined,
    reviewedAt: ARCHIVED[stu.id] ? ARCHIVED[stu.id] : stu.id === 1002 ? '2026-11-21 09:26' : undefined,
    stages: STAGE_DEFS.map((def, i) => {
      const score = scores[i] ?? 0
      const aiScore = Math.max(0, Math.min(100, score + AI_OFFSETS[i]))
      const reviewed = Boolean(ARCHIVED[stu.id]) || i < 2
      return {
        ...def,
        score,
        aiScore,
        reviewScore: score,
        reviewed,
        sources: (SOURCE_TEMPLATES[def.key] ?? []).map((source, index) => ({
          ...source,
          id: `${stu.id}_${def.key}_${index + 1}`,
          // 单条来源分：围绕环节分 ±2，两条之间略有差异才像真实的抽帧结果；
          // 改分后环节分按来源重新平均，与 api 的 overrideSourceScore 算法保持一致
          score: Math.max(0, Math.min(100, score + (index === 0 ? 2 : -2))),
          dimensions: [
            { label: '识别置信度', value: (0.9 - index * 0.04).toFixed(2) },
            { label: '有效时长', value: index === 0 ? '42s' : '18s' },
            { label: '采样帧', value: index === 0 ? '84 帧' : '36 帧' },
          ],
          meta: [
            { label: '来源设备', value: index === 0 ? 'CAM-A-001' : 'CAM-A-002' },
            { label: '模型版本', value: 'v1.3' },
          ],
        })),
      }
    }),
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
