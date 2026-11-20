<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import AppSkeleton from '@/components/AppSkeleton.vue'
import PageHeader from '@/components/PageHeader.vue'
import { fetchDashboardOverview } from '@/api/user'
import { MODULE_ACCESS, ROLE_COLUMNS, ROLE_SCOPE } from '@/config/permissions'
import type { AccessLevel } from '@/config/permissions'
import { useRole } from '@/composables/useRole'
import type { EvaluationModule, UserRole } from '@/types'

/**
 * 评价总览
 * ----------------------------------------------------------------------------
 * 这个页面的第一职责不是「列模块」，而是回答一个问题：
 *   同一套七个模块，学生、教师、管理员各自能碰到哪一部分？
 *
 * 所以主视觉是「角色 × 模块」的权限矩阵：左边三个角色卡讲清各自的活，
 * 下面的矩阵逐格给出职责与限制，行末直接进入模块。
 * 接口契约不在这里展开——每个模块页右侧（或页头的接口抽屉）都有完整版。
 */
const router = useRouter()
const { role } = useRole()

const modules = ref<EvaluationModule[]>([])
const loading = ref(true)
// 只有首次进入才用骨架，点「刷新」时保留列表避免整块闪烁
const initialized = ref(false)
const showSkeleton = computed(() => loading.value && !initialized.value)

/** 当前查看的角色视角，默认是自己；点角色卡可切到别人，方便讲解与验收 */
const activeRole = ref<UserRole>(role.value)

/** 模块图标按路由挂，不按数组下标——矩阵行的顺序以后可能调，下标会错位 */
const ICON_BY_PATH: Record<string, string> = {
  '/face-checkin': 'Camera',
  '/modules/uniform': 'Postcard',
  '/modules/ingredient': 'KnifeFork',
  '/modules/cooking': 'Dish',
  '/modules/dish': 'Bowl',
  '/modules/summary': 'TrendCharts',
  '/chat': 'ChatDotRound',
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  none: '不参与',
  use: '本人操作',
  review: '复核扣分',
  manage: '全站管理',
}

const scope = computed(() => ROLE_SCOPE[activeRole.value])

const readyCount = computed(() => modules.value.filter((item) => item.ready).length)

const subtitle = computed(() => {
  if (!initialized.value) return '正在读取模块状态'
  return `${readyCount.value} 个已上线 · ${modules.value.length - readyCount.value} 个对接中`
})

/** 把模块对接进度按名称挂到矩阵行上，避免再拉一份数据 */
function progressOf(moduleName: string): EvaluationModule | undefined {
  return modules.value.find((item) => item.name === moduleName)
}

async function loadModules(): Promise<void> {
  loading.value = true
  try {
    const overview = await fetchDashboardOverview()
    modules.value = overview.modules
    initialized.value = true
  } catch {
    ElMessage.error('模块信息加载失败')
  } finally {
    loading.value = false
  }
}

function enter(path: string): void {
  void router.push(path)
}

onMounted(loadModules)
</script>

<template>
  <div class="eval-overview">
    <PageHeader title="评价总览" :subtitle="subtitle">
      <template #actions>
        <el-button :loading="loading" @click="loadModules">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </template>
    </PageHeader>

    <!-- 角色定位：三张卡，点一下切换下面的矩阵视角 -->
    <section class="roles">
      <button
        v-for="col in ROLE_COLUMNS"
        :key="col.role"
        type="button"
        class="role-card"
        :class="{ 'is-active': activeRole === col.role }"
        @click="activeRole = col.role"
      >
        <header class="role-card__head">
          <h2>{{ ROLE_SCOPE[col.role].title }}</h2>
          <span v-if="role === col.role" class="role-card__self">当前登录</span>
        </header>
        <p class="role-card__summary">{{ ROLE_SCOPE[col.role].summary }}</p>
        <ul class="role-card__points">
          <li v-for="point in ROLE_SCOPE[col.role].points" :key="point">{{ point }}</li>
        </ul>
      </button>
    </section>

    <!-- 权限矩阵 -->
    <section class="app-card app-card--flush matrix-card">
      <header class="matrix-head">
        <div>
          <h2 class="matrix-head__title">七个模块 · 三个角色的分工</h2>
          <p class="matrix-head__desc">
            正在查看
            <strong>{{ scope.title }}</strong>
            视角：{{ scope.summary }}
          </p>
        </div>
        <span class="matrix-head__legend">
          <span class="matrix-head__legend-label">权限级别</span>
          <span v-for="(label, level) in LEVEL_LABEL" :key="level" class="cell-level" :class="`is-${level}`">
            {{ label }}
          </span>
        </span>
      </header>

      <AppSkeleton v-if="showSkeleton" variant="list" :count="7" class="matrix-skeleton" />

      <div v-else class="matrix animate-fade">
        <!-- 表头 -->
        <div class="matrix__row matrix__row--head" role="row">
          <span>模块</span>
          <span v-for="col in ROLE_COLUMNS" :key="col.role" :class="{ 'is-active': activeRole === col.role }">
            {{ col.label }}
          </span>
          <span />
        </div>

        <!-- 行 -->
        <div
          v-for="(row, index) in MODULE_ACCESS"
          :key="row.module"
          class="matrix__row matrix__row--body animate-in"
          :style="{ '--i': index }"
        >
          <div class="cell-module">
            <el-icon class="cell-module__icon">
              <component :is="ICON_BY_PATH[row.path] ?? 'DataAnalysis'" />
            </el-icon>
            <div class="cell-module__body">
              <span class="cell-module__name">{{ row.module }}</span>
              <span
                v-if="progressOf(row.module)"
                class="cell-module__state"
                :class="{ 'is-ready': progressOf(row.module)?.ready }"
              >
                {{ progressOf(row.module)?.ready ? '已上线' : `对接中 ${progressOf(row.module)?.progress}%` }}
              </span>
            </div>
          </div>

          <div
            v-for="col in ROLE_COLUMNS"
            :key="col.role"
            class="cell-access"
            :class="{ 'is-active': activeRole === col.role }"
          >
            <span class="cell-level" :class="`is-${row[col.role].level}`">
              {{ LEVEL_LABEL[row[col.role].level] }}
            </span>
            <span class="cell-access__note">{{ row[col.role].note }}</span>
          </div>

          <button type="button" class="cell-enter" @click="enter(row.path)">
            进入
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
      </div>
    </section>

    <p class="foot-note">
      每个模块页都带接口接入面板（满宽页面收在页头「接口」抽屉里），契约以页面内为准。
      角色的能力判断统一读 <code>config/permissions.ts</code>，不在页面里各写一份。
    </p>
  </div>
