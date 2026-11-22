import type { ChatSession, User } from '@/types'

import faceChen from '@/assets/images/faces/chen-zihao.jpg'
import faceLi from '@/assets/images/faces/li-siying.jpg'
import faceWang from '@/assets/images/faces/wang-haoran.jpg'

/**
 * 前端 Mock 数据中枢
 * 用途：后端接口未就绪阶段，保证每个页面都能完整跑通、可演示
 * 切换：.env 中 VITE_USE_MOCK=true 开启，false 走真实接口
 *
 * 工作台的两份概览（教师 / 学生）不在这里，见 mock/workbench.ts：
 * 那边的每个数字都要追到花名册与设备表上，放在一起会让本文件变成大杂烩。
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
    email: 'chenzh@culinary.edu.cn',
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
    email: 'lisy@culinary.edu.cn',
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
    email: 'wanghr@culinary.edu.cn',
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
    email: 'zhaoyn@culinary.edu.cn',
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
