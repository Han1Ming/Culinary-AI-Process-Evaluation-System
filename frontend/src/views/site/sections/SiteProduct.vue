<script setup lang="ts">
/**
 * 系统界面
 * ----------------------------------------------------------------------------
 * 软件站的界面必须是自己的真实界面，不能放一张通用仪表盘占位。
 * 这里用的是本项目实际运行版本的截图（scripts/capture-site-shots.mjs 生成）。
 * 文字在左、界面在右，图片下方不写任何说明文字。
 */
import dashboardShot from '@/assets/images/screens/dashboard.png'

const points = [
  {
    title: '教师看到的是一节课，不是一堆图表',
    desc: '工作台按班级和课程聚合：今天几个班、签到多少人、哪几个工位有异常，一屏看完。',
  },
  {
    title: '每个学生一份可追溯的报告',
    desc: '报告中每一分都能点回对应的视频片段与识别记录，教研复核时不用再翻录像。',
  },
  {
    title: '异常先提醒，再归档',
    desc: '着装配错、步骤缺失、时长异常会先进入待处理列表，教师确认后才计入成绩。',
  },
]
</script>

<template>
  <section id="product" class="product">
    <div class="product__inner">
      <div class="product__text">
        <header class="section-head">
          <h2>系统界面</h2>
          <p>教师端、管理端与移动端共用一套数据。下面两屏取自本项目的实际运行版本。</p>
        </header>

        <ul class="points">
          <li v-for="(p, i) in points" :key="p.title" class="point">
            <span class="point__num">{{ String(i + 1).padStart(2, '0') }}</span>
            <div>
              <h3>{{ p.title }}</h3>
              <p>{{ p.desc }}</p>
            </div>
          </li>
        </ul>
      </div>

      <div class="product__shots">
        <figure class="shot shot--main">
          <img
            :src="dashboardShot"
            alt="系统工作台界面：顶部为班级与日期筛选，中部为四项统计与签到率环形图，右侧为待处理异常列表"
            width="1440"
            height="900"
            loading="lazy"
          />
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.product {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  background: $site-ground;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
    gap: 64px;
    align-items: center;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;
  }

  &__shots {
    display: flex;
    flex-direction: column;
  }
}

.section-head {
  max-width: 30em;

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

.points {
  padding: 0;
  margin: 40px 0 0;
  list-style: none;
}

.point {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  padding: 18px 0;
  border-top: 1px solid $color-border-light;

  &:last-child {
    border-bottom: 1px solid $color-border-light;
  }

  &__num {
    padding-top: 2px;
    font-family: $font-family-mono;
    font-size: 12px;
    color: $site-ink-muted;
  }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    color: $site-ink;
  }

  p {
    margin: 6px 0 0;
    font-size: 14px;
    line-height: 1.65;
    color: $site-ink-muted;
  }
}

.shot {
  margin: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: 0 1px 2px rgba(23, 23, 26, 0.04);

  img {
    display: block;
    width: 100%;
    height: auto;
    transition: transform 600ms $ease-standard;
  }

  &:hover img {
    transform: scale(1.015);
  }

}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .product {
    align-items: flex-start;

    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 40px;
      padding: 80px $site-gutter-tablet;
    }
  }

  .shot--sub {
    margin-left: 0;
  }
}

@media (max-width: $breakpoint-sm) {
  .product__inner {
    padding: 64px $site-gutter-phone;
  }

  .points {
    margin-top: 28px;
  }

}
</style>