</template>

<style scoped lang="scss">
/* ---------------- 角色卡 ---------------- */
.roles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-4;
  margin-bottom: $space-4;
}

.role-card {
  padding: 20px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  background: $color-bg-surface;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  transition:
    border-color $duration-fast $ease-standard,
    box-shadow $duration-fast $ease-standard;

  &:hover {
    border-color: $color-border-strong;
  }

  // 选中态只加深边框 + 一点点投影，不用蓝色底：三张卡里有一张变蓝会抢走全部注意力
  &.is-active {
    border-color: $color-text-primary;
    box-shadow: $shadow-card;
  }

  &__head {
    display: flex;
    gap: $space-2;
    align-items: center;

    h2 {
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__self {
    padding: 1px 7px;
    font-size: 11px;
    color: $color-primary;
    background: $color-primary-soft;
    border-radius: $radius-sm;
  }

  &__summary {
    margin-top: 8px;
    font-size: $font-size-sm;
    line-height: 1.65;
    color: $color-text-secondary;
  }

  &__points {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid $color-border-light;

    li {
      position: relative;
      padding-left: 12px;
      font-size: $font-size-xs;
      line-height: 1.6;
      color: $color-text-regular;

      &::before {
        position: absolute;
        top: 7px;
        left: 0;
        width: 4px;
        height: 1px;
        content: '';
        background: $color-border-strong;
      }
    }
  }
}

/* ---------------- 矩阵 ---------------- */
.matrix-card {
  overflow: hidden;
}

.matrix-head {
  display: flex;
  flex-wrap: wrap;
  gap: $space-3 $space-5;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18px 20px 14px;

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__desc {
    margin-top: 4px;
    font-size: $font-size-xs;
    color: $color-text-secondary;

    strong {
      font-weight: $font-weight-medium;
      color: $color-text-primary;
    }
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  }

  &__legend-label {
    font-size: 11px;
    color: $color-text-placeholder;
  }
}

.matrix-skeleton {
  padding: 0 $space-5 $space-4;
}

.matrix {
  border-top: 1px solid $color-border-light;

  &__row {
    display: grid;
    grid-template-columns: minmax(180px, 1.2fr) repeat(3, minmax(0, 1fr)) 64px;
    gap: $space-4;
    align-items: center;
    padding: 12px 20px;

    &--head {
      padding-top: 9px;
      padding-bottom: 9px;
      font-size: 11px;
      letter-spacing: 0.04em;
      color: $color-text-placeholder;
      background: $color-bg-subtle;
      border-bottom: 1px solid $color-border-light;

      span.is-active {
        color: $color-text-primary;
      }
    }

    &--body {
      transition: background-color $duration-fast $ease-standard;

      & + & {
        border-top: 1px solid $color-border-light;
      }

      &:hover {
        background: $color-bg-hover;

        .cell-enter {
          color: $color-text-primary;
        }
      }
    }
  }
}

.cell-module {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;

  &__icon {
    flex: 0 0 16px;
    font-size: 16px;
    color: $color-text-placeholder;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font-size: $font-size-sm;
    color: $color-text-primary;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__state {
    font-size: 11px;
    color: $color-text-placeholder;

    &.is-ready {
      color: $color-success;
    }
  }
}

.cell-access {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  // 非当前视角的那两列压暗，读的时候不会左右乱窜
  &:not(.is-active) {
    opacity: 0.55;
  }

  &__note {
    overflow: hidden;
    font-size: 11px;
    color: $color-text-placeholder;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.cell-level {
  display: inline-block;
  width: fit-content;
  font-size: 11.5px;
  color: $color-text-secondary;

  &.is-review {
    color: $color-primary;
  }

  &.is-manage {
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &.is-none {
    color: $color-text-placeholder;
  }
}

.cell-enter {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  justify-content: flex-end;
  font-family: inherit;
  font-size: $font-size-sm;
  color: $color-text-secondary;
  cursor: pointer;
  background: none;
  border: none;
  transition: color $duration-fast $ease-standard;

  .el-icon {
    font-size: 12px;
  }
}

.foot-note {
  margin-top: $space-4;
  font-size: $font-size-xs;
  line-height: 1.7;
  color: $color-text-placeholder;

  code {
    font-family: $font-family-mono;
    color: $color-text-secondary;
  }
}

@media (max-width: 1280px) {
  .roles {
    grid-template-columns: minmax(0, 1fr);
  }

  .matrix__row {
    grid-template-columns: minmax(150px, 1fr) repeat(3, minmax(0, 0.8fr)) 48px;
    gap: $space-3;
  }
}

@media (max-width: $breakpoint-md) {
  .matrix__row {
    grid-template-columns: minmax(0, 1fr) 48px;

    &--head {
      display: none;
    }
  }

  .cell-access {
    display: none;
  }
}
</style>
