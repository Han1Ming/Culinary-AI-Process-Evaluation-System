/**
 * 工作台 Mock
 * ----------------------------------------------------------------------------
 * 【为什么单独一份文件】
 * 教师工作台的每个数字都要能追到某一份名单上：应到 4 人就是花名册里 4 个人，
 * 摄像头 4 在线就是设备表里 4 台 online。分开写死一组「386 人 / 352 签到」，
 * 演示时一对照就穿帮，验收时也说不清数字从哪来。
 *
 * 【口径】
 *   应到人数 —— 本节课在评学生（花名册，不是全校在训人数）
 *   已签到   —— 花名册 checkedIn
 *   正在实训 —— 已签到但成品还没提交
 *   已完成   —— 五环节全部结束（可以没归档，归档是教师动作）
 *   摄像头   —— 与这些工位绑定、且状态为 online 的设备
 *
 * 真实环境这一整份由后端算：GET /dashboard/overview?courseId&classId&taskId
 */
import type {
  ActivityItem,
  CameraDevice,
  DashboardOverview,
  DashboardQuery,
  EvaluationModule,
  ModuleCompletion,
  MyOverview,
  StatCardData,
  TrainingSession,
  TrainingStatus,
} from '@/types'
import { mockStudents } from './students'
import { mockCourses } from './courses'
import { mockCameras, mockWorkstations } from './device'
import { mockEvents } from './cooking'
import { mockSummaryStudents, weightedTotal } from './summary'

/** 五个评价环节的固定口径，与综合评价模块保持一致 */
const MODULE_DEFS: Array<{ key: string; name: string }> = [
  { key: 'checkin', name: '签到与着装' },
  { key: 'ingredient', name: '食材预处理' },
  { key: 'cooking', name: '烹饪过程' },
  { key: 'dish', name: '菜肴成品' },
  { key: 'qa', name: '课堂问答' },
]

interface TaskSeed {
  id: string
  courseId: number
  classId: string
  className: string
  title: string
  status: TrainingStatus
  startedAt: string
  endedAt: string
  step: string
  /** 已完成的学生（提交成品并走完五环节） */
  completedIds: number[]
  /** 已归档的学生：归档后分数冻结 */
  archivedIds: number[]
  /** 各模块已完成人数，顺序与 MODULE_DEFS 一致；由后端按任务实际进度算 */
  moduleDone: number[]
}

/**
 * 四条任务：进行中 / 昨天已结束 / 上周已结课 / 下周未开始。
 * 筛选之所以有意义，就是因为这几条任务的状态与人头都不一样。
 */
const TASK_SEEDS: TaskSeed[] = [
  {
    id: 'task_20261121_01',
    courseId: 1,
    classId: '12',
    className: '烹饪工艺与营养 2301',
    title: '糖醋里脊 · 过程实训',
    status: 'running',
    startedAt: '2026-11-21T08:00:00',
    endedAt: '2026-11-21T11:40:00',
    step: '翻炒',
    completedIds: [1001, 1004],
    archivedIds: [1001, 1004],
    moduleDone: [4, 4, 3, 2, 2],
  },
  {
    id: 'task_20261120_01',
    courseId: 1,
    classId: '12',
    className: '烹饪工艺与营养 2301',
    title: '刀工与火候 · 补练',
    status: 'finished',
    startedAt: '2026-11-20T08:00:00',
    endedAt: '2026-11-20T11:40:00',
    step: '已装盘',
    completedIds: [1001, 1002, 1004, 1006],
    archivedIds: [1001, 1002, 1004, 1006],
    moduleDone: [4, 4, 4, 4, 4],
  },
  {
    id: 'task_20261113_01',
    courseId: 3,
    classId: '13',
    className: '西餐工艺 2302',
    title: '基础刀工 · 结课考核',
    status: 'finished',
    startedAt: '2026-11-13T08:00:00',
    endedAt: '2026-11-13T11:40:00',
    step: '已装盘',
    completedIds: [1003],
    archivedIds: [],
    moduleDone: [1, 1, 1, 1, 1],
  },
  {
    id: 'task_20261127_01',
    courseId: 2,
    classId: '12',
    className: '烹饪工艺与营养 2301',
    title: '上浆与油温 · 预习演练',
    status: 'planned',
    startedAt: '2026-11-27T08:00:00',
    endedAt: '2026-11-27T11:40:00',
    step: '',
    completedIds: [],
    archivedIds: [],
    moduleDone: [0, 0, 0, 0, 0],
  },
]

