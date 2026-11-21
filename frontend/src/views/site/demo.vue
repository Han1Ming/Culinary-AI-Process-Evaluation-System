<script setup lang="ts">
/**
 * 预约演示（官网唯一的转化出口）
 * ----------------------------------------------------------------------------
 * 为什么单独一页而不复用 /register：
 *   · /register 是给学生开账号的，要采集人脸、等管理员审核，企业采购走进去就断了
 *   · 采购决策要留的是「机构 + 职务 + 工位数 + 上线时间」，不是学号
 * 所以独立页面、独立接口、独立话术。
 *
 * 表单纪律：
 *   · 字段只留六个，能被电话里问清的信息不放进表单（降低放弃率）
 *   · 用原生控件而不是组件库：营销站的 44px 高度与 8px 圆角跟后台不是一套
 *   · 校验在失焦时就地提示，不等到提交才一次性标红
 */
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { submitDemoRequest } from '@/api/demo'
import { demoPlans, demoPrepares, demoScales, demoWants } from '@/views/site/data'

const route = useRoute()
const router = useRouter()

/** 从定价页带过来的套餐，映射成下拉里的文案 */
const PLAN_PRESET: Record<string, string> = {
  pilot: '单模块试点',
  annual: '实训室年费',
  onprem: '私有化买断',
}

const presetPlan = PLAN_PRESET[String(route.query.plan ?? '')]

const form = reactive({
  org: '',
  name: '',
  role: '专业负责人',
  phone: '',
  scale: demoScales[2] as string,
  plan: presetPlan ?? demoPlans[0],
  want: demoWants[0] as string,
  note: '',
})

const roleOptions = ['专业负责人', '实训教师', '信息中心', '院系领导', '其他']

type Field = 'org' | 'name' | 'phone'
const touched = reactive<Record<Field, boolean>>({ org: false, name: false, phone: false })

const errors = computed<Partial<Record<Field, string>>>(() => {
  const next: Partial<Record<Field, string>> = {}
  if (form.org.trim().length < 2) next.org = '请填写学校或机构全称'
  if (form.name.trim().length < 2) next.name = '请填写称呼'
  if (!/^1[3-9]\d{9}$/.test(form.phone)) next.phone = '手机号用于回电确认时间'
  return next
})

const valid = computed(() => Object.keys(errors.value).length === 0)

const submitting = ref(false)
const result = ref<{ requestNo: string } | null>(null)
const failed = ref('')

