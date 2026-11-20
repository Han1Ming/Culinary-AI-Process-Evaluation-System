<script setup lang="ts">
/**
 * 官网首屏
 * ----------------------------------------------------------------------------
 * 依据 layout-v4.md：首屏独立占满一屏，下方区块的标题不得露头。
 * 左侧文字（品类名 + 做法 + 两个动作 + 三条事实），右侧是**一组实训现场实拍**。
 *
 * 【为什么右栏是照片轮播，而不是系统界面截图】
 * 访客在第一屏要判断的是「这门课真的在上、这套东西真的装在工位上」，
 * 不是「这个后台配色如何」。界面截图讲不清这件事，实拍可以。
 * 系统长什么样，往下滚一屏的「产品实拍」分区里有完整界面，那里才是它该出现的位置。
 *
 * 七张照片按一节课的时间顺序排，与下面的七个模块一一对应：
 *   实训室全景 → 系围裙（着装）→ 教师看操作（签到/评课）→ 切丝（预处理）
 *   → 翻炒（烹饪过程）→ 摆盘（成品）→ 端盘等评价（综合评价）
 * 所以轮播不是装饰，它替代了原来那排模块图标的功能。
 *
 * 照片不加图注——这是硬规则，图注会把产品说明变成画册。
 * 停下时的指示条只表达「第几张」，不写文案。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { heroFacts } from '@/views/site/data'
import kitchenHero from '@/assets/images/kitchen-hero.jpg'
import uniformStudents from '@/assets/images/uniform-students.jpg'
import teacherReview from '@/assets/images/teacher-review.jpg'
import prepCutting from '@/assets/images/prep-cutting.jpg'
import wokFrying from '@/assets/images/wok-frying.jpg'
import dishPlated from '@/assets/images/dish-plated.jpg'
import tastingLine from '@/assets/images/tasting-line.jpg'

const router = useRouter()

const photos = [
  { src: kitchenHero, alt: '实训室里两名学生同时备料，后排还有学生在各自工位上操作' },
  { src: uniformStudents, alt: '操作台边，教师帮学生把围裙系带系紧' },
  { src: teacherReview, alt: '教师站在学生身后，看着学生的刀工并记录' },
  { src: prepCutting, alt: '案板上切好的葱丝，刀刃正落下' },
  { src: wokFrying, alt: '学生在灶前翻炒，锅里冒着热气' },
  { src: dishPlated, alt: '摆好盘的菜品，鱼肉与蔬菜泥并置' },
  { src: tastingLine, alt: '三名学生端着成品盘站成一排，等待品评' },
]

const index = ref(0)
const paused = ref(false)
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const INTERVAL = 5000
let timer: number | undefined

function stop() {
  if (timer) window.clearInterval(timer)
  timer = undefined
}

function play() {
  stop()
  if (reduceMotion || paused.value) return
  timer = window.setInterval(() => {
    index.value = (index.value + 1) % photos.length
  }, INTERVAL)
}

function jump(i: number) {
  index.value = i
  play()
}

watch(paused, play)
onMounted(() => {
  play()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibility)
})

/** 切到别的标签页时停表，回来重新计时——避免回到页面已经跳了好几张 */
function onVisibility() {
  if (document.hidden) stop()
  else play()
}

