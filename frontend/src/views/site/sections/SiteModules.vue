<script setup lang="ts">
/**
 * 七大模块
 * ----------------------------------------------------------------------------
 * 4 列网格，第 8 格放「统一接口」说明，既补齐了 7 的奇数空位，
 * 也顺带回答了信息化部门最关心的问题：七个模块要不要对接七套东西。
 *
 * 不使用彩色图标底板——模块之间靠编号与排版区分，不靠颜色。
 */
import { siteModules } from '@/views/site/data'
</script>

<template>
  <section id="modules" class="modules">
    <div class="modules__inner">
      <header class="section-head">
        <h2>七大评价模块</h2>
        <p>
          从签到到成绩报告，每个环节独立成一个模块。学校可以一次上全，也可以先上签到与成品分析两个。
        </p>
      </header>

      <ul class="mod-grid">
        <li v-for="mod in siteModules" :key="mod.key" class="mod-card">
          <div class="mod-card__top">
            <span class="mod-card__index">{{ mod.index }}</span>
            <span class="mod-card__state">
              <i :class="mod.state === 'ready' ? 'is-ready' : 'is-pending'" aria-hidden="true" />
              {{ mod.state === 'ready' ? '已上线' : '对接中' }}
            </span>
          </div>
          <h3 class="mod-card__name">{{ mod.name }}</h3>
          <p class="mod-card__desc">{{ mod.summary }}</p>
          <ul class="mod-card__points">
            <li v-for="point in mod.points.slice(0, 2)" :key="point">{{ point }}</li>
          </ul>
        </li>

        <li class="mod-card mod-card--note">
          <h3>一套接口</h3>
          <p>七个模块共用统一响应格式与鉴权，新增模块不改动前端框架。</p>
          <RouterLink to="/login" class="mod-card__link">登录查看接口</RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.modules {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  background: $site-ground-alt;

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;
  }
}

.section-head {
  max-width: 46em;
  margin-bottom: 48px;

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

.mod-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.mod-card {
  display: flex;
  flex-direction: column;
  // 固定最小高度：跨行卡片不等高会让整块看起来是「凑出来的」
  min-height: 208px;
  padding: 24px;
  background: #fff;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  transition:
    transform $duration-fast $ease-standard,
    border-color $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-strong;
    transform: translateY(-2px);
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  &__index {
    font-family: $font-family-mono;
    font-size: 12px;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__state {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    color: $site-ink-muted;

    i {
      display: block;
      width: 5px;
      height: 5px;
      border-radius: 50%;

      &.is-ready {
        background: $color-success-dot;
      }

      &.is-pending {
        background: $color-border-strong;
      }
    }
  }

  &__name {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.35;
    color: $site-ink;
    letter-spacing: -0.01em;
  }

  &__desc {
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.65;
    color: $site-ink-muted;
  }

  &__points {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 0;
    margin: auto 0 0;
    padding-top: 14px;
    list-style: none;

    li {
      position: relative;
      padding-left: 11px;
      font-size: 12.5px;
      line-height: 1.6;
      color: $site-ink-muted;

      &::before {
        position: absolute;
        top: 8px;
        left: 0;
        width: 4px;
        height: 1px;
        content: '';
        background: $color-border-strong;
      }
    }
  }

  // 第 8 格：深色，形成区块内的唯一对比点
  &--note {
    color: $site-ink-inverse;
    background: $site-ink;
    border-color: $site-ink;

    &:hover {
      border-color: $site-ink;
    }

    h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #fff;
    }

    p {
      margin: 10px 0 0;
      font-size: 14px;
      line-height: 1.65;
      color: $site-ink-inverse-muted;
    }
  }

  &__link {
    margin-top: auto;
    padding-top: 20px;
    font-size: 14px;
    color: #fff;
    text-decoration: none;
    border-bottom: 0;

    &::after {
      display: inline-block;
      margin-left: 6px;
      content: '→';
      transition: transform $duration-fast $ease-standard;
    }

    &:hover::after {
      transform: translateX(3px);
    }
  }
}

// ---------- 响应式 ----------
// 1280 而不是 1440：@media 的 max-width 在 1440 视口下会命中，导致桌面端掉成两列
@media (max-width: 1280px) {
  .mod-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: $breakpoint-lg) {
  .modules {
    align-items: flex-start;

    &__inner {
      padding: 80px $site-gutter-tablet;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .modules__inner {
    padding: 64px $site-gutter-phone;
  }

  .section-head {
    margin-bottom: 28px;
  }

  .mod-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .mod-card {
    padding: 20px;

    &__top {
      margin-bottom: 14px;
    }
  }
}
</style>
