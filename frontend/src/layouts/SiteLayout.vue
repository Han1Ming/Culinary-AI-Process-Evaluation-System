<script setup lang="ts">
/**
 * 官网外壳
 * ----------------------------------------------------------------------------
 * 与后台的 DefaultLayout 完全分离：这里是营销站，信息密度低、留白大、
 * 没有侧栏与面包屑。
 *
 * 视觉决策（依据 design-taste-frontend / system.md）：
 *   · 顶栏固定、纯白、1px 底线，滚动时不做阴影、不做收缩、不做毛玻璃
 *   · 全站只有一个填充按钮，其余都是文字链接
 *   · 移动端菜单为全屏覆盖，不是抽屉
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { navLinks } from '@/views/site/data'

const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)
/** 当前正在阅读的区块，用于导航高亮 */
const activeHref = ref('')

/** 高亮判定的基准线（px）：导航 72 + 24 余量 */
const NAV_LINE = 96

function goLogin() {
  menuOpen.value = false
  void router.push('/login')
}

function goContact() {
  menuOpen.value = false
  void router.push('/demo')
}

/**
 * 等元素出现再滚。
 * 首页是异步路由（`() => import(...)`），`router.push('/')` 返回时组件可能
 * 还在一帧之后才挂上来，此刻 querySelector 拿到 null，点了就是没反应。
 * 用 rAF 轮询而不是固定延时：通常是 1–2 帧就好了，固定 300ms 会显得迟钝。
 */
function untilExists(selector: string, timeout = 1200): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now()
    const tick = () => {
      if (document.querySelector(selector) || performance.now() - start > timeout) resolve()
      else requestAnimationFrame(tick)
    }
    tick()
  })
}

/**
 * 锚点跳转。
 * 导航在 /demo、/privacy 这些子页面上同样可见，所以先回首页再滚，
 * 否则 querySelector 找不到节点，点了没反应。
 */
async function jump(href: string) {
  menuOpen.value = false
  if (route.path !== '/') {
    await router.push('/')
    await untilExists(href)
  }
  document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // 直接落位高亮，不依赖 scroll 事件推断：滚动到位后可能只剩一帧，
  // 用推断的方式会在快速点击时停在上一节
  activeHref.value = href
}

