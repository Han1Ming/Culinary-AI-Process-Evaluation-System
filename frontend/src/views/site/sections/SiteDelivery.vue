<script setup lang="ts">
/**
 * 实施与验收
 * ----------------------------------------------------------------------------
 * 采购方在这一节要看的是「工期和标准」，不是「我们的服务理念」。
 * 所以只放三样硬东西：四周里程碑、四条可测的验收指标、四条服务承诺。
 *
 * 排版：里程碑用表格式的行列表（周次 / 事项 / 交付物），不用时间轴的圆点与连线。
 * 圆点连线在营销站里已经被用滥了，且它并不比一张表多表达信息。
 */
import { acceptance, milestones, serviceLevels } from '@/views/site/data'
</script>

<template>
  <section id="delivery" class="delivery">
    <div class="delivery__inner">
      <header class="delivery__head">
        <h2>四周上线，按指标验收</h2>
        <p>
          从勘查到验收签字的完整周期是四周，前提是实训室的网络与摄像头到位。私有化部署延到八到十周，主要多在中标流程与内网审批上。
        </p>
      </header>

      <ol class="mile">
        <li v-for="step in milestones" :key="step.week" class="mile__row">
          <span class="mile__week">{{ step.week }}</span>
          <div class="mile__body">
            <h3>{{ step.title }}</h3>
            <p>{{ step.detail }}</p>
          </div>
          <p class="mile__output">{{ step.output }}</p>
        </li>
      </ol>

      <div class="delivery__split">
        <div class="block">
          <h3 class="block__title">验收指标</h3>
          <p class="block__note">每条都附测量条件，条件不满足时先整改环境再复测。</p>
          <table class="spec">
            <thead>
              <tr>
                <th scope="col">指标</th>
                <th scope="col">目标值</th>
                <th scope="col">测量条件</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in acceptance" :key="item.metric">
                <th scope="row">{{ item.metric }}</th>
                <td class="spec__target">{{ item.target }}</td>
                <td class="spec__cond">{{ item.condition }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="block">
          <h3 class="block__title">服务承诺</h3>
          <p class="block__note">写进合同的条款，不是口头承诺。</p>
          <dl class="sla">
            <div v-for="item in serviceLevels" :key="item.label" class="sla__row">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.delivery {
  // 浅灰：与前面的白底定价区隔开，又给下一段深色的对接区做过渡
  background: $site-ground-alt;

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;
  }

  &__head {
    max-width: 46em;
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

  &__split {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 64px;
    margin-top: 56px;
    padding-top: 44px;
    border-top: 1px solid $color-border-light;
  }
}

// ---------- 里程碑 ----------
.mile {
  padding: 0;
  margin: 0;
  list-style: none;

  &__row {
    display: grid;
    grid-template-columns: 56px minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 24px;
    align-items: baseline;
    padding: 22px 0;
    border-top: 1px solid $color-border-light;

    &:last-child {
      border-bottom: 1px solid $color-border-light;
    }
  }

  &__week {
    font-family: $font-family-mono;
    font-size: 12px;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__body {
    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: $site-ink;
      letter-spacing: -0.01em;
    }

    p {
      margin: 7px 0 0;
      font-size: 13.5px;
      line-height: 1.7;
      color: $site-ink-muted;
    }
  }

  &__output {
    // 交付物是「这一周的产出」，不是并列的第二句话——用一道细线把它挂在正文右侧
    padding-left: 20px;
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: $site-ink-soft;
    border-left: 1px solid $color-border-light;
  }
}

// ---------- 两个小标题 ----------
.block {
  &__title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: $site-ink;
  }

  &__note {
    margin: 8px 0 18px;
    font-size: 13px;
    line-height: 1.7;
    color: $site-ink-muted;
  }
}

// ---------- 验收指标表 ----------
.spec {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 11px 12px 11px 0;
    font-size: 13px;
    line-height: 1.6;
    text-align: left;
    vertical-align: top;
  }

  thead th {
    padding-top: 0;
    font-size: 11.5px;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
    border-bottom: 1px solid $color-border-strong;
  }

  tbody {
    th {
      font-weight: 500;
      color: $site-ink;
      border-bottom: 1px solid $color-border-light;
    }

    td {
      border-bottom: 1px solid $color-border-light;
    }
  }

  &__target {
    font-family: $font-family-mono;
    font-weight: 600;
    color: $site-ink;
    white-space: nowrap;
  }

  &__cond {
    color: $site-ink-muted;
  }
}

// ---------- 服务承诺 ----------
.sla {
  display: flex;
  flex-direction: column;
  margin: 0;

  &__row {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 16px;
    padding: 12px 0;
    border-top: 1px solid $color-border-light;

    &:last-child {
      border-bottom: 1px solid $color-border-light;
    }

    dt {
      font-size: 12.5px;
      color: $site-ink-muted;
    }

    dd {
      margin: 0;
      font-size: 13px;
      line-height: 1.7;
      color: $site-ink-soft;
    }
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .delivery {
    &__inner {
      padding: 80px $site-gutter-tablet;
    }

    &__split {
      grid-template-columns: minmax(0, 1fr);
      gap: 40px;
      margin-top: 40px;
    }
  }

  .mile__row {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 16px;
  }

  // 交付物挪到下一行，仍靠左对齐在正文列上；单列布局里那道竖线没有意义
  .mile__output {
    grid-column: 2;
    padding-left: 0;
    margin-top: -8px;
    border-left: 0;
  }
}

@media (max-width: $breakpoint-sm) {
  .delivery__inner {
    padding: 64px $site-gutter-phone;
  }

  .spec {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