/** 与这批工位绑定的摄像头。数量按设备表算，不另写一个「10 台在线」 */
function camerasOfClass(className: string): CameraDevice[] {
  const seats = new Set(mockStudents.filter((s) => s.className === className).map((s) => s.seat))
  const cameraIds = new Set(
    mockWorkstations.filter((ws) => seats.has(ws.no)).flatMap((ws) => ws.cameraIds),
  )
  return mockCameras.filter((cam) => cameraIds.has(cam.id))
}

function buildSession(seed: TaskSeed): TrainingSession {
  const students = mockStudents.filter((s) => s.className === seed.className)
  const checkedIn = students.filter((s) => s.checkedIn).length
  const completed = seed.completedIds.length
  const cameras = camerasOfClass(seed.className)
  const online = cameras.filter((cam) => cam.status === 'online').length
  // 未处理的事件才是「待教师处理」；已确认的事件留在档案里，不重复计数
  const anomalies = seed.status === 'running' ? mockEvents.filter((e) => !e.acknowledged).length : 0

  return {
    taskId: seed.id,
    taskTitle: seed.title,
    courseId: String(seed.courseId),
    courseTitle: mockCourses.find((c) => c.id === seed.courseId)?.title ?? '未命名课程',
    classId: seed.classId,
    className: seed.className,
    teacher: mockCourses.find((c) => c.id === seed.courseId)?.teacherName ?? '—',
    startedAt: seed.startedAt,
    endedAt: seed.endedAt,
    status: seed.status,
    total: students.length,
    checkedIn,
    inTraining: Math.max(checkedIn - completed, 0),
    completed,
    archived: seed.archivedIds.length,
    cameraOnline: online,
    cameraOffline: cameras.length - online,
    pendingReview: students.length - seed.archivedIds.length,
    anomalies,
  }
}

/** 教师工作台的统计卡：全部由 session 派生，点卡片跳到对应详情页 */
function buildStats(session: TrainingSession, checkinRate: number): StatCardData[] {
  return [
    {
      key: 'total',
      label: '应到人数',
      value: session.total,
      unit: '人',
      note: session.className,
      icon: 'User',
      tone: 'primary',
    },
    {
      key: 'checkedIn',
      label: '已签到',
      value: session.checkedIn,
      unit: '人',
      note: `签到率 ${checkinRate.toFixed(1)}%`,
      icon: 'Camera',
      tone: 'success',
    },
    {
      key: 'missing',
      label: '未签到',
      value: Math.max(session.total - session.checkedIn, 0),
      unit: '人',
      note: session.total - session.checkedIn > 0 ? '可代签核验或补录' : '全员已签到',
      icon: 'Warning',
      tone: session.total - session.checkedIn > 0 ? 'warning' : 'primary',
    },
    {
      key: 'inTraining',
      label: '正在实训',
      value: session.inTraining,
      unit: '人',
      note: '已签到、未提交成品',
      icon: 'Timer',
      tone: 'primary',
    },
    {
      key: 'completed',
      label: '已完成实训',
      value: session.completed,
      unit: '人',
      note: `其中已归档 ${session.archived} 份`,
      icon: 'CircleCheck',
      tone: 'success',
    },
    {
      key: 'camera',
      label: '摄像头在线',
      value: session.cameraOnline,
      unit: '台',
      note: `离线 / 故障 ${session.cameraOffline} 台`,
      icon: 'VideoCamera',
      tone: session.cameraOffline > 0 ? 'warning' : 'success',
    },
    {
      key: 'review',
      label: '待复核',
      value: session.pendingReview,
      unit: '份',
      note: '未归档即未冻结',
      icon: 'Document',
      tone: 'primary',
    },
    {
      key: 'anomaly',
      label: '异常事件',
      value: session.anomalies,
      unit: '条',
      note: '未确认的事件',
      icon: 'Warning',
      tone: session.anomalies > 0 ? 'danger' : 'primary',
    },
  ]
}

