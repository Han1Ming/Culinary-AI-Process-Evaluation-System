<script setup lang="ts">
/**
 * 适用场景
 * ----------------------------------------------------------------------------
 * 写「这类客户拿它做什么」，不写「已服务 XX 所院校」。
 * 没有真实客户授权，就不出现学校名称与评价——这是这套设计规范里最硬的一条。
 */
import { scenes } from '@/views/site/data'
import dishPlated from '@/assets/images/dish-plated.jpg'
</script>

<template>
  <section id="scenes" class="scenes">
    <figure class="scenes__band">
      <img
        :src="dishPlated"
        alt="白色餐盘中的香煎海鲈鱼，配青豆泥与辣椒油点缀"
        width="1536"
        height="1024"
        loading="lazy"
      />
    </figure>

    <div class="scenes__inner">
      <header class="section-head">
        <h2>三种使用场景</h2>
        <p>同一套模块，按不同场景的组合上线。评分标准与流程都可以改。</p>
      </header>

      <ul class="scene-grid">
        <li v-for="scene in scenes" :key="scene.title" class="scene">
          <h3>{{ scene.title }}</h3>
          <p class="scene__desc">{{ scene.detail }}</p>
          <ul class="scene__list">
            <li v-for="point in scene.points" :key="point">{{ point }}</li>
          </ul>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.scenes {
  background: $site-ground;

  &__band {
    height: clamp(240px, 34vh, 360px);
    margin: 0;
    overflow: hidden;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 46%;
    }
  }

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 80px $site-gutter 96px;
  }
}

.section-head {
  max-width: 44em;
  margin-bottom: 40px;

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

.scene-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 40px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.scene {
  display: flex;
  flex-direction: column;
  padding-top: 24px;
  border-top: 1px solid $color-border;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    color: $site-ink;
    letter-spacing: -0.01em;
  }

  &__desc {
    margin: 10px 0 0;
    font-size: 15px;
    line-height: 1.7;
    color: $site-ink-muted;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    margin: 20px 0 0;
    list-style: none;

    li {
      position: relative;
      padding-left: 16px;
      font-size: 14px;
      line-height: 1.6;
      color: $site-ink-soft;

      &::before {
        position: absolute;
        top: 9px;
        left: 0;
        width: 5px;
        height: 1px;
        content: '';
        background: $color-border-strong;
      }
    }
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .scenes__inner {
    padding: 64px $site-gutter-tablet 80px;
  }

  .scene-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}

@media (max-width: $breakpoint-sm) {
  .scenes {
    &__band {
      height: 220px;
    }

    &__inner {
      padding: 48px $site-gutter-phone 64px;
    }
  }

  .section-head {
    margin-bottom: 28px;
  }
}
</style>
