<script setup lang="ts">
/**
 * 合规文档（隐私政策 / 服务条款）
 * ----------------------------------------------------------------------------
 * 两份文档共用一套版式，按路由决定渲染哪一份。
 * 存在的理由很实际：学校的采购与法务流程里，这两页是标书附件的必备项，
 * 官网没有就得单独发文件，一来一回拖两周。
 *
 * 排版：单栏、行宽 34em（法律文本读起来最稳的字数）、标题层级只用两级。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { legalDocs } from '@/views/site/data'

const route = useRoute()

/** 路由 path 决定文档：/privacy → privacy，其余按 terms */
const doc = computed(() => (route.path.startsWith('/privacy') ? legalDocs.privacy : legalDocs.terms))
</script>

<template>
  <article class="legal">
    <div class="legal__inner">
      <header class="legal__head">
        <p class="legal__eyebrow">合规文档</p>
        <h1>{{ doc.title }}</h1>
        <p class="legal__meta">更新于 {{ doc.updatedAt }} · 适用于当前版本</p>
        <p class="legal__lead">{{ doc.lead }}</p>
      </header>

      <section v-for="section in doc.sections" :key="section.heading" class="legal__section">
        <h2>{{ section.heading }}</h2>
        <p v-for="(paragraph, i) in section.paragraphs" :key="i">{{ paragraph }}</p>
      </section>

      <footer class="legal__foot">
        <p>
          本页为签约前公开说明，不构成法律意见。正式条款以双方签署的合同为准；如与合同冲突，以合同为准。
        </p>
        <RouterLink to="/demo" class="legal__link">就条款细节与我们沟通 →</RouterLink>
      </footer>
    </div>
  </article>
</template>

<style scoped lang="scss">
.legal {
  background: $site-ground;

  &__inner {
    max-width: 760px;
    margin: 0 auto;
    padding: 72px $site-gutter 96px;

    // 桌面端边距不走 80px：正文已经限制在 760，再加 80 会显得柱太窄
    @media (max-width: $breakpoint-lg) {
      padding: 56px $site-gutter-tablet 80px;
    }

    @media (max-width: $breakpoint-sm) {
      padding: 40px $site-gutter-phone 64px;
    }
  }

  &__eyebrow {
    margin: 0 0 14px;
    font-size: $site-label;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__head {
    padding-bottom: 32px;
    border-bottom: 1px solid $color-border-light;

    h1 {
      margin: 0;
      font-size: clamp(28px, 3.2vw, 38px);
      font-weight: 600;
      line-height: 1.2;
      color: $site-ink;
      letter-spacing: -0.025em;
    }
  }

  &__meta {
    margin: 12px 0 0;
    font-family: $font-family-mono;
    font-size: 12px;
    color: $site-ink-muted;
  }

  &__lead {
    margin: 20px 0 0;
    font-size: 15.5px;
    line-height: 1.85;
    color: $site-ink-soft;
  }

  &__section {
    padding-top: 32px;

    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
      color: $site-ink;
      letter-spacing: -0.01em;
    }

    p {
      margin: 0 0 12px;
      font-size: 14.5px;
      line-height: 1.9;
      color: $site-ink-soft;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  &__foot {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid $color-border-light;

    p {
      margin: 0;
      font-size: 12.5px;
      line-height: 1.8;
      color: $site-ink-muted;
    }
  }

  &__link {
    display: inline-block;
    margin-top: 12px;
    font-size: 13.5px;
    color: $site-ink;
    text-decoration: none;
    border-bottom: 1px solid $color-border-strong;

    &:hover {
      border-bottom-color: $site-ink;
    }
  }
}
</style>