/** 事件流按课程挑：别的班的异常不该出现在这个班的动态里 */
function buildActivities(session: TrainingSession): ActivityItem[] {
  const roster = mockSummaryStudents.filter((s) => s.className === session.className)
  const average =
    roster.length > 0
      ? roster.reduce((sum, s) => sum + weightedTotal(s.stages), 0) / roster.length
      : 0

  const feed: ActivityItem[] = []

  if (session.checkedIn > 0) {
    feed.push({
      id: `${session.taskId}_checkin`,
      type: 'checkin',
      title: `本节课已签到 ${session.checkedIn} 人`,
      description: `${session.className} · 未签到 ${Math.max(session.total - session.checkedIn, 0)} 人`,
      time: session.startedAt.replace('T', ' ').slice(0, 16),
      actor: '系统',
    })
  }
  if (roster.length > 0) {
    feed.push({
      id: `${session.taskId}_eval`,
      type: 'evaluation',
      title: '过程评价已生成',
      description: `${roster.length} 名学生 · 平均分 ${average.toFixed(1)}`,
      time: `${session.startedAt.slice(0, 10)} 09:05`,
      actor: '系统',
    })
  }
  if (session.anomalies > 0) {
    const pending = mockEvents.filter((e) => !e.acknowledged)
    feed.push({
      id: `${session.taskId}_anomaly`,
      type: 'system',
      title: `${session.anomalies} 条异常事件待确认`,
      description: pending.map((e) => e.title).slice(0, 2).join('；'),
      time: pending[0]?.at.replace('T', ' ').slice(0, 16) ?? '—',
      actor: '系统',
    })
  }
  if (session.archived > 0) {
    feed.push({
      id: `${session.taskId}_archive`,
      type: 'evaluation',
      title: `${session.archived} 份成绩已归档`,
      description: '归档后分数冻结，调整权重不影响这一批',
      time: '2026-11-21 09:33',
      actor: session.teacher,
    })
  }

  return feed.sort((a, b) => b.time.localeCompare(a.time))
}

function buildCompletion(seed: TaskSeed | null): ModuleCompletion[] {
  return MODULE_DEFS.map((def, index) => {
    const done = seed?.moduleDone[index] ?? 0
    const students = seed
      ? mockStudents.filter((s) => s.className === seed.className).length
      : 0
    return {
      key: def.key,
      name: def.name,
      active: Boolean(seed && seed.status !== 'planned'),
      done,
      total: students,
    }
  })
}

/** 交付进度：只有管理员关心，教师看到的是上面那份完成情况 */
const DELIVERY_MODULES: EvaluationModule[] = [
  { key: 'face', name: '人脸识别签到', description: '身份核验与自动签到', progress: 100, ready: true },
  { key: 'uniform', name: '着装规范识别', description: '厨师服、厨师帽合规检测', progress: 100, ready: true },
  { key: 'ingredient', name: '食材预处理评价', description: '刀工动作与切丝频率分析', progress: 100, ready: true },
  { key: 'cooking', name: '烹饪过程评价', description: '多路视频环节识别与计时', progress: 100, ready: true },
  { key: 'dish', name: '菜肴成品分析', description: '摆盘、色彩与工艺多模态评分', progress: 100, ready: true },
  { key: 'summary', name: '综合评价', description: '汇总各环节生成综合成绩', progress: 100, ready: true },
]

