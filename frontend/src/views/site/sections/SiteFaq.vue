<script setup lang="ts">
/**
 * 常见问题
 * ----------------------------------------------------------------------------
 * 用原生 <details>，不引组件、不带 JS，键盘与读屏器行为是浏览器保证的。
 * 问题会原样进入结构化数据，所以每条都写成教师或信息化部门真会问的句子。
 */
import { faqs } from '@/views/site/data'
</script>

<template>
  <section id="faq" class="faq">
    <div class="faq__inner">
      <header class="faq__head">
        <h2>常见问题</h2>
        <p>部署、数据、评分配置这几件事被问得最多。</p>
      </header>

      <div class="faq__list">
        <details v-for="item in faqs" :key="item.q" class="qa">
          <summary>
            <span class="qa__q">{{ item.q }}</span>
            <span class="qa__icon" aria-hidden="true" />
          </summary>
          <p class="qa__a">{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.faq {
  background: $site-ground;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.62fr) minmax(0, 1.38fr);
    gap: 72px;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 88px $site-gutter;
  }

  &__head {
    h2 {
      margin: 0;
      font-size: $site-h2;
      font-weight: 600;
      line-height: 1.2;
      color: $site-ink;
      letter-spacing: -0.02em;
    }

    p {
      margin: 16px 0 0;
      font-size: $site-body;
      line-height: 1.7;
      color: $site-ink-muted;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
  }
}

.qa {
  border-top: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 1px solid $color-border-light;
  }

  summary {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    justify-content: space-between;
    padding: 22px 0;
    list-style: none;
    cursor: pointer;

    &::-webkit-details-marker {
      display: none;
    }

    &:hover .qa__q {
      color: $site-ink;
    }
  }

  &__q {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.6;
    color: $site-ink-soft;
    transition: color $duration-fast $ease-standard;
  }

  // 用两条线拼成 +／−，展开时竖线旋转消失
  &__icon {
    position: relative;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    margin-top: 5px;

    &::before,
    &::after {
      position: absolute;
      top: 50%;
      left: 0;
      width: 14px;
      height: 1.5px;
      content: '';
      background: $site-ink;
      transition: transform $duration-fast $ease-standard;
    }

    &::after {
      transform: rotate(90deg);
    }
  }

  &[open] &__icon::after {
    transform: rotate(0deg);
  }

  &[open] &__q {
    color: $site-ink;
  }

  &__a {
    max-width: 62ch;
    padding: 0 40px 24px 0;
    margin: 0;
    font-size: 15px;
    line-height: 1.8;
    color: $site-ink-muted;
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .faq {
    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 32px;
      padding: 72px $site-gutter-tablet;
    }

  }
}

@media (max-width: $breakpoint-sm) {
  .faq__inner {
    padding: 56px $site-gutter-phone;
  }

  .qa {
    summary {
      gap: 16px;
      padding: 18px 0;
    }

    &__q {
      font-size: 15px;
    }

    &__a {
      padding: 0 0 20px;
      font-size: 14px;
    }
  }
}
</style>
