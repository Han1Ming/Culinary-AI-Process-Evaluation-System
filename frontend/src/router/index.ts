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
        path: 'courses/:id',
        name: 'CourseDetail',
        component: () => import('@/views/courses/detail.vue'),
        meta: { title: '课程详情', parentTitle: '课程管理', roles: ['teacher', 'admin', 'student'] },
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
        meta: { title: '智能 AI 老师', icon: 'ChatDotRound', roles: ['student', 'teacher'] },
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
