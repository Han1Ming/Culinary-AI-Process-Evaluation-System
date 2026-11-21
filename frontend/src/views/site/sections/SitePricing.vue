<script setup lang="ts">
/**
 * 定价
 * ----------------------------------------------------------------------------
 * 这一节存在的理由：学校立项的第一个问题是「多少钱」，第二个是「包含什么」。
 * 官网回避报价，采购就会转去问同行，流程反而更慢。
 *
 * 三档对应三条真实采购路径，而不是「基础 / 进阶 / 尊享」这种没有业务含义的分级：
 *   先试一个模块 → 整间实训室按工位年费 → 数据不出校的私有化买断。
 *
 * 排版纪律：
 *   · 不用「推荐」角标、不用渐变按钮、不用彩色勾选图标
 *   · 中间档的强调只靠底色（与模块区第 8 格呼应），不靠尺寸放大或阴影堆叠
 *   · 价格数字用等宽字体 + tabular-nums，三档左边缘对齐，方便横向比价
 */
import { plans, pricingNotes } from '@/views/site/data'
import { useRouter } from 'vue-router'

const router = useRouter()

/** 每张卡带自己的套餐参数过去，留资页的下拉会自动选中，少一步选择 */
function goDemo(plan?: string) {
  void router.push({ path: '/demo', query: plan ? { plan } : {} })
}
</script>

