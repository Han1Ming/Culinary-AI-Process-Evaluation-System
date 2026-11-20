import type {
  ActivityItem,
  ChatSession,
  DashboardOverview,
  EvaluationModule,
  FaceRecord,
  MyOverview,
  StatCardData,
  User,
} from '@/types'

import faceChen from '@/assets/images/faces/chen-zihao.jpg'
import faceLi from '@/assets/images/faces/li-siying.jpg'
import faceWang from '@/assets/images/faces/wang-haoran.jpg'

/**
 * 前端 Mock 数据中枢
 * 用途：后端接口未就绪阶段，保证每个页面都能完整跑通、可演示
 * 切换：.env 中 VITE_USE_MOCK=true 开启，false 走真实接口
 */

export function mockDelay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const mockUsers: User[] = [
  {
    id: 1,
    username: 'admin',
    name: '张明远',
    role: 'admin',
    phone: '13800000001',
    email: 'admin@culinary.edu.cn',
    department: '信息中心',
    status: 1,
    createdAt: '2026-03-02 09:12',
    lastLoginAt: '2026-11-20 08:41',
  },
  {
    id: 2,
    username: 'teacher_chen',
    name: '陈立群',
    role: 'teacher',
    phone: '13800000002',
    email: 'chenlq@culinary.edu.cn',
    department: '烹饪工艺教研室',
    status: 1,
    createdAt: '2026-03-05 14:20',
    lastLoginAt: '2026-11-19 16:05',
  },
  {
    id: 3,
    username: 'teacher_li',
    name: '李慧敏',
    role: 'teacher',
    phone: '13800000003',
    email: 'lihm@culinary.edu.cn',
    department: '西餐工艺教研室',
    status: 1,
    createdAt: '2026-03-05 14:26',
    lastLoginAt: '2026-11-18 10:32',
  },
  {
    id: 4,
    username: '2023010101',
    name: '陈子豪',
    role: 'student',
    studentNo: '2023010101',
    phone: '13800000004',
    department: '烹饪工艺与营养 2301',
    facePhoto: faceChen,
    faceRegistered: true,
    status: 1,
    createdAt: '2026-09-01 08:00',
    lastLoginAt: '2026-11-20 08:12',
  },
  {
    id: 5,
    username: '2023010102',
    name: '李思影',
    role: 'student',
    studentNo: '2023010102',
    phone: '13800000005',
    department: '烹饪工艺与营养 2301',
    facePhoto: faceLi,
    faceRegistered: true,
    status: 1,
    createdAt: '2026-09-01 08:00',
    lastLoginAt: '2026-11-20 08:09',
  },
  {
    id: 6,
    username: '2023010128',
    name: '王皓然',
    role: 'student',
    studentNo: '2023010128',
    phone: '13800000006',
    department: '西餐工艺 2302',
    facePhoto: faceWang,
    faceRegistered: true,
    status: 1,
    createdAt: '2026-09-01 08:00',
    lastLoginAt: '2026-11-19 13:47',
  },
  {
    id: 7,
    username: '2023010133',
    name: '赵一诺',
    role: 'student',
    studentNo: '2023010133',
    phone: '13800000007',
    department: '西餐工艺 2302',
    status: 0,
    createdAt: '2026-09-01 08:00',
    lastLoginAt: '2026-10-28 09:15',
  },
  {
    id: 8,
    username: 'teacher_zhou',
    name: '周雅琴',
    role: 'teacher',
    phone: '13800000008',
    email: 'zhouyq@culinary.edu.cn',
    department: '烹饪工艺教研室',
    status: 1,
    createdAt: '2026-04-11 10:05',
    lastLoginAt: '2026-11-17 15:22',
  },
]

export const mockStats: StatCardData[] = [
  { key: 'students', label: '在训学生', value: 386, unit: '人', delta: 4.2, icon: 'User', tone: 'primary' },
  { key: 'checkin', label: '今日签到', value: 352, unit: '人次', delta: 2.8, icon: 'Camera', tone: 'success' },
  { key: 'evaluation', label: '本周评价报告', value: 128, unit: '份', delta: -1.6, icon: 'DataAnalysis', tone: 'warning' },
  { key: 'alert', label: '待处理异常', value: 7, unit: '条', delta: 0, icon: 'Warning', tone: 'danger' },
]

