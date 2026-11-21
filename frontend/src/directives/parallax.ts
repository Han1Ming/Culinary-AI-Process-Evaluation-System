import type { Directive } from 'vue'

/**
 * v-parallax —— 轻微的视差位移
 * ----------------------------------------------------------------------------
 * 用法：`<div v-parallax="40">` 数值是**整段行程**（px），实际表现为 ±数值/2。
 *
 * 只给两张「实体图」用：首屏的实训照片、产品区的系统截图。
 * 文字一律不做视差——正文跟着手指飘是阅读障碍，不是高级感。
 *
 * 实现要点：
 *   · **位移写进 CSS 变量 `--plx`**，由样式里的 transform 消费。
 *     这样不会顶掉元素自身的 hover / 进场 transform（两者写同一属性会打架）。
 *   · 一个全局 scroll + resize 监听，rAF 合并，元素完全离开视口时跳过计算。
 *   · 窄屏与「减少动态效果」下整个机制不启动，变量保持 0。
 */
const items = new Map<HTMLElement, number>()

let frame = 0
let bound = false

function enabled(): boolean {
  return (
    window.innerWidth >= 1024 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function measure(): void {
  const vh = window.innerHeight
  for (const [el, strength] of items) {
    const rect = el.getBoundingClientRect()
    // 离屏太远的直接跳过，长页面上省掉无意义的读写
    if (rect.bottom < -vh * 0.5 || rect.top > vh * 1.5) continue
    // progress：0 = 刚碰到视口下沿，1 = 已完全离开上沿
    const raw = (vh - rect.top) / (vh + rect.height)
    const progress = Math.min(1, Math.max(0, raw))
    // 滚动越多、offset 越大（向下补一点），视觉上就是「动得比页面慢」
    const offset = (progress - 0.5) * strength
    el.style.setProperty('--plx', `${offset.toFixed(2)}px`)
  }
}

function schedule(): void {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    measure()
  })
}

function reset(): void {
  for (const el of items.keys()) el.style.setProperty('--plx', '0px')
}

function sync(): void {
  if (!items.size) return
  if (enabled()) {
    schedule()
  } else {
    reset()
  }
}

/** 第一个元素注册时才挂监听，页面没用视差就一个监听都不加 */
function bind(): void {
  if (bound) return
  bound = true
  window.addEventListener('scroll', sync, { passive: true })
  window.addEventListener('resize', sync, { passive: true })
}

export const vParallax: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    items.set(el, binding.value ?? 32)
    bind()
    sync()
  },
  unmounted(el) {
    items.delete(el)
    if (items.size) return
    window.removeEventListener('scroll', sync)
    window.removeEventListener('resize', sync)
    bound = false
    cancelAnimationFrame(frame)
    frame = 0
  },
}

export default vParallax
