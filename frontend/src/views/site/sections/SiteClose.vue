<script setup lang="ts">
/**
 * 结尾
 * ----------------------------------------------------------------------------
 * 整页只在这里重复一次主行动。文案回到具体动作，不再重复功能列表。
 */
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <section class="close">
    <div class="close__inner">
      <h2>从下一节实训课开始记录</h2>
      <p>
        留下工位数与本学期要评的菜，我们按你的课程表配一套演示环境，用一节课的真实视频跑一遍，再给一份能直接用于立项的配置与报价。
      </p>
      <div class="close__actions">
        <button type="button" class="btn btn--primary" @click="router.push('/demo')">
          预约演示
        </button>
        <button type="button" class="btn btn--ghost" @click="router.push('/login')">
          登录系统
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.close {
  background: $site-ground-alt;
  border-top: 1px solid $color-border-light;

  &__inner {
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;

    h2 {
      max-width: 18em;
      margin: 0;
      font-size: $site-h2;
      font-weight: 600;
      line-height: 1.2;
      color: $site-ink;
      letter-spacing: -0.02em;
    }

    p {
      max-width: 40em;
      margin: 18px 0 0;
      font-size: $site-body;
      line-height: 1.7;
      color: $site-ink-muted;
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    margin-top: 36px;
  }
}

@media (max-width: $breakpoint-lg) {
  .close__inner {
    padding: 72px $site-gutter-tablet;
  }
}

@media (max-width: $breakpoint-sm) {
  .close {
    &__inner {
      padding: 56px $site-gutter-phone;

      p {
        font-size: 15px;
      }
    }

    &__actions .btn {
      flex: 1 1 100%;
    }
  }
}
</style>
