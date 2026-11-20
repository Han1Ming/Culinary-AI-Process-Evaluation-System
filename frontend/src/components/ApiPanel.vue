<script setup lang="ts">
/**
 * 后端接入面板
 * ----------------------------------------------------------------------------
 * 每个评价模块页面右侧都挂这一块，作用只有一个：让后端同学知道该实现什么。
 * 内容来自各模块的 api/xxx.ts，和前端实际调用的路径保持一致，不会写完就过期。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

import { USE_MOCK, API_BASE_URL } from '@/utils/env'

export interface EndpointSpec {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'WS'
  path: string
  /** 请求体示例（JSON 字符串） */
  request: string
  /** 响应体示例（JSON 字符串） */
  response: string
  /** 一句话说明这个接口在业务上的作用 */
  note?: string
}

const props = withDefaults(
  defineProps<{
    endpoints: EndpointSpec[]
    /** 该模块整体是否已对接后端 */
    ready?: boolean
  }>(),
  { ready: false },
)

const activeIndex = ref(0)
const active = computed(() => props.endpoints[activeIndex.value])

const curl = computed(
  () =>
    `curl -X ${active.value.method} "${API_BASE_URL}${active.value.path}" \\\n  -H "Authorization: Bearer <token>" \\\n  -H "Content-Type: application/json"`,
)

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('浏览器拒绝了剪贴板访问，请手动选中复制')
  }
}
</script>

<template>
  <aside class="api-panel">
    <header class="api-panel__head">
      <div>
        <h2>后端接入</h2>
        <p>{{ endpoints.length }} 个接口 · {{ ready ? '已连通' : '待实现' }}</p>
      </div>
      <span class="api-panel__badge" :class="USE_MOCK ? 'is-mock' : 'is-live'">
        {{ USE_MOCK ? 'Mock' : 'Live' }}
      </span>
    </header>

    <nav class="api-panel__tabs" aria-label="接口列表">
      <button
        v-for="(ep, i) in endpoints"
        :key="ep.path"
        type="button"
        class="api-tab"
        :class="{ 'is-active': activeIndex === i }"
        @click="activeIndex = i"
      >
        <span class="api-tab__method">{{ ep.method }}</span>
        <span class="api-tab__name">{{ ep.name }}</span>
      </button>
    </nav>

    <div class="api-panel__body">
      <div class="api-line">
        <code class="api-line__path">{{ active.path }}</code>
        <button type="button" class="api-line__copy" @click="copy(active.path)">复制</button>
      </div>

      <p v-if="active.note" class="api-note">{{ active.note }}</p>

      <section class="api-block">
        <h3>请求体</h3>
        <pre>{{ active.request }}</pre>
      </section>

      <section class="api-block">
        <h3>响应体</h3>
        <pre>{{ active.response }}</pre>
      </section>

      <section class="api-block">
        <h3>curl</h3>
        <pre class="api-block--wrap">{{ curl }}</pre>
      </section>
    </div>

    <footer class="api-panel__foot">
      <p>
        前端调用已封装在
        <code>src/api/</code>
        下，把 <code>VITE_USE_MOCK</code> 改为 <code>false</code> 即切到真实接口。
      </p>
    </footer>
  </aside>
</template>

<style scoped lang="scss">
.api-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;

  &__head {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    justify-content: space-between;
    padding: 18px 18px 14px;

    h2 {
      margin: 0;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }

    p {
      margin: 3px 0 0;
      font-size: $font-size-xs;
      color: $color-text-secondary;
    }
  }

  &__badge {
    padding: 2px 8px;
    font-family: $font-family-mono;
    font-size: 11px;
    border: 1px solid $color-border;
    border-radius: $radius-pill;

    &.is-mock {
      color: $color-warning;
      background: $color-warning-soft;
      border-color: rgba(180, 83, 9, 0.16);
    }

    &.is-live {
      color: $color-success;
      background: $color-success-soft;
      border-color: rgba(21, 128, 61, 0.16);
    }
  }

  &__tabs {
    display: flex;
    flex-direction: column;
    padding: 0 10px 10px;
    border-bottom: 1px solid $color-border-light;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $space-3;
    padding: 14px 18px;
    overflow-y: auto;
  }

  &__foot {
    padding: 12px 18px 16px;
    border-top: 1px solid $color-border-light;

    p {
      margin: 0;
      font-size: 11px;
      line-height: 1.7;
      color: $color-text-placeholder;
    }

    code {
      padding: 1px 4px;
      font-family: $font-family-mono;
      font-size: 10.5px;
      background: $color-bg-subtle;
      border-radius: 3px;
    }
  }
}

.api-tab {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: $radius-sm;
  transition: background-color $duration-fast $ease-standard;

  &:hover {
    background: $color-bg-subtle;
  }

  &.is-active {
    background: $color-bg-subtle;
  }

  &__method {
    flex-shrink: 0;
    width: 34px;
    font-family: $font-family-mono;
    font-size: 10px;
    color: $color-text-placeholder;
  }

  &.is-active &__method {
    color: $color-primary;
  }

  &__name {
    overflow: hidden;
    font-size: $font-size-xs;
    color: $color-text-regular;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.is-active &__name {
    color: $color-text-primary;
  }
}

.api-line {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: $color-bg-subtle;
  border-radius: $radius-sm;

  &__path {
    overflow: hidden;
    font-family: $font-family-mono;
    font-size: 11.5px;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__copy {
    flex-shrink: 0;
    padding: 2px 6px;
    font-family: inherit;
    font-size: 11px;
    color: $color-text-secondary;
    cursor: pointer;
    background: none;
    border: 0;

    &:hover {
      color: $color-primary;
    }
  }
}

.api-note {
  margin: 0;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $color-text-secondary;
}

.api-block {
  h3 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: $font-weight-medium;
    color: $color-text-placeholder;
    letter-spacing: 0.04em;
  }

  pre {
    padding: 10px 12px;
    margin: 0;
    overflow-x: auto;
    font-family: $font-family-mono;
    font-size: 11px;
    line-height: 1.65;
    color: $color-text-regular;
    background: #fafafa;
    border: 1px solid $color-border-light;
    border-radius: $radius-sm;
  }

  &--wrap {
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
