<script setup lang="ts">
/**
 * 品牌标识
 * ----------------------------------------------------------------------------
 * 视觉决策：纯色深墨方块 + 白色图形，不用渐变、不用彩色投影。
 * 副标题改为中文短标签，避免「全大写英文口号」这种模板化表达。
 * inverse：用于深色背景（如登录页左侧品牌区），自动反色。
 */
withDefaults(defineProps<{ collapsed?: boolean; size?: 'sm' | 'md'; inverse?: boolean }>(), {
  collapsed: false,
  size: 'md',
  inverse: false,
})
</script>

<template>
  <div
    class="app-logo"
    :class="[`app-logo--${size}`, { 'is-collapsed': collapsed, 'is-inverse': inverse }]"
  >
    <span class="app-logo__mark" aria-hidden="true">
      <!-- 图形语义：餐盘 + 评价对勾，一笔完成，缩放不失真 -->
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M4 11h16M6 11v5.2A2.8 2.8 0 0 0 8.8 19h6.4A2.8 2.8 0 0 0 18 16.2V11"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
        <path d="M8.6 11 11 13.4 15.6 8.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    <span v-if="!collapsed" class="app-logo__text">
      <strong>烹饪 AI 评价</strong>
      <small>实训教学平台</small>
    </span>
  </div>
</template>

<style scoped lang="scss">
.app-logo {
  display: flex;
  gap: 10px;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;

  &__mark {
    display: inline-flex;
    flex: 0 0 30px;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    color: #fff;
    background: $color-text-primary;
    border-radius: $radius-md;

    svg {
      width: 19px;
      height: 19px;
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    line-height: 1.25;

    strong {
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      letter-spacing: -0.005em;
      color: $color-text-primary;
    }

    small {
      font-size: 11px;
      color: $color-text-placeholder;
    }
  }

  &--sm &__mark {
    flex-basis: 26px;
    width: 26px;
    height: 26px;

    svg {
      width: 16px;
      height: 16px;
    }
  }

  &.is-collapsed {
    justify-content: center;
  }

  // 深色背景反色：白底方块 + 深色图形
  &.is-inverse {
    .app-logo__mark {
      color: $color-text-primary;
      background: #fff;
    }

    .app-logo__text strong {
      color: #fff;
    }

    .app-logo__text small {
      color: rgba(255, 255, 255, 0.55);
    }
  }
}
</style>