export const mockActivities: ActivityItem[] = [
  {
    id: 'act_1',
    type: 'checkin',
    title: '陈子豪 完成人脸签到',
    description: '烹饪工艺与营养 2301 · 相似度 96.4%',
    time: '2026-11-20 08:12',
    actor: '陈子豪',
  },
  {
    id: 'act_2',
    type: 'evaluation',
    title: '《中式热菜制作》过程评价完成',
    description: '系统生成 32 份过程评价报告，平均分 86.5',
    time: '2026-11-20 08:05',
    actor: '陈立群',
  },
  {
    id: 'act_3',
    type: 'chat',
    title: 'AI 老师课后答疑 18 次',
    description: '高频问题：焯水时长控制、装盘色彩搭配',
    time: '2026-11-19 21:40',
    actor: '系统',
  },
  {
    id: 'act_4',
    type: 'system',
    title: '着装规范模型 v2.3 已上线',
    description: '厨师帽识别准确率提升至 97.1%',
    time: '2026-11-19 18:00',
    actor: '系统',
  },
  {
    id: 'act_5',
    type: 'checkin',
    title: '李思影 完成人脸签到',
    description: '烹饪工艺与营养 2301 · 相似度 93.8%',
    time: '2026-11-19 08:09',
    actor: '李思影',
  },
]

export const mockModules: EvaluationModule[] = [
  { key: 'face', name: '人脸识别签到', description: '身份核验与自动签到', progress: 100, ready: true },
  { key: 'uniform', name: '着装规范识别', description: '厨师服、厨师帽合规检测', progress: 60, ready: false },
  { key: 'ingredient', name: '食材预处理评价', description: '刀工动作与切丝频率分析', progress: 45, ready: false },
  { key: 'cooking', name: '烹饪过程评价', description: '多路视频环节识别与计时', progress: 40, ready: false },
  { key: 'dish', name: '菜肴成品分析', description: '摆盘、色彩与工艺多模态评分', progress: 35, ready: false },
  { key: 'summary', name: 'AI 综合评价', description: '汇总各环节生成综合成绩', progress: 30, ready: false },
]

export const mockDashboard: DashboardOverview = {
  stats: mockStats,
  activities: mockActivities,
  modules: mockModules,
  checkinRate: 91.2,
}

/**
 * 学生工作台的 Mock
 * ----------------------------------------------------------------------------
 * 刻意只放「我自己的」数据：没有班级签到率、没有模块对接进度、没有别人的成绩。
 * 学生首页如果出现这些，等于把教师的视角漏给了学生。
 */
export const mockMyOverview: MyOverview = {
  studentName: '陈子豪',
  studentNo: '2023010101',
  className: '烹饪工艺与营养 2301',
  course: {
    id: 1,
    title: '《中式热菜制作》—— 糖醋里脊',
    dishes: ['糖醋里脊', '上汤娃娃菜'],
    lessonAt: '2026-11-20 08:00',
    goal: '掌握挂糊厚度与两遍复炸的火候控制，成品酸甜比 1:1.2',
    published: true,
  },
  stats: [
    { key: 'checkin', label: '今日签到', value: 1, unit: '次', icon: 'Camera', tone: 'success' },
    { key: 'score', label: '上次实训得分', value: 88, unit: '分', delta: 3.1, icon: 'DataAnalysis', tone: 'primary' },
    { key: 'courses', label: '本学期课程', value: 12, unit: '节', icon: 'Notebook', tone: 'primary' },
    { key: 'todo', label: '待完成事项', value: 2, unit: '项', icon: 'List', tone: 'warning' },
  ],
  stages: [
    { key: 'checkin', label: '签到与着装', score: 92, weight: 0.15, state: 'done' },
    { key: 'ingredient', label: '食材预处理', score: 85, weight: 0.2, state: 'done' },
    { key: 'cooking', label: '烹饪过程', score: 86, weight: 0.3, state: 'running' },
    { key: 'dish', label: '菜肴成品', score: 0, weight: 0.3, state: 'pending' },
    { key: 'chat', label: '课堂问答', score: 90, weight: 0.05, state: 'done' },
  ],
  todos: [
    {
      id: 'todo_1',
      title: '阅读本节课菜谱',
      hint: '糖醋里脊 · 含 AI 难点标注',
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
      description: '烹饪工艺与营养 2301 · 相似度 96.4%',
      time: '2026-11-20 08:12',
      actor: '我',
    },
    {
      id: 'my_2',
      type: 'evaluation',
      title: '食材预处理评价已生成',
      description: '切丝均匀度 82 分，成菜规格 88 分',
      time: '2026-11-20 08:36',
      actor: '系统',
    },
    {
      id: 'my_3',
      type: 'evaluation',
      title: '教师调整了烹饪过程得分',
      description: '「下锅油温偏低」扣 4 分，已计入本环节',
      time: '2026-11-20 09:18',
      actor: '陈立群',
    },
  ],
}

