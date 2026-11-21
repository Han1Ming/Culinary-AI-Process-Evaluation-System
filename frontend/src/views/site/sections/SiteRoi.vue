<script setup lang="ts">
/**
 * 成本测算
 * ----------------------------------------------------------------------------
 * 学校立项要填「预期效益」一栏，最怕两件事：数字是编的、算法不公开。
 * 所以这一节只做一件事：把算式摊开，让填报的人自己按本校规模算。
 *
 * 三条纪律：
 *   1. 公式写在页面上，输入改了结果立刻变，不做「提交后返回结果」的黑箱
 *   2. 只算**能算**的东西（评分工时），不算「学生成绩提升 23%」这种没有对照组的结论
 *   3. 系统费用用定价页的同一个常量，避免两页数字对不上
 *
 * 默认参数取一所高职一个实训室的常见规模，用户可改。
 */
import { computed, reactive } from 'vue'

import { REVIEW_RATIO, SEAT_PRICE_PER_YEAR, roiDefaults } from '@/views/site/data'

const input = reactive({ ...roiDefaults })

/** 输入边界：超出范围会让结论失真，直接夹住，不报错打断输入 */
const limits = {
  sessions: { min: 100, max: 8000, step: 50 },
  minutes: { min: 3, max: 40, step: 1 },
  rate: { min: 60, max: 300, step: 10 },
  seats: { min: 4, max: 80, step: 2 },
}

type FieldKey = keyof typeof limits

/** 四个输入项；key 与 limits / input 同源，模板里不再写断言 */
const fields: { key: FieldKey; label: string; unit: string }[] = [
  { key: 'sessions', label: '每学期实训人次', unit: '人次' },
  { key: 'minutes', label: '单份人工评分耗时', unit: '分钟' },
  { key: 'rate', label: '教师用人成本', unit: '元/小时' },
  { key: 'seats', label: '并发工位数', unit: '个' },
]

function clamp(key: FieldKey, value: number): void {
  const { min, max } = limits[key]
  if (Number.isNaN(value)) return
  input[key] = Math.min(max, Math.max(min, Math.round(value)))
}

/** 人工逐份评分与录入的工时 */
const manualHours = computed(() => (input.sessions * input.minutes) / 60)
/** 上线后教师只做抽检复核 */
const reviewHours = computed(() => manualHours.value * REVIEW_RATIO)
/** 每学期省下的工时 */
const savedHours = computed(() => manualHours.value - reviewHours.value)
/** 折算成钱：按学校用人综合成本，不是按课时费 */
const savedMoney = computed(() => Math.round(savedHours.value * input.rate))
/** 同等口径下的系统费用：年费的一半 = 一学期 */
const systemCost = computed(() => Math.round((input.seats * SEAT_PRICE_PER_YEAR) / 2))
/** 一学期的净结余，可能为负——不粉饰 */
const netMoney = computed(() => savedMoney.value - systemCost.value)

const nf = new Intl.NumberFormat('zh-CN')

function money(value: number): string {
  return nf.format(Math.abs(Math.round(value)))
}

function hours(value: number): string {
  return nf.format(Math.round(value))
}
</script>