function goModules() {
  document.querySelector('#modules')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goDemo() {
  void router.push('/register')
}
</script>

<template>
  <section class="hero">
    <div class="hero__inner">
      <div class="hero__text">
        <p class="hero__eyebrow">烹饪实训 · 过程性评价</p>

        <h1 class="hero__title">
          烹饪实训的<br />
          AI 过程评价系统
        </h1>

        <p class="hero__lead">
          摄像头接在工位上，系统按环节识别操作、记录时长并给出评分。教师不用再站在操作台边逐项书写，课程结束时成绩已经生成。
        </p>

        <div class="hero__actions">
          <button type="button" class="btn btn--primary" @click="goDemo">预约演示</button>
          <button type="button" class="btn btn--ghost" @click="goModules">查看七大模块</button>
        </div>

        <dl class="hero__facts">
          <div v-for="fact in heroFacts" :key="fact.label" class="fact">
            <dt class="fact__value">
              {{ fact.value }}<span class="fact__unit">{{ fact.unit }}</span>
            </dt>
            <dd class="fact__label">{{ fact.label }}</dd>
          </div>
        </dl>
      </div>

      <div class="hero__media" @mouseenter="paused = true" @mouseleave="paused = false">
        <figure class="hero__stage">
          <img
            v-for="(photo, i) in photos"
            :key="photo.src"
            class="hero__shot"
            :class="{ 'is-active': i === index }"
            :src="photo.src"
            :alt="photo.alt"
            width="1536"
            height="944"
            :fetchpriority="i === 0 ? 'high' : 'low'"
            :loading="i === 0 ? 'eager' : 'lazy'"
            decoding="async"
          />
        </figure>

        <div class="hero__bar">
          <button
            v-for="(photo, i) in photos"
            :key="photo.src"
            type="button"
            class="hero__seg"
            :class="{ 'is-active': i === index }"
            :aria-label="`第 ${i + 1} 张：${photo.alt}`"
            :aria-current="i === index"
            @click="jump(i)"
            @focus="paused = true"
            @blur="paused = false"
          />
          <span class="hero__count">
            {{ String(index + 1).padStart(2, '0') }}<i>/</i>{{ String(photos.length).padStart(2, '0') }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hero {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  overflow: hidden;
  background: $site-ground;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
    gap: 60px;
    align-items: center;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 32px $site-gutter;
  }

  // ---------- 文字区入场：只在加载时跑一次 ----------
  &__text > * {
    animation: app-fade-up 620ms $ease-emphasized both;
  }

  &__text > :nth-child(2) {
    animation-delay: 60ms;
  }

  &__text > :nth-child(3) {
    animation-delay: 120ms;
  }

  &__text > :nth-child(4) {
    animation-delay: 180ms;
  }

  &__text > :nth-child(5) {
    animation-delay: 240ms;
  }

  &__eyebrow {
    margin: 0 0 20px;
    font-size: $site-label;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__title {
    margin: 0;
    font-size: $site-h1;
    font-weight: 600;
    line-height: 1.1;
    color: $site-ink;
    letter-spacing: -0.025em;
  }

  &__lead {
    max-width: 27em;
    margin: 26px 0 0;
    font-size: $site-lead;
    line-height: 1.75;
    color: $site-ink-soft;
    // 三行说明按行均衡断行，避免最后一行只剩「生成。」两个字
    text-wrap: balance;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    margin-top: 34px;
  }

  &__facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $space-4;
    margin: 46px 0 0;
    padding-top: 24px;
    border-top: 1px solid $color-border-light;
  }

  // ---------- 画面区：7 张叠放，靠 opacity 交叉淡入 ----------
  &__media {
    animation: app-fade-up 720ms $ease-emphasized 120ms both;
  }

  &__stage {
    position: relative;
    // 4:3 是照片的比例，不是横幅的比例——横幅会让人读成「装饰图」
    aspect-ratio: 4 / 3;
    margin: 0;
    overflow: hidden;
    background: $site-ground-alt;
    border-radius: 14px;
    box-shadow: 0 30px 60px -32px rgba(23, 23, 26, 0.32);
  }

  &__shot {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    // 未激活的先压暗一点点，交叉淡入时不会出现「白闪」
    transition: opacity 760ms $ease-standard;

    &.is-active {
      opacity: 1;
      animation: hero-drift 5600ms linear both;
    }
  }

  // ---------- 指示条：一条细线，只有第几张的意思 ----------
  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 18px;
    padding-left: 2px;
  }

  &__seg {
    width: 26px;
    height: 2px;
    padding: 0;
    background: $color-border-strong;
    border: 0;
    border-radius: 1px;
    cursor: pointer;
    // 只变颜色，不变宽度——宽度会带着后面几段一起位移，看着像抖动
    transition: background-color 240ms $ease-standard;

    &:hover {
      background: $site-ink-muted;
    }

    &.is-active {
      background: $site-ink;
    }

    &:focus-visible {
      outline: 2px solid $color-primary;
      outline-offset: 3px;
    }
  }

  &__count {
    display: inline-flex;
    gap: 2px;
    margin-left: 6px;
    font-family: $font-family-mono;
    font-size: 11px;
    color: $site-ink-muted;
    font-variant-numeric: tabular-nums;

    i {
      font-style: normal;
      color: $color-border-strong;
    }
  }
}

@keyframes hero-drift {
  from {
    transform: scale(1.035);
  }

  to {
    transform: scale(1);
  }
}

.fact {
  &__value {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-family: $font-family-mono;
    font-size: 32px;
    font-weight: 600;
    line-height: 1;
    color: $site-ink;
    letter-spacing: -0.02em;
  }

  &__unit {
    font-family: $font-family-base;
    font-size: 13px;
    font-weight: 500;
    color: $site-ink-muted;
  }

  &__label {
    margin: 8px 0 0;
    font-size: $site-label;
    line-height: 1.5;
    color: $site-ink-muted;
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .hero {
    align-items: flex-start;

    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 32px;
      padding: 56px $site-gutter-tablet 44px;
    }

    // 单列时照片压成一条横幅：既保住「一屏一节」，也留出轮播的存在感
    &__stage {
      aspect-ratio: auto;
      height: clamp(180px, 24vh, 260px);
    }

    &__facts {
      margin-top: 36px;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .hero {
    &__inner {
      padding: 40px $site-gutter-phone 44px;
    }

    &__title {
      font-size: clamp(32px, 8.4vw, 40px);
    }

    &__lead {
      margin-top: 18px;
      font-size: 16px;
    }

    &__actions {
      margin-top: 26px;

      .btn {
        flex: 1 1 100%;
      }
    }

    &__facts {
      gap: $space-3;
      margin-top: 30px;
      padding-top: 18px;
    }

    &__stage {
      height: clamp(180px, 26vh, 240px);
    }

    &__seg {
      width: 18px;
    }
  }

  .fact__value {
    font-size: 24px;
  }
}

// 系统开了「减少动态效果」：不漂移、不自动播（脚本已停表，这里兜底样式）
@media (prefers-reduced-motion: reduce) {
  .hero__shot.is-active {
    animation: none;
  }
}
</style>
