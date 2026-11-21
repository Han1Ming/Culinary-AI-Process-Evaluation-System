import type { UserRole } from '@/types'

/**
 * 侧边栏菜单配置
 * ----------------------------------------------------------------------------
 * 与路由表保持一致。分组（group）只影响侧栏的视觉分节，
 * 不影响权限与路由本身；新增页面时同步在这里登记即可。
 *
 * 七个评价模块放在同一组且顺序固定——它们对应一节课的时间顺序，
 * 顺序变了会让使用者对不上号。
 *
 * roles 缺省表示三个角色都能看见。差异化的边界在 config/permissions.ts：
 *   学生   概览（仅自己）→ 课程 → 七个模块 → 问答
 *   教师   多出「评价总览」与课程上传/复核能力
 *   管理员 多出「系统管理」整组（用户 + 通知），且没有浮空助手
 */
export interface MenuItem {
  path: string
  title: string
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
    items: [
      { path: '/dashboard', title: '工作台', icon: 'Odometer' },
      { path: '/ai-eval', title: '评价总览', icon: 'DataAnalysis', roles: ['teacher', 'admin'] },
    ],
  },
  {
    title: '教学',
    items: [{ path: '/courses', title: '课程管理', icon: 'Notebook' }],
  },
  {
    title: '评价模块',
    items: [
      { path: '/face-checkin', title: '人脸识别签到', icon: 'Camera' },
      { path: '/modules/uniform', title: '着装规范识别', icon: 'User' },
      { path: '/modules/ingredient', title: '食材预处理', icon: 'KnifeFork' },
      { path: '/modules/cooking', title: '烹饪过程', icon: 'Timer' },
      { path: '/modules/dish', title: '菜肴成品分析', icon: 'Dish' },
      { path: '/modules/summary', title: '综合评价', icon: 'Document' },
    ],
  },
  {
    title: '辅助',
    items: [{ path: '/chat', title: '智能 AI 老师', icon: 'ChatDotRound', roles: ['student', 'teacher'] }],
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
        ],
      },
    ],
  },
]