async function submit(): Promise<void> {
  // 提交时把所有字段标为已触摸，未填的立刻显示提示
  touched.org = true
  touched.name = true
  touched.phone = true
  if (!valid.value) {
    document.querySelector<HTMLElement>('.demo-form .is-invalid input')?.focus()
    return
  }

  submitting.value = true
  failed.value = ''
  try {
    result.value = await submitDemoRequest({ ...form })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    failed.value = error instanceof Error ? error.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="demo">
    <div class="demo__inner">
      <!-- 左栏：讲清楚「演示会发生什么」，减少不确定感 -->
      <div class="demo__aside">
        <p class="demo__eyebrow">预约演示</p>
        <h1 class="demo__title">用你自己的一节课来试</h1>
        <p class="demo__lead">
          我们不复述功能列表。你把本学期要评的菜和学生名单发过来，我们用你的视频跑一遍识别，当场给出这一节课的成绩单。
        </p>

        <ol class="how">
          <li>
            <span class="how__num">01</span>
            <div>
              <h2>确认时间与形式</h2>
              <p>提交后一个工作日内电话联系，约 30 分钟远程演示或到校勘查。</p>
            </div>
          </li>
          <li>
            <span class="how__num">02</span>
            <div>
              <h2>带素材跑一遍</h2>
              <p>用本校的菜谱与视频走完整链路，识别不准的地方当场说明原因。</p>
            </div>
          </li>
          <li>
            <span class="how__num">03</span>
            <div>
              <h2>出一份方案</h2>
              <p>按工位数与课程安排给出配置清单、报价与实施工期，可直接用于立项。</p>
            </div>
          </li>
        </ol>

        <div class="prepare">
          <h2 class="prepare__title">提前准备这三样，演示能省一半时间</h2>
          <ul>
            <li v-for="item in demoPrepares" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>

      <!-- 右栏：表单 / 成功态 -->
      <div class="demo__panel">
        <div v-if="result" class="done">
          <p class="done__label">已受理</p>
          <p class="done__no">{{ result.requestNo }}</p>
          <h2>一个工作日内会有人打给你</h2>
          <p class="done__text">
            回电号码来自本地固话或手机，注意接听。报上面的受理编号可以直接查到提交内容。
          </p>
          <div class="done__actions">
            <button type="button" class="btn btn--primary" @click="router.push('/')">返回首页</button>
            <button type="button" class="btn btn--ghost" @click="router.push('/#pricing')">查看定价</button>
          </div>
        </div>

        <form v-else class="demo-form" novalidate @submit.prevent="submit">
          <h2 class="demo-form__title">留下联系方式</h2>
          <p class="demo-form__note">六个字段，不需要注册账号。</p>

          <div class="field" :class="{ 'is-invalid': touched.org && errors.org }">
            <label for="org">学校 / 机构</label>
            <input
              id="org"
              v-model="form.org"
              type="text"
              maxlength="40"
              placeholder="如：XX 职业技术学院"
              @blur="touched.org = true"
            />
            <p v-if="touched.org && errors.org" class="field__error">{{ errors.org }}</p>
          </div>

          <div class="row">
            <div class="field" :class="{ 'is-invalid': touched.name && errors.name }">
              <label for="name">称呼</label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                maxlength="20"
                placeholder="如：王老师"
                @blur="touched.name = true"
              />
              <p v-if="touched.name && errors.name" class="field__error">{{ errors.name }}</p>
            </div>

            <div class="field">
              <label for="role">职务</label>
              <select id="role" v-model="form.role">
                <option v-for="item in roleOptions" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
          </div>

          <div class="field" :class="{ 'is-invalid': touched.phone && errors.phone }">
            <label for="phone">手机号</label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              inputmode="numeric"
              maxlength="11"
              placeholder="仅用于回电确认演示时间"
              @blur="touched.phone = true"
            />
            <p v-if="touched.phone && errors.phone" class="field__error">{{ errors.phone }}</p>
          </div>

          <div class="row">
            <div class="field">
              <label for="scale">工位规模</label>
              <select id="scale" v-model="form.scale">
                <option v-for="item in demoScales" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>

            <div class="field">
              <label for="plan">意向</label>
              <select id="plan" v-model="form.plan">
                <option v-for="item in demoPlans" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>
          </div>

          <div class="field">
            <span class="field__label">演示形式</span>
            <div class="choice">
              <button
                v-for="item in demoWants"
                :key="item"
                type="button"
                class="choice__item"
                :class="{ 'is-active': form.want === item }"
                :aria-pressed="form.want === item"
                @click="form.want = item"
              >
                {{ item }}
              </button>
            </div>
          </div>

          <div class="field">
            <label for="note">补充说明 <em>选填</em></label>
            <textarea
              id="note"
              v-model="form.note"
              rows="3"
              maxlength="200"
              placeholder="如：希望 12 月中旬前上线，本学期要评 6 道热菜"
            />
          </div>

          <p v-if="failed" class="demo-form__failed">{{ failed }}</p>

          <button type="submit" class="btn btn--primary demo-form__submit" :disabled="submitting">
            {{ submitting ? '提交中…' : '提交，等回电' }}
          </button>

          <p class="demo-form__legal">
            提交即表示同意按
            <button type="button" class="inline-link" @click="router.push('/privacy')">隐私政策</button>
            使用这些信息，我们不会用于其它用途或提供给第三方。
          </p>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.demo {
  background: $site-ground;

  &__inner {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 72px;
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 72px $site-gutter 96px;
  }

  &__eyebrow {
    margin: 0 0 16px;
    font-size: $site-label;
    font-weight: 500;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__title {
    margin: 0;
    font-size: clamp(32px, 3.6vw, 44px);
    font-weight: 600;
    line-height: 1.15;
    color: $site-ink;
    letter-spacing: -0.025em;
  }

  &__lead {
    max-width: 28em;
    margin: 20px 0 0;
    font-size: $site-lead;
    line-height: 1.75;
    color: $site-ink-soft;
  }

  &__panel {
    padding: 32px;
    background: #fff;
    border: 1px solid $color-border-light;
    border-radius: $radius-lg;
    // 提交成功后内容比表单短，卡片会突然塌一截；给个最小高度顶住
    min-height: 600px;
  }
}

// ---------- 演示流程 ----------
.how {
  padding: 0;
  margin: 40px 0 0;
  list-style: none;

  li {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 16px;
    padding: 20px 0;
    border-top: 1px solid $color-border-light;

    &:last-child {
      border-bottom: 1px solid $color-border-light;
    }
  }

  &__num {
    font-family: $font-family-mono;
    font-size: 12px;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: $site-ink;
  }

  p {
    margin: 7px 0 0;
    font-size: 13.5px;
    line-height: 1.7;
    color: $site-ink-muted;
  }
}

.prepare {
  margin-top: 32px;

  &__title {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: $site-ink;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 13px;
    font-size: 13px;
    line-height: 1.7;
    color: $site-ink-muted;

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

// ---------- 表单 ----------
.demo-form {
  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: -0.01em;
  }

  &__note {
    margin: 6px 0 24px;
    font-size: 13px;
    color: $site-ink-muted;
  }

  &__submit {
    width: 100%;
    margin-top: 6px;
  }

  &__failed {
    margin: 0 0 12px;
    font-size: 13px;
    color: $color-danger;
  }

  &__legal {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 1.7;
    color: $site-ink-muted;
  }
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;

  label,
  &__label {
    font-size: 12.5px;
    color: $site-ink-muted;

    em {
      font-style: normal;
      color: $color-border-strong;
    }
  }

  input,
  select,
  textarea {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    font-family: inherit;
    font-size: 14.5px;
    color: $site-ink;
    background: #fff;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    transition:
      border-color $duration-fast $ease-standard,
      box-shadow $duration-fast $ease-standard;

    &::placeholder {
      color: $color-text-placeholder;
    }

    &:focus {
      border-color: $color-primary;
      outline: none;
      box-shadow: $shadow-focus;
    }
  }

  select {
    // 只画一条下箭头，不用浏览器默认的立体箭头
    background-image: linear-gradient(45deg, transparent 50%, $site-ink 50%),
      linear-gradient(135deg, $site-ink 50%, transparent 50%);
    background-repeat: no-repeat;
    background-position:
      calc(100% - 18px) 19px,
      calc(100% - 13px) 19px;
    background-size:
      5px 5px,
      5px 5px;
    appearance: none;
    cursor: pointer;
  }

  textarea {
    height: auto;
    padding: 10px 12px;
    line-height: 1.6;
    resize: vertical;
  }

  &__error {
    margin: 0;
    font-size: 12px;
    color: $color-danger;
  }

  &.is-invalid input {
    border-color: $color-danger;
  }
}

.choice {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  &__item {
    height: 36px;
    padding: 0 14px;
    font-family: inherit;
    font-size: 13px;
    color: $site-ink-soft;
    cursor: pointer;
    background: #fff;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    transition:
      border-color $duration-fast $ease-standard,
      background-color $duration-fast $ease-standard;

    &:hover {
      border-color: $color-border-strong;
    }

    &.is-active {
      color: $color-primary-active;
      background: $color-primary-soft;
      border-color: $color-primary;
    }

    &:focus-visible {
      outline: 2px solid $color-primary;
      outline-offset: 2px;
    }
  }
}

.inline-link {
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  color: $site-ink-soft;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  background: none;
  border: 0;
}

// ---------- 成功态 ----------
.done {
  padding: 8px 0;

  &__label {
    margin: 0;
    font-size: 12px;
    color: $site-ink-muted;
    letter-spacing: 0.04em;
  }

  &__no {
    margin: 8px 0 24px;
    font-family: $font-family-mono;
    font-size: 20px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: 0.02em;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: $site-ink;
    letter-spacing: -0.01em;
  }

  &__text {
    margin: 12px 0 28px;
    font-size: 14px;
    line-height: 1.8;
    color: $site-ink-muted;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .demo {
    &__inner {
      grid-template-columns: minmax(0, 1fr);
      gap: 40px;
      padding: 56px $site-gutter-tablet 80px;
    }

    &__panel {
      padding: 24px;
      min-height: 0;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .demo {
    &__inner {
      padding: 40px $site-gutter-phone 64px;
    }

    &__panel {
      padding: 20px 16px;
    }
  }

  .row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .done__actions .btn {
    flex: 1 1 100%;
  }
}
</style>