// 移动端菜单展开时锁住 body 滚动，避免背后的页面跟着动
watch(menuOpen, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

/**
 * 导航高亮：取「已越过导航下沿、且离导航下沿最近的区块」。
 *
 * 用 scroll + rAF 而不是 IntersectionObserver——观察器的回调在快速滚动时
 * 会集中在动画帧末尾触发，高亮切换比内容慢半拍，观感上像卡了一下。
 *
 * 为什么是「最近」而不是「最后一个」：浏览器恢复滚动位置、或用户从外链
 * 直接落在页面中间时，会有多个区块同时位于基准线以上；取最近的那个才与
 * 眼睛看到的一致。前提是 navLinks 的顺序必须与页面 DOM 顺序一致。
 */
let scrollRaf = 0
function syncActive() {
  cancelAnimationFrame(scrollRaf)
  scrollRaf = requestAnimationFrame(() => {
    let current = ''
    let nearest = Number.NEGATIVE_INFINITY
    for (const link of navLinks) {
      const el = document.getElementById(link.href.slice(1))
      if (!el) continue
      const top = el.getBoundingClientRect().top
      if (top <= NAV_LINE && top > nearest) {
        nearest = top
        current = link.href
      }
    }
    activeHref.value = current
  })
}

onMounted(() => {
  syncActive()
  window.addEventListener('scroll', syncActive, { passive: true })
})

// 顶栏在滚动时不做任何变化（不加阴影、不收缩），这是刻意的：
// 固定层上的状态变化会让人分心，也让页面看起来像模板。
onBeforeUnmount(() => {
  document.body.style.removeProperty('overflow')
  window.removeEventListener('scroll', syncActive)
  cancelAnimationFrame(scrollRaf)
})
</script>

<template>
  <div class="site">
    <a class="site__skip" href="#main">跳到主要内容</a>

    <header class="site-nav">
      <div class="site-nav__inner">
        <RouterLink to="/" class="brand" aria-label="烹饪 AI 过程评价系统 首页">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 17h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <path
                d="M6 17V9.5A2.5 2.5 0 0 1 8.5 7h7A2.5 2.5 0 0 1 18 9.5V17"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path d="M9.5 7V4.5M14.5 7V4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </span>
          <span class="brand__text">
            <strong>烹饪 AI 评价系统</strong>
            <em>实训过程量化</em>
          </span>
        </RouterLink>

        <nav class="site-nav__links" aria-label="主导航">
          <button
            v-for="link in navLinks"
            :key="link.href"
            type="button"
            class="nav-link"
            :class="{ 'is-active': activeHref === link.href }"
            :aria-current="activeHref === link.href ? 'true' : undefined"
            @click="jump(link.href)"
          >
            {{ link.label }}
          </button>
        </nav>

        <div class="site-nav__actions">
          <button type="button" class="link-btn" @click="goLogin">登录</button>
          <button type="button" class="btn btn--primary" @click="goContact">预约演示</button>
        </div>

        <button
          type="button"
          class="site-nav__toggle"
          :aria-expanded="menuOpen"
          aria-label="打开导航菜单"
          @click="menuOpen = !menuOpen"
        >
          <span :class="{ 'is-open': menuOpen }" />
        </button>
      </div>
    </header>

    <Transition name="sheet">
      <div v-if="menuOpen" class="sheet">
        <nav class="sheet__links" aria-label="移动端导航">
          <button
            v-for="link in navLinks"
            :key="link.href"
            type="button"
            class="sheet__link"
            :class="{ 'is-active': activeHref === link.href }"
            @click="jump(link.href)"
          >
            {{ link.label }}
          </button>
        </nav>
        <div class="sheet__actions">
          <button type="button" class="btn btn--ghost" @click="goLogin">登录</button>
          <button type="button" class="btn btn--primary" @click="goContact">预约演示</button>
        </div>
      </div>
    </Transition>

    <main id="main" class="site__main">
      <RouterView />
    </main>

    <footer class="site-foot">
      <div class="site-foot__inner">
        <div class="site-foot__brand">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 17h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              <path
                d="M6 17V9.5A2.5 2.5 0 0 1 8.5 7h7A2.5 2.5 0 0 1 18 9.5V17"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <path d="M9.5 7V4.5M14.5 7V4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <p class="site-foot__name">烹饪 AI 过程评价系统</p>
            <p class="site-foot__desc">面向烹饪实训的过程量化与成绩生成</p>
          </div>
        </div>

        <div class="site-foot__cols">
          <div class="foot-col">
            <h3>产品</h3>
            <button type="button" @click="jump('#modules')">评价模块</button>
            <button type="button" @click="jump('#pricing')">定价方案</button>
            <button type="button" @click="jump('#flow')">课堂流程</button>
            <button type="button" @click="jump('#product')">系统界面</button>
            <button type="button" @click="jump('#scenes')">应用场景</button>
          </div>
          <div class="foot-col">
            <h3>实施</h3>
            <button type="button" @click="jump('#delivery')">四周上线</button>
            <button type="button" @click="jump('#delivery')">验收指标</button>
            <button type="button" @click="jump('#integration')">接口对接</button>
            <button type="button" @click="jump('#faq')">常见问题</button>
          </div>
          <div class="foot-col">
            <h3>账号与条款</h3>
            <button type="button" @click="goLogin">登录系统</button>
            <button type="button" @click="goContact">预约演示</button>
            <button type="button" @click="router.push('/privacy')">隐私政策</button>
            <button type="button" @click="router.push('/terms')">服务条款</button>
          </div>
        </div>
      </div>

      <div class="site-foot__legal">
        <span>© 2026 烹饪 AI 过程评价系统</span>
        <span class="site-foot__note">
          页面照片为教学场景示意图，系统界面截取自本项目实际运行版本。
        </span>
      </div>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.site {
  min-height: 100vh;
  background: $site-ground;
  scroll-padding-top: $site-nav-height;

  &__skip {
    position: absolute;
    top: -60px;
    left: 16px;
    z-index: 100;
    padding: 10px 16px;
    font-size: $site-small;
    color: #fff;
    background: $site-ink;
    border-radius: $radius-md;
    transition: top $duration-fast $ease-standard;

    &:focus-visible {
      top: 12px;
    }
  }

  &__main {
    padding-top: $site-nav-height;
  }
}

// ---------- 顶栏 ----------
.site-nav {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 20;
  height: $site-nav-height;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid $color-border-light;

  &__inner {
    display: flex;
    align-items: center;
    gap: $space-8;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    height: 100%;
    margin: 0 auto;
    padding: 0 $site-gutter;
  }

  &__links {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: $space-2;
  }

  &__actions {
    display: flex;
    gap: $space-3;
    align-items: center;
    margin-left: auto;
  }

  &__toggle {
    display: none;
  }
}

.brand {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
  text-decoration: none;

  &__mark {
    display: grid;
    width: 32px;
    height: 32px;
    color: #fff;
    background: $site-ink;
    border-radius: $radius-md;
    place-items: center;

    svg {
      width: 20px;
      height: 20px;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;

    strong {
      font-size: 15px;
      font-weight: 600;
      color: $site-ink;
      letter-spacing: -0.01em;
    }

    em {
      font-size: 11px;
      font-style: normal;
      color: $site-ink-muted;
      letter-spacing: 0.02em;
    }
  }
}

.nav-link {
  position: relative;
  padding: 8px 13px;
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 500;
  color: $site-ink-muted;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: $radius-sm;
  transition: color $duration-fast $ease-standard;

  // 下划线只在中线位置长出来，不用背景块：背景块会让六个链接看起来像六个按钮
  &::after {
    position: absolute;
    right: 13px;
    bottom: 3px;
    left: 13px;
    height: 1.5px;
    content: '';
    background: $site-ink;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 220ms $ease-standard;
  }

  &:hover {
    color: $site-ink;
  }

  &.is-active {
    color: $site-ink;

    &::after {
      transform: scaleX(1);
    }
  }
}

// ---------- 移动端全屏菜单 ----------
.sheet {
  position: fixed;
  top: $site-nav-height;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 19;
  display: flex;
  flex-direction: column;
  padding: $space-6 $site-gutter-phone $space-8;
  background: $site-ground;

  &__links {
    display: flex;
    flex-direction: column;
  }

  &__link {
    padding: 18px 0;
    font-family: inherit;
    font-size: 20px;
    font-weight: 500;
    color: $site-ink-soft;
    text-align: left;
    cursor: pointer;
    background: none;
    border: 0;
    border-bottom: 1px solid $color-border-light;

    &.is-active {
      color: $site-ink;
    }
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    margin-top: auto;

    .btn {
      width: 100%;
    }
  }
}

.sheet-enter-active,
.sheet-leave-active {
  transition:
    opacity $duration-base $ease-standard,
    transform $duration-base $ease-standard;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

// ---------- 页脚 ----------
.site-foot {
  padding: 72px 0 40px;
  background: $site-ground-alt;
  border-top: 1px solid $color-border-light;

  &__inner {
    display: flex;
    gap: $space-10;
    justify-content: space-between;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 0 $site-gutter;
  }

  &__brand {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    max-width: 320px;
  }

  &__name {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    color: $site-ink;
  }

  &__desc {
    margin: 0;
    font-size: $site-label;
    line-height: 1.6;
    color: $site-ink-muted;
  }

  &__cols {
    display: flex;
    gap: 64px;
  }

  &__legal {
    display: flex;
    gap: $space-4;
    justify-content: space-between;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: $space-10 auto 0;
    padding: $space-5 $site-gutter 0;
    font-size: $site-label;
    color: $site-ink-muted;
    border-top: 1px solid $color-border-light;
  }

  &__note {
    text-align: right;
  }
}

.foot-col {
  display: flex;
  flex-direction: column;
  gap: 10px;

  h3 {
    margin: 0 0 4px;
    font-size: $site-label;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: 0.02em;
  }

  button {
    padding: 0;
    font-size: $site-small;
    color: $site-ink-muted;
    text-align: left;
    cursor: pointer;
    background: none;
    border: 0;
    transition: color $duration-fast $ease-standard;

    &:hover {
      color: $site-ink;
    }
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .site-nav__inner {
    padding: 0 $site-gutter-tablet;
  }

  .site-nav__links {
    display: none;
  }

  .site-nav__toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    // 操作区在窄屏被隐藏后，汉堡要自己顶到最右
    margin-left: auto;
    cursor: pointer;
    background: none;
    border: 0;

    span {
      position: relative;
      display: block;
      width: 18px;
      height: 1.5px;
      background: $site-ink;
      transition: background-color $duration-fast $ease-standard;

      &::before,
      &::after {
        position: absolute;
        left: 0;
        width: 18px;
        height: 1.5px;
        content: '';
        background: $site-ink;
        transition: transform $duration-fast $ease-standard;
      }

      &::before {
        top: -6px;
      }

      &::after {
        top: 6px;
      }

      &.is-open {
        background: transparent;

        &::before {
          transform: translateY(6px) rotate(45deg);
        }

        &::after {
          transform: translateY(-6px) rotate(-45deg);
        }
      }
    }
  }

  .site-nav__actions {
    display: none;
  }

  .site-foot__inner {
    flex-direction: column;
    gap: $space-8;
    padding: 0 $site-gutter-tablet;
  }

  .site-foot__cols {
    gap: $space-8;
  }

  .site-foot__legal {
    padding: $space-5 $site-gutter-tablet 0;
  }
}

@media (max-width: $breakpoint-sm) {
  .site-nav__inner {
    padding: 0 $site-gutter-phone;
  }

  .site-foot {
    padding: 56px 0 32px;
  }

  .site-foot__inner,
  .site-foot__legal {
    padding: 0 $site-gutter-phone;
  }

  .site-foot__cols {
    gap: $space-6;
    justify-content: space-between;
  }

  .site-foot__legal {
    flex-direction: column;
    gap: 8px;
    padding-top: $space-4;
  }

  .site-foot__note {
    text-align: left;
  }
}
</style>
