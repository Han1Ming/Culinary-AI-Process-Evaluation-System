<script setup lang="ts">
/**
 * 未登录页面外壳：左右分栏
 * ----------------------------------------------------------------------------
 * 左侧深色品牌区（≥1024px 显示）：产品主张 + 能力点 + 版权
 * 右侧表单区：白底、垂直居中、窄栏 380px
 *
 * 左侧背景用的是实训现场照片，不是纯色块也不是渐变光斑：
 * 纯深色块看三秒就像模板，一张暗化的实景照片能立刻把场景说清楚
 * （操作台、厨师服、灶台），文字压在照片上靠遮罩保证对比度。
 *
 * 为什么这么改：居中一张卡片 + 渐变光斑是最容易被识别为「模板/生成式」的布局；
 * 分栏能把「这是一个有明确使用场景的产品」在 3 秒内说清楚。
 */
import AppLogo from '@/components/AppLogo.vue'
import uniformStudents from '@/assets/images/uniform-students.jpg'

const highlights = [
  { title: '七个环节留痕', desc: '从签到到综合评分，每一步都有时间与判定' },
  { title: '课程菜谱协同', desc: '教师上传菜谱，AI 标出难点与易错点' },
  { title: '三种角色分工', desc: '学生看自己、教师可扣分复核、管理员管账号' },
]
</script>

<template>
  <div class="auth">
    <!-- 品牌侧 -->
    <aside class="auth__brand">
      <div class="auth__photo" aria-hidden="true">
        <img :src="uniformStudents" alt="" width="1600" height="900" />
      </div>

      <div class="auth__brand-inner">
        <header class="auth__brand-top">
          <AppLogo inverse />
        </header>

        <div class="auth__brand-main">
          <h2 class="auth__claim">
            把烹饪实训的每个环节<br />
            变成可追溯的评价数据
          </h2>
          <p class="auth__claim-desc">
            面向中餐、西餐、面点等实训课程的过程性评价平台，覆盖签到、操作规范、成品分析与综合评分。
          </p>

          <ul class="auth__points">
            <li v-for="(item, index) in highlights" :key="item.title" class="auth__point" :style="{ '--i': index }">
              <span class="auth__point-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <div>
                <p class="auth__point-title">{{ item.title }}</p>
                <p class="auth__point-desc">{{ item.desc }}</p>
              </div>
            </li>
          </ul>
        </div>

        <footer class="auth__brand-foot">© 2026 烹饪 AI 过程评价系统 · 校企联合开发</footer>
      </div>
    </aside>

    <!-- 表单侧 -->
    <main class="auth__panel">
      <router-view />
    </main>
  </div>
</template>

<style scoped lang="scss">
.auth {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  min-height: 100vh;
  background: $color-bg-surface;

  &__brand {
    position: relative;
    display: flex;
    padding: $space-9 $space-9;
    overflow: hidden;
    background: #101012;
  }

  // 实景照片打底：上部压暗托住标题，下部留出画面（操作台与手的动作）
  &__photo {
    position: absolute;
    inset: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      // 竖裁时会切掉大幅画面，往右偏一点，把俯身整理围裙的那位留在画面里
      object-position: 60% center;
      // 去饱和 + 压暗：照片只做背景，不能和白色标题抢对比度
      filter: grayscale(0.42) brightness(0.58) contrast(1.04);
    }

    &::after {
      position: absolute;
      inset: 0;
      content: '';
      background:
        linear-gradient(180deg, rgba(10, 10, 12, 0.9) 0%, rgba(10, 10, 12, 0.64) 40%, rgba(10, 10, 12, 0.44) 100%),
        radial-gradient(120% 80% at 20% 0%, rgba(10, 10, 12, 0.5), transparent 70%);
    }
  }

  &__brand-inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
  }

  &__brand-main {
    margin: auto 0;
    padding: $space-9 0;
  }

  // 主张文案：34px / 600 / 行高 1.35，中文标题不用全角标点堆叠
  &__claim {
    font-size: 34px;
    font-weight: $font-weight-semibold;
    line-height: 1.36;
    letter-spacing: -0.02em;
    color: #fff;
  }

  &__claim-desc {
    max-width: 400px;
    margin-top: $space-4;
    font-size: $font-size-sm;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.56);
  }

  &__points {
    display: flex;
    flex-direction: column;
    gap: $space-4;
    margin-top: $space-8;
  }

  &__point {
    display: flex;
    gap: $space-3;
    align-items: flex-start;
    // 进场：与表单侧错开 120ms，形成先后节奏
    opacity: 0;
    animation: app-fade-up 520ms $ease-emphasized forwards;
    animation-delay: calc(160ms + var(--i) * 80ms);
  }

  &__point-index {
    padding-top: 1px;
    font-family: $font-family-mono;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.32);
  }

  &__point-title {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: rgba(255, 255, 255, 0.94);
  }

  &__point-desc {
    margin-top: 3px;
    font-size: $font-size-xs;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.44);
  }

  &__brand-foot {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
  }

  &__panel {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $space-8 $space-6;
  }
}

@media (max-width: $breakpoint-lg) {
  .auth {
    grid-template-columns: 1fr;
  }

  .auth__brand {
    display: none;
  }

  .auth__panel {
    padding: $space-6 $space-4;
    background: $color-bg-page;
  }
}
</style>