<template>
  <section id="roi" class="roi">
    <div class="roi__inner">
      <div class="roi__intro">
        <h2>先算清楚一个学期能省多少工时</h2>
        <p>
          过程评价最耗人的不是判断，是记录：逐项打分、写评语、抄进成绩表。这套系统把这三步并成一步，教师只做抽检复核。
        </p>

        <div class="formula">
          <p class="formula__label">算法</p>
          <p class="formula__line">
            (实训人次 × 单份评分分钟 ÷ 60) × (1 − 复核比例
            {{ REVIEW_RATIO * 100 }}%)
          </p>
          <p class="formula__note">
            时薪按学校用人综合成本计（含课时费、绩效与教务核算），不是按外聘课时费。系统费用取年费档
            ¥{{ SEAT_PRICE_PER_YEAR }}/工位，按一学期折半。
          </p>
        </div>
      </div>

      <div class="roi__panel">
        <div class="roi__fields">
          <label v-for="field in fields" :key="field.key" class="field">
            <span class="field__label">{{ field.label }}</span>
            <span class="field__control">
              <input
                :value="input[field.key]"
                type="number"
                :min="limits[field.key].min"
                :max="limits[field.key].max"
                :step="limits[field.key].step"
                inputmode="numeric"
                @change="clamp(field.key, Number(($event.target as HTMLInputElement).value))"
              />
              <em>{{ field.unit }}</em>
            </span>
          </label>
        </div>

        <dl class="result">
          <div class="result__row">
            <dt>现在：人工评分</dt>
            <dd>{{ hours(manualHours) }}<span>小时 / 学期</span></dd>
          </div>
          <div class="result__row">
            <dt>上线后：抽检复核</dt>
            <dd>{{ hours(reviewHours) }}<span>小时 / 学期</span></dd>
          </div>
          <div class="result__row result__row--strong">
            <dt>每学期节省</dt>
            <dd>{{ hours(savedHours) }}<span>小时 · 约 ¥{{ money(savedMoney) }}</span></dd>
          </div>
        </dl>

        <div class="verdict" :class="{ 'is-negative': netMoney < 0 }">
          <p class="verdict__label">扣掉系统费用后</p>
          <p class="verdict__value">
            <template v-if="netMoney >= 0">
              每学期净省 ¥{{ money(netMoney) }}
            </template>
            <template v-else>
              每学期需多投入 ¥{{ money(netMoney) }}
            </template>
          </p>
          <p class="verdict__note">
            <template v-if="netMoney >= 0">
              系统费用 ¥{{ money(systemCost) }}（{{ input.seats }} 工位 × 一学期）。
            </template>
            <template v-else>
              工位数不变时，按当前实训量需要更多课时才能摊平——建议先上单模块试点，或把 AI 老师也计入使用范围。
            </template>
          </p>
        </div>

        <p class="roi__foot">
          上方的工时只算了评分与录入。过程录像、扣分留痕、大赛评分依据这些不折算成钱，但立项材料里通常比工时更管用。
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.roi {
  background: $site-ground-alt;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    gap: 72px;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 96px $site-gutter;
  }

  &__intro {
    h2 {
      max-width: 14em;
      margin: 0;
      font-size: $site-h2;
      font-weight: 600;
      line-height: 1.25;
      color: $site-ink;
      letter-spacing: -0.02em;
    }

    p {
      max-width: 32em;
      margin: 16px 0 0;
      font-size: $site-body;
      line-height: 1.75;
      color: $site-ink-muted;
    }
  }

  &__panel {
    padding: 28px;
    background: #fff;
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
  }

  &__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 20px;
  }

  &__foot {
    margin: 20px 0 0;
    padding-top: 16px;
    font-size: 12.5px;
    line-height: 1.7;
    color: $site-ink-muted;
    border-top: 1px solid $color-border-light;
  }
}

.formula {
  margin-top: 32px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  &__label {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.08em;
  }

  &__line {
    margin: 0;
    font-family: $font-family-mono;
    font-size: 13px;
    line-height: 1.7;
    color: $site-ink;
    font-variant-numeric: tabular-nums;
  }

  &__note {
    margin: 10px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: $site-ink-muted;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 12.5px;
    color: $site-ink-muted;
  }

  &__control {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 10px;
    background: $site-ground-alt;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    transition: border-color $duration-fast $ease-standard;

    &:focus-within {
      border-color: $color-primary;
      box-shadow: $shadow-focus;
    }

    input {
      width: 100%;
      min-width: 0;
      font-family: $font-family-mono;
      font-size: 15px;
      font-weight: 500;
      color: $site-ink;
      background: transparent;
      border: 0;
      outline: none;
      font-variant-numeric: tabular-nums;

      // 去掉数字框的上下箭头：这里的输入是「填一个数」，不是反复微调
      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        margin: 0;
        appearance: none;
      }

      appearance: textfield;
    }

    em {
      flex-shrink: 0;
      font-size: 12px;
      font-style: normal;
      color: $site-ink-muted;
    }
  }
}

.result {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 24px 0 0;

  &__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    padding: 11px 0;
    border-top: 1px solid $color-border-light;

    dt {
      font-size: 13.5px;
      color: $site-ink-muted;
    }

    dd {
      display: flex;
      gap: 6px;
      align-items: baseline;
      margin: 0;
      font-family: $font-family-mono;
      font-size: 19px;
      font-weight: 600;
      color: $site-ink;
      font-variant-numeric: tabular-nums;

      span {
        font-family: $font-family-base;
        font-size: 12px;
        font-weight: 400;
        color: $site-ink-muted;
      }
    }

    &--strong {
      border-top-color: $color-border-strong;

      dd {
        font-size: 24px;
      }
    }
  }
}

.verdict {
  margin-top: 18px;
  padding: 16px 18px;
  // 用中性浅灰而不是品牌浅蓝：这一块是结论，不是操作入口，
  // 全页彩色只留给按钮与焦点，否则又回到「彩色卡片堆叠」的模板相
  background: $color-bg-subtle;
  border-radius: $radius-md;

  &__label {
    margin: 0;
    font-size: 12px;
    color: $site-ink-muted;
  }

  &__value {
    margin: 6px 0 0;
    font-family: $font-family-mono;
    font-size: 22px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  &__note {
    margin: 8px 0 0;
    font-size: 12.5px;
    line-height: 1.7;
    color: $site-ink-muted;
  }

  // 负值只是结论不同，不是错误，不加红色
  &.is-negative .verdict__value {
    color: $site-ink-soft;
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .roi {
    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 36px;
      padding: 80px $site-gutter-tablet;
    }

    &__intro h2 {
      max-width: none;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .roi {
    &__inner {
      padding: 64px $site-gutter-phone;
    }

    &__panel {
      padding: 20px 16px;
    }

    &__fields {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
  }

  .result__row--strong dd {
    font-size: 20px;
  }
}
</style>
