import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * 数字滚动（count-up）
 * ----------------------------------------------------------------------------
 * 为什么不用 CSS：数值变化需要「连续」，CSS transition 只能处理已声明的属性，
 * 而 textContent 的插值必须逐帧计算。
 *
 * 特性：
 *  · requestAnimationFrame 驱动，easeOutExpo 曲线（开头快、收尾慢，符合直觉）
 *  · 尊重 prefers-reduced-motion：直接落到终值，不播放
 *  · 数字变化时从「当前显示值」继续，不会跳回 0 重来
 *  · 输出已格式化的字符串（千分位 + 固定小数位），供模板直接绑定
 *
 * @example
 * const { display } = useCountUp(computed(() => stats.value.total), { decimals: 1 })
 */
export interface CountUpOptions {
  /** 动画时长（毫秒），默认 900 */
  duration?: number
  /** 小数位数，默认 0 */
  decimals?: number
  /** 起始延迟，用于等骨架屏退场 */
  delay?: number
  /** 是否输出千分位分隔符，默认 true */
  separator?: boolean
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function format(value: number, decimals: number, separator: boolean): string {
  const fixed = value.toFixed(decimals)
  if (!separator) return fixed
  const [int, dec] = fixed.split('.')
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec ? `${withComma}.${dec}` : withComma
}

/** easeOutExpo：t=1 时精确等于 1，保证落点无误差 */
const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function useCountUp(source: Ref<number>, options: CountUpOptions = {}) {
  const { duration = 900, decimals = 0, delay = 0, separator = true } = options

  let frame = 0
  let timer = 0
  // 记录当前显示到的数值，作为下一次动画的起点
  let current = 0

  const display = ref(format(source.value, decimals, separator))

  function stop(): void {
    if (frame) cancelAnimationFrame(frame)
    if (timer) window.clearTimeout(timer)
    frame = 0
    timer = 0
  }

  function play(to: number): void {
    stop()

    if (prefersReducedMotion()) {
      current = to
      display.value = format(to, decimals, separator)
      return
    }

    const from = current
    const delta = to - from
    if (delta === 0) return

    timer = window.setTimeout(() => {
      const start = performance.now()
      const tick = (now: number): void => {
        const progress = Math.min((now - start) / duration, 1)
        current = from + delta * easeOutExpo(progress)
        display.value = format(current, decimals, separator)
        if (progress < 1) {
          frame = requestAnimationFrame(tick)
        } else {
          // 收尾对齐到目标值，消除浮点误差
          current = to
          display.value = format(to, decimals, separator)
          frame = 0
        }
      }
      frame = requestAnimationFrame(tick)
    }, delay)
  }

  // immediate: true —— 首次进入页面也播放，让数据「落位」而不是直接出现
  watch(source, (value) => play(value), { immediate: true })

  onBeforeUnmount(stop)

  return { display, replay: () => play(source.value) }
}
