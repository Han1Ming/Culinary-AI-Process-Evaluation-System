import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { setupRouterGuard } from './guard'
import type { UserRole } from '@/types'

// 路由 meta 类型增强，避免在守卫里用 as 断言
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** 面包屑上级标题，如「系统管理 / 用户管理」 */
    parentTitle?: string
    icon?: string
    /** 无需登录即可访问 */
    public?: boolean
    /** 允许访问的角色，不写表示全部登录用户可访问 */
    roles?: UserRole[]
  }
}

const routes: RouteRecordRaw[] = [
  // ---------- 官网（公开）----------
  {
    path: '/',
    component: () => import('@/layouts/SiteLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/site/index.vue'),
        meta: { title: '烹饪实训 AI 过程评价系统', public: true },
      },
      // 官网唯一的转化出口：留资表单（不复用学生注册页）
      {
        path: 'demo',
        name: 'Demo',
        component: () => import('@/views/site/demo.vue'),
        meta: { title: '预约演示', public: true },
      },
      // 合规文档：B2B 采购的标书附件必备项
      {
        path: 'privacy',
        name: 'Privacy',
        component: () => import('@/views/site/legal.vue'),
        meta: { title: '隐私政策', public: true },
      },
      {
        path: 'terms',
        name: 'Terms',
        component: () => import('@/views/site/legal.vue'),
        meta: { title: '服务条款', public: true },
      },
    ],
  },
  // ---------- 注册与登录（公开）----------
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import('@/views/login/index.vue'),
        meta: { title: '登录', public: true },
      },
    ],
  },
  {
    path: '/register',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'Register',
        component: () => import('@/views/register/index.vue'),
        meta: { title: '申请开通', public: true },
      },
    ],
  },
  // ---------- 后台 ----------
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'Odometer' },
      },
      {
        path: 'ai-eval',
        name: 'AiEvaluation',
        component: () => import('@/views/ai-eval/index.vue'),
        meta: { title: '评价总览', icon: 'DataAnalysis', roles: ['teacher', 'admin'] },
      },
      {
        path: 'courses',
        name: 'Courses',
        component: () => import('@/views/courses/index.vue'),
        meta: { title: '课程管理', icon: 'Notebook' },
      },
      {
        // 班级名单 + 白名单导入：教师开学第一件事，不属于系统管理
        path: 'classes',
        name: 'Classes',
        component: () => import('@/views/classes/index.vue'),
        meta: { title: '班级名单', parentTitle: '教学', icon: 'UserFilled', roles: ['teacher', 'admin'] },
      },
      {
        // 与右上角用户名、侧栏底部「个人中心」是同一个页面，三个入口一个实现
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '个人中心', icon: 'User' },
      },
      {
        // 公告中心：不进侧栏菜单，入口是顶栏铃铛「查看全部公告」与工作台公告卡；
        // 三个角色都要能读，管理员发布的东西才有落地页
        path: 'notices',
        name: 'Notices',
        component: () => import('@/views/notices/index.vue'),
        meta: { title: '公告', icon: 'Bell' },
      },
      {
        path: 'courses/:id',
        name: 'CourseDetail',
        component: () => import('@/views/courses/detail.vue'),
        meta: { title: '课程详情', parentTitle: '课程管理', roles: ['teacher', 'admin', 'student'] },
      },
      {
        // 学生本人 /archive；教师 /archive/{id}。学生带别人的 id 进来会被页面拦成无权限态
        path: 'archive/:studentId?',
        name: 'StudentArchive',
        component: () => import('@/views/archive/index.vue'),
        meta: { title: '实训档案', parentTitle: '教学', icon: 'Collection' },
      },
      {
        path: 'face-checkin',
        name: 'FaceCheckin',
        component: () => import('@/views/face-checkin/index.vue'),
        meta: { title: '人脸识别签到', icon: 'Camera' },
      },
      {
        path: 'modules/uniform',
        name: 'ModuleUniform',
        component: () => import('@/views/modules/uniform/index.vue'),
        meta: { title: '着装规范识别', parentTitle: '评价模块', icon: 'User' },
      },
      {
        path: 'modules/ingredient',
        name: 'ModuleIngredient',
        component: () => import('@/views/modules/ingredient/index.vue'),
        meta: { title: '食材预处理评价', parentTitle: '评价模块', icon: 'KnifeFork' },
      },
      {
        path: 'modules/cooking',
        name: 'ModuleCooking',
        component: () => import('@/views/modules/cooking/index.vue'),
        meta: { title: '烹饪过程评价', parentTitle: '评价模块', icon: 'Timer' },
      },
      {
        path: 'modules/dish',
        name: 'ModuleDish',
        component: () => import('@/views/modules/dish/index.vue'),
        meta: { title: '菜肴成品分析', parentTitle: '评价模块', icon: 'Dish' },
      },
      {
        path: 'modules/summary',
        name: 'ModuleSummary',
        component: () => import('@/views/modules/summary/index.vue'),
        meta: { title: '综合评价', parentTitle: '评价模块', icon: 'Document' },
      },
      {
        path: 'chat',
        name: 'Chat',
        component: () => import('@/views/chat/index.vue'),
        // 管理员不参与教学问答：既不需要浮空球，也不需要这个页面
        // 面包屑用中性名「助手」，页面内标题按角色显示（学生「老师」/教师「助手」）
        meta: { title: '智能 AI 助手', icon: 'ChatDotRound', roles: ['student', 'teacher'] },
      },
      {
        path: 'system/user',
        name: 'UserManage',
        component: () => import('@/views/system/user/index.vue'),
        meta: { title: '用户管理', parentTitle: '系统管理', icon: 'User', roles: ['admin'] },
      },
      {
        path: 'system/notice',
        name: 'NoticeManage',
        component: () => import('@/views/system/notice/index.vue'),
        meta: { title: '通知发布', parentTitle: '系统管理', icon: 'Bell', roles: ['admin'] },
      },
      {
        path: 'system/device',
        name: 'DeviceManage',
        component: () => import('@/views/system/device/index.vue'),
        meta: { title: '工位与设备', parentTitle: '系统管理', icon: 'Monitor', roles: ['admin'] },
      },
    ],
  },
  // ---------- 单人报告（独立打印页，不套后台外壳）----------
  // 不在 DefaultLayout 里：侧栏、浮空球、页头都会印上去，A4 一页装不下。
  {
    path: '/modules/summary/report/:studentId',
    name: 'SummaryReport',
    component: () => import('@/views/modules/summary/report.vue'),
    meta: { title: '实训评价报告' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  // 带 hash 的跳转（例如从 /demo 点「查看定价」）必须落到对应区块；
  // 之前统一返回 top:0，锚点全被吞掉，点了停在首屏。
  // 96 = 顶栏 72 + 24 余量，与 SiteLayout 的 NAV_LINE 同源。
  scrollBehavior: (to) => {
    if (to.hash) {
      return { el: to.hash, top: 96, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})

setupRouterGuard(router)

export default router
