import type { UserRole } from '@/types'

/**
 * 角色与权限的唯一事实来源
 * ----------------------------------------------------------------------------
 * 三个角色不是「功能开关」，而是三条不同的工作流：
 *   学生 —— 完成实训、上传成品、看自己的成绩；
 *   教师 —— 组织一节课（课程、复核、扣分、归档），关心的是「这一分怎么来的」；
 *   管理员 —— 管人、管通知、看全站，不参与具体评分。
 *
 * 侧栏 / 路由 meta / 页面内操作统一读这里，避免三处各写一份 if (role === ...)。
 */

export type Capability =
  | 'dashboard.site' // 全站态势（学生只见自己）
  | 'eval.overview' // 评价总览（模块接入进度）
  | 'module.review' // 模块内人工判定 / 直接扣分
  | 'summary.class' // 班级名单与他人成绩
  | 'course.upload' // 上传课程菜谱
  | 'user.manage' // 用户管理
  | 'notice.publish' // 通知发布
  | 'assistant.use' // 浮空助手

const CAPABILITIES: Record<Capability, UserRole[]> = {
  'dashboard.site': ['teacher', 'admin'],
  'eval.overview': ['teacher', 'admin'],
  'module.review': ['teacher', 'admin'],
  'summary.class': ['teacher', 'admin'],
  'course.upload': ['teacher', 'admin'],
  'user.manage': ['admin'],
  'notice.publish': ['admin'],
  'assistant.use': ['teacher', 'student'],
}

export function can(role: UserRole, capability: Capability): boolean {
  return CAPABILITIES[capability].includes(role)
}

/* ---------------- 角色定位文案 ---------------- */

export interface RoleScope {
  title: string
  /** 一句话说明这个角色在系统里干什么 */
  summary: string
  /** 能力要点，3 条以内 */
  points: string[]
}

export const ROLE_SCOPE: Record<UserRole, RoleScope> = {
  student: {
    title: '学生',
    summary: '完成一节课的实训链路，并查看属于自己的成绩。',
    points: [
      '人脸签到、着装规范、食材预处理、烹饪过程、成品分析由本人操作',
      '只看到自己的综合评价，看不到班级里其他同学的成绩',
      '接收教师上传的课程菜谱，可以让 AI 先讲难点与易错点',
    ],
  },
  teacher: {
    title: '教师',
    summary: '组织课程与评价过程，对学生的判定结果有最终裁量权。',
    points: [
      '上传本节课菜肴的菜谱，指定班级与实训目标',
      '在评价模块里直接参与判定：不合规的操作当场扣分并留痕',
      '查看班级名单、复核与归档成绩，导出班级成绩单',
    ],
  },
  admin: {
    title: '系统管理员',
    summary: '维护账号体系与通知，掌握全站运行情况，不参与具体评分。',
    points: [
      '管理学生与教师账号，补录人脸照片、重置密码、启停用',
      '发布系统通知与功能更新公告',
      '查看全站态势；不需要浮空助手，默认关闭',
    ],
  },
}

/* ---------------- 七个模块 × 三个角色 ---------------- */

export type AccessLevel = 'none' | 'use' | 'review' | 'manage'

export interface ModuleAccessRow {
  /** 模块名 */
  module: string
  path: string
  student: { level: AccessLevel; note: string }
  teacher: { level: AccessLevel; note: string }
  admin: { level: AccessLevel; note: string }
}

/**
 * 这张表同时被两处使用：
 * 1. 评价总览页「按角色分工」矩阵（让评审一眼看到差异化）；
 * 2. 侧栏菜单的可见性说明文案。
 */
export const MODULE_ACCESS: ModuleAccessRow[] = [
  {
    module: '人脸识别签到',
    path: '/face-checkin',
    student: { level: 'use', note: '本人签到' },
    teacher: { level: 'review', note: '核验代签、补录' },
    admin: { level: 'manage', note: '查全站签到' },
  },
  {
    module: '着装规范识别',
    path: '/modules/uniform',
    student: { level: 'use', note: '自检后开始实操' },
    teacher: { level: 'review', note: '不合规直接扣分' },
    admin: { level: 'manage', note: '只看统计' },
  },
  {
    module: '食材预处理评价',
    path: '/modules/ingredient',
    student: { level: 'use', note: '切配过程取样' },
    teacher: { level: 'review', note: '规格不符扣分' },
    admin: { level: 'manage', note: '只看统计' },
  },
  {
    module: '烹饪过程评价',
    path: '/modules/cooking',
    student: { level: 'use', note: '按步骤完成' },
    teacher: { level: 'review', note: '跳步/超时扣分' },
    admin: { level: 'manage', note: '只看统计' },
  },
  {
    module: '菜肴成品分析',
    path: '/modules/dish',
    student: { level: 'use', note: '上传成品图' },
    teacher: { level: 'review', note: '调整维度分' },
    admin: { level: 'manage', note: '只看统计' },
  },
  {
    module: 'AI 综合评价',
    path: '/modules/summary',
    student: { level: 'use', note: '仅本人报告' },
    teacher: { level: 'review', note: '复核、归档、导出' },
    admin: { level: 'manage', note: '全站报表' },
  },
  {
    module: '智能 AI 老师',
    path: '/chat',
    student: { level: 'use', note: '问菜品与工艺' },
    teacher: { level: 'use', note: '备课与规则答疑' },
    admin: { level: 'none', note: '不参与' },
  },
]

/** 矩阵里的短标记，用于表头列 */
export const ROLE_COLUMNS: Array<{ role: UserRole; label: string }> = [
  { role: 'student', label: '学生' },
  { role: 'teacher', label: '教师' },
  { role: 'admin', label: '管理员' },
]
