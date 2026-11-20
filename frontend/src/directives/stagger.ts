import type { Directive } from 'vue'

/**
 * v-stagger —— 列表/卡片组的顺序进场
 * ----------------------------------------------------------------------------
 * 作用：给容器的每个直接子元素写入 `--i` 序号，配合 `.animate-in` 类
 *       形成依次出现的阅读节奏；避免「整屏元素同时闪现」的廉价感。
 *
 * 用法：
 *   <ul v-stagger>            <!-- 默认间隔 34ms -->
 *     <li class="animate-in">…</li>
 *   </ul>
 *   <ul v-stagger="50">       <!-- 自定义间隔 50ms -->
 *
 * 注意：只处理已渲染的子元素。异步数据到达后 DOM 会更新，`updated` 钩子
 *       会重新编号；如果列表是 v-for 且长度变化，序号会自动对齐。
 */
function applyIndex(el: HTMLElement, step?: number): void {
  if (step) el.style.setProperty('--stagger-step', `${step}ms`)
  Array.from(el.children).forEach((child, index) => {
    ;(child as HTMLElement).style.setProperty('--i', String(index))
  })
}

export const vStagger: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    applyIndex(el, binding.value)
  },
  updated(el, binding) {
    applyIndex(el, binding.value)
  },
}

export default vStagger
