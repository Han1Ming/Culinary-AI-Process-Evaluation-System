<script setup lang="ts">
/**
 * 一节课的时间线
 * ----------------------------------------------------------------------------
 * 用真实的课程节奏（08:00 进门到 09:40 出报告）代替抽象的「四步流程图」。
 * 左侧一张备菜场景照，右侧六段时间记录——时间点本身就是这条流程的说服力。
 */
import { courseFlow, siteModules } from '@/views/site/data'
import prepCutting from '@/assets/images/prep-cutting.jpg'

function moduleName(key: string): string {
  return siteModules.find((m) => m.key === key)?.name ?? ''
}
</script>

<template>
  <section id="flow" class="flow">
    <div class="flow__inner">
      <div class="flow__col">
        <header class="section-head">
          <h2>一节课的记录方式</h2>
          <p>
            从学生进门到报告归档，六段时间由系统自动记下。教师只需要在课后确认成绩，不必在操作台边写字。
          </p>
        </header>

        <figure class="flow__media">
          <img
            :src="prepCutting"
            alt="学生手持中式菜刀在砧板上切萝卜丝，刀身处于下落瞬间"
            width="1536"
            height="1024"
            loading="lazy"
          />
        </figure>
      </div>

      <ol class="timeline">
        <li v-for="step in courseFlow" :key="step.time" class="timeline__row">
          <time class="timeline__time">{{ step.time }}</time>
          <span class="timeline__dot" aria-hidden="true" />
          <div class="timeline__body">
            <h3>{{ step.title }}</h3>
            <p>{{ step.detail }}</p>
            <span class="timeline__tag">{{ moduleName(step.moduleKey) }}</span>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped lang="scss">
.flow {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  background: $site-ground-alt;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 72px;
    align-items: center;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;
  }

  &__media {
    margin: 40px 0 0;
    overflow: hidden;
    border-radius: $radius-xl;

    img {
      display: block;
      width: 100%;
      // 限高是关键：时间线六行约 520px，图片再高就会把整节顶出第二屏
      height: clamp(300px, 46vh, 520px);
      object-fit: cover;
      object-position: center 58%;
      transition: transform 600ms $ease-standard;
    }

    &:hover img {
      transform: scale(1.02);
    }
  }
}

.section-head {
  max-width: 34em;

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

// ---------- 时间线 ----------
.timeline {
  padding: 0;
  margin: 0;
  list-style: none;

  &__row {
    position: relative;
    display: grid;
    grid-template-columns: 56px 12px minmax(0, 1fr);
    gap: 16px;
    padding-bottom: 26px;

    &:last-child {
      padding-bottom: 0;
    }

    // 竖线：从节点向下连到下一行，最后一行不画
    &::before {
      position: absolute;
      top: 14px;
      bottom: 0;
      left: 68px;
      width: 1px;
      content: '';
      background: $color-border-light;
    }

    &:last-child::before {
      display: none;
    }
  }

  &__time {
    padding-top: 1px;
    font-family: $font-family-mono;
    font-size: 13px;
    color: $site-ink-muted;
    text-align: right;
    letter-spacing: 0.01em;
  }

  &__dot {
    width: 7px;
    height: 7px;
    margin-top: 6px;
    background: #fff;
    border: 1.5px solid $color-border-strong;
    border-radius: 50%;
    transition:
      border-color $duration-fast $ease-standard,
      background-color $duration-fast $ease-standard;
  }

  &__row:hover &__dot {
    background: $site-ink;
    border-color: $site-ink;
  }

  &__body {
    h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.4;
      color: $site-ink;
      letter-spacing: -0.01em;
    }

    p {
      margin: 6px 0 0;
      font-size: 15px;
      line-height: 1.65;
      color: $site-ink-muted;
    }
  }

  &__tag {
    display: inline-block;
    margin-top: 8px;
    font-size: 12px;
    color: $site-ink-muted;
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .flow {
    align-items: flex-start;

    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 48px;
      padding: 80px $site-gutter-tablet;
    }

    &__media {
      margin-top: 32px;

      img {
        aspect-ratio: 16 / 9;
      }
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .flow__inner {
    padding: 64px $site-gutter-phone;
  }

  .timeline__row {
    grid-template-columns: 44px 10px minmax(0, 1fr);
    gap: 12px;
    padding-bottom: 22px;

    &::before {
      left: 54px;
    }
  }

  .timeline__body h3 {
    font-size: 16px;
  }
}
</style>
