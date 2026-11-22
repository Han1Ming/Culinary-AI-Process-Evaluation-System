import type { UserRole } from '@/types'

/**
 * 侧边栏菜单配置
 * ----------------------------------------------------------------------------
 * 与路由表保持一致。分组（group）只影响侧栏的视觉分节，
 * 不影响权限与路由本身；新增页面时同步在这里登记即可。
 *
 * 结构原则（本轮精简后）：
 *   概览 —— 只有工作台，它是每个角色进系统后的第一屏；
 *   教学 —— 课程、班级名单、实训档案、AI 助手，都是「课前课后」的事；
 *   评价 —— 评价总览 + 七个模块，全部按一节课的时间顺序排；
 *   系统 —— 仅管理员，账号 / 通知 / 设备。
 *
 * 「评价总览」原来在概览组，与工作台并列，两个都在讲"全站态势"，教师会点错；
 * 移到评价组首位后，它自然成为"从总览下钻到具体模块"的入口。
 *
 * titles 用于同一页面在不同角色下的不同叫法（AI 助手 / AI 老师），
 * 不在页面里写 role === 'student' ? ... : ...，避免同一句话散落多处。
 */
export interface MenuItem {
  path: string
  title: string
  /** 按角色覆盖显示名，未命中时用 title */
  titles?: Partial<Record<UserRole, string>>
  icon: string
  /** 可见角色，缺省表示所有角色可见 */
  roles?: UserRole[]
  children?: MenuItem[]
}

export interface MenuGroup {
  /** 分节标题，侧栏折叠时自动隐藏 */
  title: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    title: '概览',
    items: [{ path: '/dashboard', title: '工作台', icon: 'Odometer' }],
  },
  {
    title: '教学',
    items: [
      { path: '/courses', title: '课程管理', titles: { student: '我的课程' }, icon: 'Notebook' },
      { path: '/classes', title: '班级名单', icon: 'UserFilled', roles: ['teacher', 'admin'] },
      {
        path: '/archive',
        title: '实训档案',
        titles: { student: '我的实训档案' },
        icon: 'Collection',
      },
      {
        path: '/chat',
        title: '智能 AI 助手',
        titles: { student: '智能 AI 老师' },
        icon: 'ChatDotRound',
        roles: ['student', 'teacher'],
      },
    ],
  },
  {
    title: '评价',
    items: [
      { path: '/ai-eval', title: '评价总览', icon: 'DataAnalysis', roles: ['teacher', 'admin'] },
      { path: '/face-checkin', title: '人脸识别签到', icon: 'Camera' },
      { path: '/modules/uniform', title: '着装规范识别', icon: 'User' },
      { path: '/modules/ingredient', title: '食材预处理', icon: 'KnifeFork' },
      { path: '/modules/cooking', title: '烹饪过程', icon: 'Timer' },
      { path: '/modules/dish', title: '菜肴成品分析', icon: 'Dish' },
      { path: '/modules/summary', title: '综合评价', titles: { student: '我的成绩' }, icon: 'Document' },
    ],
  },
  {
    title: '系统',
    items: [
      {
        path: '/system',
        title: '系统管理',
        icon: 'Setting',
        roles: ['admin'],
        children: [
          { path: '/system/user', title: '用户管理', icon: 'User', roles: ['admin'] },
          { path: '/system/notice', title: '通知发布', icon: 'Bell', roles: ['admin'] },
          { path: '/system/device', title: '工位与设备', icon: 'Monitor', roles: ['admin'] },
        ],
      },
    ],
  },
]

/** 当前角色看到的菜单标题 */
export function menuTitle(item: MenuItem, role: UserRole): string {
  return item.titles?.[role] ?? item.title
}