<template>
  <section id="pricing" class="pricing">
    <div class="pricing__inner">
      <header v-reveal class="pricing__head">
        <h2>按工位计价，先试一个模块也行</h2>
        <p>
          一所高职的烹饪实训室通常 24 到 40 个工位。整室上线按工位年费走，单价随工位数递减；预算审批慢的，先用一个模块跑一学期。
        </p>
        <p class="pricing__disclaimer">以下为参考价，正式报价按工位数、部署方式与对接工作量核定。</p>
      </header>

      <ul class="plan-grid">
        <li
          v-for="(plan, i) in plans"
          :key="plan.key"
          v-reveal="{ delay: i * 80 }"
          class="plan"
          :class="{ 'plan--focus': plan.emphasis }"
        >
          <h3 class="plan__name">{{ plan.name }}</h3>
          <p class="plan__fit">{{ plan.fit }}</p>

          <p class="plan__price">
            <span class="plan__currency">¥</span>{{ plan.price }}<span class="plan__unit">{{ plan.unit }}</span>
          </p>
          <p class="plan__scale">{{ plan.scale }}</p>

          <ul class="plan__list">
            <li v-for="item in plan.includes" :key="item">{{ item }}</li>
          </ul>

          <p class="plan__deliverable">{{ plan.deliverable }}</p>

          <button type="button" class="plan__cta" @click="goDemo(plan.key)">
            {{ plan.cta }}
          </button>
        </li>
      </ul>

      <div v-reveal="{ delay: 120 }" class="pricing__foot">
        <dl class="notes">
          <div v-for="note in pricingNotes" :key="note.label" class="notes__row">
            <dt>{{ note.label }}</dt>
            <dd>{{ note.text }}</dd>
          </div>
        </dl>

        <div class="pricing__cta">
          <p>不确定该选哪一档？把工位数和课程安排发过来，我们出一份带价格的方案。</p>
          <button type="button" class="btn btn--primary" @click="goDemo()">索取报价方案</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pricing {
  background: $site-ground;

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 104px $site-gutter 96px;
  }

  &__head {
    max-width: 46em;
    margin-bottom: 44px;

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

  &__disclaimer {
    font-size: $site-label !important;
    color: $site-ink-muted !important;
    // 用引线标记「这是附注」，比灰色小字更清楚它在说什么
    padding-left: 12px;
    border-left: 2px solid $color-border-strong;
  }

  &__foot {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 64px;
    margin-top: 56px;
    padding-top: 40px;
    border-top: 1px solid $color-border-light;
  }

  &__cta {
    p {
      margin: 0 0 20px;
      font-size: 15px;
      line-height: 1.7;
      color: $site-ink-soft;
    }
  }
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.plan {
  display: flex;
  flex-direction: column;
  padding: 28px 26px 26px;
  background: #fff;
  border: 1px solid $color-border-light;
  border-radius: $radius-lg;
  // 悬停缓动：300ms、快起慢收。抬升用独立的 translate 属性，
  // 因为 transform 已经被 v-reveal 占着做进场位移，写同一个属性会互相打断。
  transition:
    translate $duration-hover $ease-out,
    border-color $duration-hover $ease-out,
    box-shadow $duration-hover $ease-out,
    background-color $duration-hover $ease-out;

  &:hover {
    translate: 0 -3px;
    border-color: $color-border-strong;
    box-shadow: 0 20px 40px -32px rgba(23, 23, 26, 0.4);
  }

  &__name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: 0.01em;
  }

  &__fit {
    min-height: 3.2em;
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.6;
    color: $site-ink-muted;
  }

  &__price {
    display: flex;
    align-items: baseline;
    margin: 26px 0 0;
    font-family: $font-family-mono;
    font-size: 34px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  &__currency {
    margin-right: 2px;
    font-size: 18px;
    font-weight: 500;
    color: $site-ink-muted;
  }

  &__unit {
    margin-left: 6px;
    font-family: $font-family-base;
    font-size: 13px;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0;
  }

  &__scale {
    margin: 10px 0 0;
    padding-bottom: 22px;
    font-size: 13px;
    color: $site-ink-soft;
    border-bottom: 1px solid $color-border-light;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 9px;
    padding: 22px 0 0;
    margin: 0;
    list-style: none;

    li {
      position: relative;
      padding-left: 13px;
      font-size: 13.5px;
      line-height: 1.6;
      color: $site-ink-soft;

      &::before {
        position: absolute;
        top: 9px;
        left: 0;
        width: 5px;
        height: 1px;
        content: '';
        background: $color-border-strong;
      }
    }
  }

  // 交付说明压在卡片底部，三张卡底部对齐
  &__deliverable {
    margin: auto 0 0;
    padding-top: 20px;
    font-size: 12.5px;
    line-height: 1.65;
    color: $site-ink-muted;
  }

  // 每档自己的动作入口。以前三张卡都是「只能看」，要行动得滚到下面那一个按钮，
  // 而采购开会时往往是「我们就要中间这档」——卡片上直接给按钮，少一次上下找。
  &__cta {
    height: 40px;
    margin-top: 18px;
    font-family: inherit;
    font-size: 13.5px;
    font-weight: 500;
    color: $site-ink;
    cursor: pointer;
    background: transparent;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    transition:
      background-color $duration-hover $ease-out,
      border-color $duration-hover $ease-out,
      color $duration-hover $ease-out;

    &:hover {
      background: $site-ground-alt;
      border-color: $color-border-strong;
    }

    &:focus-visible {
      outline: 2px solid $color-primary;
      outline-offset: 2px;
    }
  }

  &--focus {
    color: $site-ink-inverse;
    background: $site-ink;
    border-color: $site-ink;

    // 深色卡抬起来要更明显一点：白底卡靠阴影就够，它得靠底色和阴影一起
    &:hover {
      background: #212127;
      border-color: #212127;
      box-shadow: 0 24px 48px -30px rgba(23, 23, 26, 0.65);
    }

    .plan__cta {
      color: #fff;
      border-color: rgba(255, 255, 255, 0.28);

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.55);
      }
    }

    .plan__name {
      color: #fff;
    }

    // 深底上的辅助文字不能直接用 $site-ink-inverse-muted：
    // 12.5px 的小字在 #17171a 上会糊成一团，实测截图里几乎读不出来
    .plan__fit,
    .plan__deliverable {
      color: rgba(255, 255, 255, 0.66);
    }

    .plan__price {
      color: #fff;
    }

    .plan__currency,
    .plan__unit {
      color: rgba(255, 255, 255, 0.6);
    }

    .plan__scale {
      color: $site-ink-inverse;
      border-bottom-color: rgba(255, 255, 255, 0.14);
    }

    .plan__list li {
      color: rgba(255, 255, 255, 0.82);

      &::before {
        background: rgba(255, 255, 255, 0.36);
      }
    }
  }
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;

  &__row {
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 16px;

    dt {
      font-size: 13px;
      font-weight: 500;
      color: $site-ink;
    }

    dd {
      margin: 0;
      font-size: 13px;
      line-height: 1.75;
      color: $site-ink-muted;
    }
  }
}

// ---------- 响应式 ----------
@media (max-width: 1280px) {
  .plan-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: $breakpoint-lg) {
  .pricing {
    &__inner {
      padding: 80px $site-gutter-tablet;
    }

    &__foot {
      grid-template-columns: minmax(0, 1fr);
      gap: 32px;
    }
  }

  // 三张卡在 1024 以下直接单列：两列会剩下一张孤零零挂在左边，
  // 比排得长更难看。模块区能两列是因为它有 8 张卡，正好整除。
  .plan-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .plan__fit {
    min-height: 0;
  }
}

@media (max-width: $breakpoint-sm) {
  .pricing__inner {
    padding: 64px $site-gutter-phone;
  }

  .plan-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .plan {
    padding: 24px 20px;

    &__fit {
      min-height: 0;
    }

    &__price {
      margin-top: 20px;
      font-size: 30px;
    }
  }

  .notes__row {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .pricing__cta .btn {
    width: 100%;
  }
}

// 系统开了「减少动态效果」：不抬升、不加阴影，只留边框与底色的变化
@media (prefers-reduced-motion: reduce) {
  .plan {
    transition: border-color $duration-hover $ease-out;

    &,
    &:hover,
    &.plan--focus:hover {
      translate: none;
      box-shadow: none;
    }
  }
}
</style>
