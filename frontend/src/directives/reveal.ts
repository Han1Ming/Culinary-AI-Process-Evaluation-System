import type { Directive } from 'vue'

/**
 * v-reveal —— 滚动到视口才播放的进场
 * ----------------------------------------------------------------------------
 * 用法：
 *   <section v-reveal>                    默认 0ms
 *   <li v-reveal="{ delay: i * 60 }">     组内依次进场
 *
 * 三条实现约定（决定了它「不烦人」）：
 *   1. **只播一次**。进场后立刻 unobserve，往回滚不会重播——
 *      重播是模板站最典型的动作，读第二遍时内容闪一下很打断。
 *   2. **位移 14px、520ms、快起慢收**。位移再大就成了「看动画」；
 *      时长低于 320ms 又会显得生硬。
 *   3. **系统开了「减少动态效果」直接显示**，连观察器都不挂。
 *
 * 类名在 mounted 里加（不是 created）：Vue 挂载元素时会在 created 之后
 * 应用 class 属性，`el.className = '...'` 会把刚加上的 reveal 类覆盖掉。
 * mounted 在属性应用之后同步执行，浏览器还没来得及绘制，所以不会闪。
 */
type RevealValue = number | { delay?: number } | undefined

const REVEAL_CLASS = 'reveal'
const REVEALED_CLASS = 'is-revealed'

let observer: IntersectionObserver | null = null

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 全局共用一个观察器：几十个卡片各建一个既浪费又抢主线程 */
function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add(REVEALED_CLASS)
          observer?.unobserve(entry.target)
        }
      },
      {
        // 12% 露出即触发：整屏高的分区不会等到滚到底才开始
        threshold: 0.12,
        // 下沿内缩，让进场发生在视线真正落上去之前，而不是刚碰到屏幕边缘
        rootMargin: '0px 0px -8% 0px',
      },
    )
  }
  return observer
}

function delayOf(value: RevealValue): number {
  if (typeof value === 'number') return value
  return value?.delay ?? 0
}

export const vReveal: Directive<HTMLElement, RevealValue> = {
  // 不能写在 created 里：Vue 挂载元素时会在 created 之后应用 class 属性，
  // `el.className = '...'` 会把这里刚加上的 reveal 类整个覆盖掉。
  // mounted 在属性应用之后、浏览器绘制之前跑，既不丢类也不闪。
  mounted(el, binding) {
    el.classList.add(REVEAL_CLASS)
    el.style.setProperty('--reveal-delay', `${delayOf(binding.value)}ms`)

    // 老浏览器或用户偏好减少动效：不藏内容
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      el.classList.add(REVEALED_CLASS)
      return
    }
    getObserver().observe(el)
  },
  unmounted(el) {
    observer?.unobserve(el)
  },
}

export default vReveal
