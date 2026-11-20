<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

import AppLogo from '@/components/AppLogo.vue'
import { useAuthStore } from '@/stores/auth'
import { USE_MOCK } from '@/utils/env'
import type { LoginPayload } from '@/types'

/**
 * 登录页
 * ----------------------------------------------------------------------------
 * 排布：品牌区在 AuthLayout 左侧，这里只负责表单，不再套一层卡片外框
 * 表单规则：字段无 label，靠 placeholder + 前置图标表达含义，减少一行视觉噪音
 */
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const remember = ref(true)

const form = reactive<LoginPayload>({
  username: USE_MOCK ? 'admin' : '',
  password: USE_MOCK ? '123456' : '',
})

const rules: FormRules<LoginPayload> = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
}

const demoAccounts = [
  { username: 'admin', label: '管理员' },
  { username: 'teacher_chen', label: '教师' },
  { username: '2023010101', label: '学生' },
]

function fillAccount(username: string): void {
  form.username = username
  form.password = '123456'
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  try {
    await authStore.login({ ...form })
    ElMessage.success(`欢迎回来，${authStore.displayName}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    // 非 mock 模式下错误提示已由 request 拦截器统一处理
    if (USE_MOCK) {
      ElMessage.error(error instanceof Error ? error.message : '登录失败')
    }
  }
}
</script>

<template>
  <div class="login">
    <!-- 窄屏时品牌区隐藏，这里补一个 logo 保持识别 -->
    <div class="login__logo">
      <AppLogo />
    </div>

    <header class="login__header">
      <h1 class="login__title">登录</h1>
      <p class="login__subtitle">使用学校统一账号进入评价系统</p>
    </header>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      class="login__form"
      @keyup.enter="handleSubmit"
    >
      <el-form-item prop="username">
        <el-input v-model="form.username" placeholder="账号（工号 / 学号）" autocomplete="username">
          <template #prefix>
            <el-icon><User /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item prop="password">
        <el-input
          v-model="form.password"
          type="password"
          placeholder="密码"
          show-password
          autocomplete="current-password"
        >
          <template #prefix>
            <el-icon><Lock /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <div class="login__row">
        <el-checkbox v-model="remember">保持登录</el-checkbox>
        <el-button link type="primary" @click="ElMessage.info('请联系管理员重置密码')">
          忘记密码
        </el-button>
      </div>

      <el-button
        type="primary"
        class="login__submit"
        :loading="authStore.loading"
        @click="handleSubmit"
      >
        登录
      </el-button>
    </el-form>

    <div v-if="USE_MOCK" class="login__demo">
      <p class="login__demo-title">演示账号 · 密码 123456</p>
      <div class="login__demo-list">
        <button
          v-for="account in demoAccounts"
          :key="account.username"
          type="button"
          class="login__demo-chip"
          @click="fillAccount(account.username)"
        >
          {{ account.label }}
        </button>
      </div>
    </div>

    <p class="login__tip">
      <span class="status-dot" :class="USE_MOCK ? 'status-dot--warning' : 'status-dot--success'" />
      {{ USE_MOCK ? '前端 Mock 模式，未连接后端' : '已连接后端服务' }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.login {
  width: 100%;
  max-width: 344px;
  animation: app-fade-in 400ms $ease-emphasized;

  &__logo {
    display: none;
    margin-bottom: $space-6;
  }

  &__header {
    margin-bottom: $space-6;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    letter-spacing: -0.02em;
  }

  &__subtitle {
    margin-top: 6px;
    font-size: $font-size-sm;
    color: $color-text-secondary;
  }

  &__form {
    // 字段高度 40px：比默认 36 略松，登录场景需要更从容的点击区域
    :deep(.el-form-item) {
      margin-bottom: $space-4;
    }

    :deep(.el-input__wrapper) {
      height: 40px;
      padding: 0 12px;
      background: $color-bg-surface;
    }

    :deep(.el-input__inner) {
      font-size: $font-size-base;
    }

    :deep(.el-form-item__error) {
      padding-top: 3px;
      font-size: $font-size-xs;
    }
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -2px 0 $space-5;

    :deep(.el-checkbox__label) {
      font-size: $font-size-sm;
      color: $color-text-regular;
    }

    :deep(.el-button.is-link) {
      font-size: $font-size-sm;
    }
  }

  &__submit {
    width: 100%;
    height: 40px;
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    letter-spacing: 0.02em;
  }

  &__demo {
    padding-top: $space-4;
    margin-top: $space-5;
    border-top: 1px solid $color-border-light;
  }

  &__demo-title {
    margin-bottom: $space-2;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }

  &__demo-list {
    display: flex;
    gap: 6px;
  }

  &__demo-chip {
    flex: 1;
    height: 30px;
    font-size: $font-size-xs;
    color: $color-text-regular;
    cursor: pointer;
    background: $color-bg-subtle;
    border: 1px solid transparent;
    border-radius: $radius-sm;
    transition: background-color $duration-fast $ease-standard,
      border-color $duration-fast $ease-standard, color $duration-fast $ease-standard;

    &:hover {
      color: $color-text-primary;
      background: $color-bg-surface;
      border-color: $color-border;
    }
  }

  &__tip {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: $space-6;
    font-size: $font-size-xs;
    color: $color-text-placeholder;
  }
}

// 窄屏：隐藏左侧品牌区后，logo 回到表单上方
@media (max-width: $breakpoint-lg) {
  .login {
    max-width: 360px;
    padding: $space-6 $space-5 $space-5;
    background: $color-bg-surface;
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
    box-shadow: $shadow-card;

    &__logo {
      display: block;
    }
  }
}
</style>