export const mockFaceRecords: FaceRecord[] = [
  {
    id: 'rec_1001',
    name: '陈子豪',
    studentNo: '2023010101',
    className: '烹饪工艺与营养 2301',
    timestamp: '2026-11-20T08:12:31',
    similarity: 0.964,
    status: 'success',
  },
  {
    id: 'rec_1002',
    name: '李思影',
    studentNo: '2023010102',
    className: '烹饪工艺与营养 2301',
    timestamp: '2026-11-20T08:09:02',
    similarity: 0.938,
    status: 'success',
  },
  {
    id: 'rec_1003',
    name: '王皓然',
    studentNo: '2023010128',
    className: '西餐工艺 2302',
    timestamp: '2026-11-19T13:47:55',
    similarity: 0.921,
    status: 'success',
  },
  {
    id: 'rec_1004',
    name: '未知用户',
    studentNo: '—',
    className: '—',
    timestamp: '2026-11-19T13:20:10',
    similarity: 0.412,
    status: 'failed',
  },
]

export const mockChatSessions: ChatSession[] = [
  { id: 's_1', title: '焯水时长的教学要点', updatedAt: Date.parse('2026-11-20T09:30:00'), messageCount: 6 },
  { id: 's_2', title: '摆盘色彩搭配建议', updatedAt: Date.parse('2026-11-19T20:12:00'), messageCount: 4 },
  { id: 's_3', title: '刀工评价指标怎么定', updatedAt: Date.parse('2026-11-18T15:44:00'), messageCount: 8 },
]

/** 模拟回答：结构化 Markdown，用于验证渲染与流式效果 */
export function mockAnswerFor(question: string): string {
  return `### 关于「${question.slice(0, 24)}」的说明

这是前端 **Mock 模式** 下的示例回答（后端 SSE 接口就绪后会替换为真实 AI 输出）。以下内容用于验证流式渲染、Markdown 排版与操作按钮：

1. **流式输出**：回答按 token 逐块追加，末尾有光标闪烁；
2. **Markdown 渲染**：标题、列表、行内代码 \`焯水 30s\`、表格、引用均正常；
3. **结束操作**：输出结束后展示「复制」与「重新生成」。

| 环节 | 建议时长 | 判定要点 |
| --- | --- | --- |
| 备菜 | 3–5 min | 原料规格统一，台面整洁 |
| 焯水 | 30–45 s | 水沸后下锅，颜色转亮即捞出 |
| 翻炒 | 90–120 s | 火候均匀，无糊边 |

> 教学提示：过程评价应"以过程性数据说话"，把动作频率、环节耗时作为可量化观测点，而不是只给最终分数。

如需接入真实模型，请把 \`.env.development\` 中的 \`VITE_USE_MOCK\` 改为 \`false\`，并确认 FastAPI 的 \`/api/v1/chat\` 已按 \`text/event-stream\` 返回。`
}