/**
 * 教师工作台
 * ----------------------------------------------------------------------------
 * 「当前」= 符合筛选条件、且状态最靠前的一条任务：
 * 进行中优先，其次按开始时间倒序。筛不到任何任务时 session 为 null，
 * 页面要写「这个筛选条件下没有实训任务」，而不是把所有数字显示成 0。
 */
export function queryMockDashboard(query: DashboardQuery = {}): DashboardOverview {
  const matched = TASK_SEEDS.filter(
    (task) =>
      (!query.courseId || String(task.courseId) === query.courseId) &&
      (!query.classId || task.classId === query.classId) &&
      (!query.taskId || task.id === query.taskId),
  ).sort((a, b) => {
    if (a.status !== b.status) {
      const order: Record<TrainingStatus, number> = { running: 0, planned: 1, finished: 2 }
      return order[a.status] - order[b.status]
    }
    return b.startedAt.localeCompare(a.startedAt)
  })

  const seed = matched[0] ?? null
  const session = seed ? buildSession(seed) : null
  const checkinRate = session && session.total > 0 ? (session.checkedIn / session.total) * 100 : 0

  return {
    stats: session ? buildStats(session, checkinRate) : [],
    activities: session ? buildActivities(session) : [],
    modules: DELIVERY_MODULES,
    checkinRate,
    session,
    completion: buildCompletion(seed),
    filters: {
      courses: mockCourses.map((course) => ({ label: course.title, value: String(course.id) })),
      classes: [...new Set(mockStudents.map((s) => s.className))].map((name) => ({
        label: name,
        value: name === '烹饪工艺与营养 2301' ? '12' : '13',
      })),
      tasks: TASK_SEEDS.map((task) => ({ label: task.title, value: task.id })),
    },
  }
}

/* ============================ 学生工作台 ============================ */

/** 历史成绩：上一节实训的归档结果，与本节分开，避免把「本轮」看成「历史」 */
const HISTORY: Record<number, { taskTitle: string; archivedAt: string; total: number; grade: string }> = {
  1001: { taskTitle: '刀工与火候 · 补练', archivedAt: '2026-11-20 14:02', total: 88, grade: '良好' },
  1002: { taskTitle: '刀工与火候 · 补练', archivedAt: '2026-11-20 14:02', total: 85, grade: '良好' },
  1003: { taskTitle: '基础刀工 · 结课考核', archivedAt: '2026-11-13 15:10', total: 79, grade: '中等' },
  1004: { taskTitle: '刀工与火候 · 补练', archivedAt: '2026-11-20 14:02', total: 92, grade: '优秀' },
  1005: { taskTitle: '基础刀工 · 结课考核', archivedAt: '2026-11-13 15:10', total: 71, grade: '中等' },
  1006: { taskTitle: '刀工与火候 · 补练', archivedAt: '2026-11-20 14:02', total: 87, grade: '良好' },
}

/**
 * 学生工作台
 * ----------------------------------------------------------------------------
 * 只放「我自己的」数据：没有班级签到率、没有模块对接进度、没有别人的成绩。
 * 签到状态单独一个字段而不是从 stats 里读，因为「未签到」要显眼到能拦住下一步。
 */
