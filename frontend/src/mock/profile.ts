import { buildArchive } from '@/mock/archive'
import { mockCourses } from '@/mock/courses'
import { mockStudents } from '@/mock/students'
import { mockSummaryStudents, scoreGrade } from '@/mock/summary'
import { mockUsers } from '@/mock'
import type { ProfileBase, ProfileLesson, ProfileOverview } from '@/types/profile'

/**
 * 个人中心 Mock
 * ----------------------------------------------------------------------------
 * 一条原则：这里的每个数字都要能从别处推出来，不新造。
 *  · 姓名 / 班级 / 手机 / 邮箱 → mockUsers（账号）
 *  · 学号 / 工位 / 人脸照片 → mockStudents（花名册）
 *  · 成绩与趋势 → mockSummaryStudents + buildArchive（实训档案）
 *  · 课表 → mockCourses 里的班级与课程
 * 否则「个人中心显示 4 次实训、档案页显示 3 次」这种自相矛盾马上会被看出来。
 */
const FACE_FALLBACK = undefined

/** 教师账号 → 教研室；学生账号 → 班级。账号表里 department 字段本身就是这个语义 */
function baseOf(username: string): ProfileBase | null {
  const user = mockUsers.find((item) => item.username === username)
  if (!user) return null
  const roster = mockStudents.find((item) => item.studentNo === user.studentNo)
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    code: user.studentNo ?? user.username,
    department: user.department,
    phone: user.phone,
    email: user.email,
    facePhoto: user.facePhoto ?? roster?.facePhoto ?? FACE_FALLBACK,
    faceRegistered: Boolean(user.faceRegistered),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

/** 教师课表：按 mockCourses 的班级排，一门课占两格 */
const TEACHER_LESSONS: Record<string, ProfileLesson[]> = {
  teacher_chen: [
    {
      id: 'l1',
      weekday: 1,
      period: '1-2 节',
      courseTitle: '中式热菜制作',
      className: '烹饪工艺与营养 2301',
      station: 'A-02',
      weekRange: '1-16 周',
    },
    {
      id: 'l2',
      weekday: 1,
      period: '5-6 节',
      courseTitle: '刀工与火候训练',
      className: '烹饪工艺与营养 2302',
      station: 'A-05',
      weekRange: '1-8 周',
    },
    {
      id: 'l3',
      weekday: 3,
      period: '3-4 节',
      courseTitle: '中式热菜制作',
      className: '烹饪工艺与营养 2301',
      station: 'A-02',
      weekRange: '1-16 周',
    },
    {
      id: 'l4',
      weekday: 4,
      period: '1-2 节',
      courseTitle: '实训复盘与考核',
      className: '烹饪工艺与营养 2303',
      station: 'B-01',
      weekRange: '9-16 周',
    },
    {
      id: 'l5',
      weekday: 5,
      period: '5-6 节',
      courseTitle: '西餐基础工艺',
      className: '西餐工艺 2302',
      station: 'B-03',
      weekRange: '1-16 周',
    },
  ],
  teacher_li: [
    {
      id: 'l1',
      weekday: 2,
      period: '1-2 节',
      courseTitle: '西餐基础工艺',
      className: '西餐工艺 2302',
      station: 'B-03',
      weekRange: '1-16 周',
    },
    {
      id: 'l2',
      weekday: 3,
      period: '5-6 节',
      courseTitle: '酱汁与摆盘',
      className: '西餐工艺 2301',
      station: 'B-02',
      weekRange: '1-12 周',
    },
    {
      id: 'l3',
      weekday: 5,
      period: '1-2 节',
      courseTitle: '西餐基础工艺',
      className: '西餐工艺 2302',
      station: 'B-03',
      weekRange: '1-16 周',
    },
  ],
}

/**
 * 学生：本人在综合评价里的环节分 + 档案里的历次总分
 * ----------------------------------------------------------------------------
 * 「最近一次」用本次实训的加权环节分，而不是档案里的最后一条：
 * 本次课往往还没归档，用归档记录会出现「环节条 100/91/88，总分却写 71」的矛盾。
 * 档案只负责历史趋势与均分，两者在页面上分开标注。
 */
function studentScores(username: string): ProfileOverview['scores'] {
  const base = baseOf(username)
  const roster = mockStudents.find((item) => item.studentNo === base?.code)
  const summary = mockSummaryStudents.find((item) => item.studentNo === base?.code)
  const archive = roster ? buildArchive(roster.id) : null
  // 按时间倒序，档案里给的是种子顺序，取最近 6 次前必须排一次
  const sessions = [...(archive?.sessions ?? [])].sort((a, b) =>
    a.finishedAt < b.finishedAt ? 1 : -1,
  )
  const stages = summary?.stages ?? []
  const currentTotal = stages.length
    ? Math.round(stages.reduce((sum, stage) => sum + stage.score * stage.weight, 0))
    : 0

  return {
    archivedCount: sessions.length,
    average: sessions.length
      ? Math.round(sessions.reduce((sum, item) => sum + item.total, 0) / sessions.length)
      : 0,
    best: sessions.reduce((max, item) => Math.max(max, item.total), 0),
    latest: stages.length
      ? {
          courseTitle: sessions[0]?.courseTitle ?? '',
          total: currentTotal,
          grade: scoreGrade(currentTotal),
          at: sessions[0]?.finishedAt ?? '',
        }
      : undefined,
    stages: stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      score: stage.score,
    })),
    // 从左到右是时间顺序
    trend: sessions
      .slice(0, 6)
      .reverse()
      .map((item) => ({ label: item.finishedAt.slice(5, 10), value: item.total })),
  }
}

/** 教师：按班级聚合，均分与待复核都从同一份名单算 */
function teacherScores(): ProfileOverview['scores'] {
  const groups = new Map<string, { count: number; sum: number; pending: number }>()
  for (const student of mockSummaryStudents) {
    const group = groups.get(student.className) ?? { count: 0, sum: 0, pending: 0 }
    const total = student.stages.reduce((acc, stage) => acc + stage.score * stage.weight, 0)
    group.count += 1
    group.sum += total
    if (!student.confirmed) group.pending += 1
    groups.set(student.className, group)
  }

  const classes = Array.from(groups.entries()).map(([className, group], index) => ({
    classId: index + 2301,
    className,
    count: group.count,
    average: group.count ? Math.round(group.sum / group.count) : 0,
    pending: group.pending,
  }))

  const all = mockSummaryStudents.map((student) =>
    student.stages.reduce((acc, stage) => acc + stage.score * stage.weight, 0),
  )
  const average = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0

  return {
    archivedCount: mockSummaryStudents.filter((item) => item.confirmed).length,
    average,
    best: Math.round(all.reduce((max, item) => Math.max(max, item), 0)),
    classes,
  }
}

/** 学生成绩概览里补一处「最近一次课程」，课程名从 mockCourses 取，避免另编名字 */
function withLatestCourse(scores: ProfileOverview['scores'], username: string) {
  const base = baseOf(username)
  if (!base || base.role !== 'student' || !scores.latest) return scores
  const course = mockCourses.find((item) => item.className === base.department)
  if (!course) return scores
  return { ...scores, latest: { ...scores.latest, courseTitle: course.title } }
}

export function buildProfileOverview(username: string): ProfileOverview {
  const base = baseOf(username) ?? baseOf('teacher_chen')!
  const isStudent = base.role === 'student'
  return {
    base,
    timetable: isStudent ? [] : (TEACHER_LESSONS[base.username] ?? []),
    scores: isStudent ? withLatestCourse(studentScores(base.username), base.username) : teacherScores(),
  }
}
