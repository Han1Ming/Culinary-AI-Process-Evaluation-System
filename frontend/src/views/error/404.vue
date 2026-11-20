<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <div class="not-found__inner">
      <p class="not-found__code num">404</p>
      <h1 class="not-found__title">页面不存在</h1>
      <p class="not-found__desc">地址可能有误，或该功能尚未开放。</p>
      <div class="not-found__actions">
        <el-button @click="router.back()">返回上一页</el-button>
        <el-button type="primary" @click="router.replace('/dashboard')">回到工作台</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: $color-bg-page;

  &__inner {
    text-align: center;
  }

  // 数字用极浅灰而非淡蓝：不引入第五种色相
  &__code {
    font-size: 76px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    letter-spacing: -0.04em;
    color: $color-border-strong;
  }

  &__title {
    margin-top: $space-3;
    font-size: $font-size-lg;
  }

  &__desc {
    margin-top: 6px;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__actions {
    display: flex;
    gap: $space-2;
    justify-content: center;
    margin-top: $space-5;
  }
}
</style>