export function mockMyOverviewFor(studentId = 1001): MyOverview {
  const stu = mockStudents.find((s) => s.id === studentId) ?? mockStudents[0]
  const task = TASK_SEEDS.find((t) => t.status === 'running' && t.className === stu.className)
  const scores = mockSummaryStudents.find((s) => s.id === stu.id)
  const history = HISTORY[stu.id]

  /**
   * 环节状态按本节进度给：签到与预处理已出分，烹饪在跑，成品与问答未开始。
   * 先算出这份再派统计卡里的「已完成环节」，两处口径才不会一个说 5 个一个说 2 个。
   */
  const stages: MyOverview['stages'] = (scores?.stages ?? []).map((stage, index) => ({
    key: stage.key,
    label: stage.label,
    score: stage.score,
    weight: stage.weight,
    state: index < 2 ? 'done' : index === 2 ? 'running' : 'pending',
  }))
  const doneStages = stages.filter((s) => s.state === 'done').length

  return {
    studentName: stu.name,
    studentNo: stu.studentNo,
    className: stu.className,
    seat: stu.seat,
    course: {
      id: 1,
      title: '《中式热菜制作》—— 糖醋里脊',
      dishes: ['糖醋里脊', '上汤娃娃菜'],
      lessonAt: '2026-11-21 08:00',
      goal: '掌握挂糊厚度与两遍复炸的火候控制，成品酸甜比 1:1.2',
      published: true,
    },
    task: task
      ? {
          id: task.id,
          title: task.title,
          status: task.status,
          startedAt: task.startedAt,
          endedAt: task.endedAt,
          step: task.step,
        }
      : null,
    checkin: stu.checkedIn
      ? {
          status: 'checked_in',
          at: '2026-11-21 08:12',
          similarity: 96.4,
          deviceName: 'CAM-A-001',
        }
      : { status: 'missing' },
    archived: history
      ? [
          {
            id: `arch_${stu.id}_prev`,
            taskTitle: history.taskTitle,
            archivedAt: history.archivedAt,
            total: history.total,
            grade: history.grade,
            ruleVersion: '2026.11-v1.2',
          },
        ]
      : [],
    stats: [
      {
        key: 'checkin',
        label: '今日签到',
        value: stu.checkedIn ? 1 : 0,
        unit: '次',
        note: stu.checkedIn ? '08:12 人脸核验通过' : '还没签到',
        icon: 'Camera',
        tone: stu.checkedIn ? 'success' : 'danger',
      },
      {
        key: 'score',
        label: '上一节实训得分',
        value: history?.total ?? 0,
        unit: '分',
        note: history ? `${history.taskTitle} · ${history.grade}` : '暂无归档成绩',
        icon: 'DataAnalysis',
        tone: 'primary',
      },
      {
        key: 'stages',
        label: '本节已完成环节',
        value: doneStages,
        unit: '个',
        note: `共 ${stages.length} 个环节`,
        icon: 'Notebook',
        tone: 'primary',
      },
      {
        key: 'todo',
        label: '待完成事项',
        value: stu.checkedIn ? 2 : 3,
        unit: '项',
        note: '含成品照片上传',
        icon: 'List',
        tone: 'warning',
      },
    ],
    stages,
    todos: [
      {
        id: 'todo_1',
        title: '阅读本节课菜谱',
        hint: '糖醋里脊 · 含难点标注',
        to: '/courses/1',
        done: true,
      },
      {
        id: 'todo_2',
        title: '上传成品照片',
        hint: '出锅后 5 分钟内拍摄，凉了色泽会失真',
        to: '/modules/dish',
        done: false,
      },
      {
        id: 'todo_3',
        title: '完成课堂问答',
        hint: '本节 2 道题，占比 5%',
        to: '/chat',
        done: false,
      },
    ],
    activities: [
      {
        id: 'my_1',
        type: 'checkin',
        title: '人脸签到通过',
        description: `${stu.className} · 相似度 96.4%`,
        time: '2026-11-21 08:12',
        actor: '我',
      },
      {
        id: 'my_2',
        type: 'evaluation',
        title: '食材预处理评价已生成',
        description: '切丝均匀度 82 分，成菜规格 88 分',
        time: '2026-11-21 08:36',
        actor: '系统',
      },
      {
        id: 'my_3',
        type: 'evaluation',
        title: '教师调整了烹饪过程得分',
        description: '「下锅油温偏低」扣 4 分，已计入本环节',
        time: '2026-11-21 09:18',
        actor: '陈立群',
      },
    ],
  }
}
