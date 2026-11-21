<script setup lang="ts">
/**
 * 三类使用者
 * ----------------------------------------------------------------------------
 * 这一节回答信息化部门与专业负责人的第二个问题：「装上去以后，谁看到什么？」
 * 一套系统三个角色，最容易出问题的地方不是功能多寡，而是边界——
 * 学生不该看到同学的成绩，管理员不该参与打分。
 *
 * 排版故意不用卡片（上一节已经是卡片网格了）：三栏、细竖线分隔、纯文字。
 * 卡片套卡片是模板感最重的来源之一；一段话能说清的事不需要框。
 */
interface RoleColumn {
  key: string
  name: string
  /** 一句话定位，不超过 40 字 */
  scope: string
  /** 这个角色在这套系统里负责的事 */
  duties: string[]
  /** 明确不做 / 看不到的部分，边界比能力更能说明设计 */
  boundary: string
}

const columns: RoleColumn[] = [
  {
    key: 'student',
    name: '学生',
    scope: '走完一节课的实训链路，看到的数据只有自己的。',
    duties: [
      '人脸签到、着装自检，通过后开始实操',
      '切配、烹饪、成品逐环节提交，过程自动计时',
      '把成品图交给智能 AI 老师，问下一步怎么改',
    ],
    boundary: '看不到班级排名与同学的成绩。',
  },
  {
    key: 'teacher',
    name: '教师',
    scope: '组织课程与评价过程，对判定结果有最终裁量权。',
    duties: [
      '上传本节课菜肴的菜谱 PDF，指定班级与实训目标',
      '在评价模块左上角切换在评学生，逐人查看录像',
      '不合规的操作当场扣分并留痕，复核后归档成绩',
    ],
    boundary: '不修改模型给出的分数，只追加人工裁量记录。',
  },
  {
    key: 'admin',
    name: '系统管理员',
    scope: '维护账号体系与通知，掌握全站运行情况。',
    duties: [
      '管理学生与教师账号，补录人脸照片、启停用',
      '发布通知与功能更新公告，跟踪阅读情况',
      '查看全站态势、账号构成与未录入人脸的名单',
    ],
    boundary: '不参与具体评分，也没有课程内的操作权。',
  },
]

/**
 * 权限矩阵：把「谁看到什么」从三段散文变成一张能对着念的表。
 * 采购会与合规审查上最常被追问的不是「功能有多少」，而是
 * 「学生会不会看到别人的分数」「管理员能不能改分」——
 * 这两句话用一张表比用段落省解释时间。
 *
 * 四档取值一律写成文字，不用 ✓/✕ 图标：图标要配色，一配色就破功。
 */
type Access = 'edit' | 'read' | 'own' | 'none'

interface CapabilityRow {
  label: string
  student: Access
  teacher: Access
  admin: Access
}

const roleKeys = ['student', 'teacher', 'admin'] as const
const roleNames: Record<(typeof roleKeys)[number], string> = {
  student: '学生',
  teacher: '教师',
  admin: '管理员',
}
const ACCESS_LABEL: Record<Access, string> = {
  edit: '可操作',
  read: '可查看',
  own: '仅本人',
  none: '—',
}

const capabilities: CapabilityRow[] = [
  { label: '人脸签到与着装自检', student: 'edit', teacher: 'read', admin: 'none' },
  { label: '切配、烹饪过程记录', student: 'edit', teacher: 'read', admin: 'none' },
  { label: '成品拍照与五维评分', student: 'edit', teacher: 'read', admin: 'none' },
  { label: '过程录像回放', student: 'own', teacher: 'read', admin: 'none' },
  { label: '扣分与人工裁量', student: 'none', teacher: 'edit', admin: 'none' },
  { label: '评分标准与权重', student: 'none', teacher: 'edit', admin: 'none' },
  { label: '成绩单与报告导出', student: 'own', teacher: 'edit', admin: 'none' },
  { label: '账号与人脸底库', student: 'none', teacher: 'none', admin: 'edit' },
  { label: '通知与公告', student: 'read', teacher: 'read', admin: 'edit' },
]
</script>

<template>
  <section id="roles" class="roles">
    <div class="roles__inner">
      <header v-reveal class="section-head">
        <h2>三个角色，三套看到的界面</h2>
        <p>
          同一套系统，学生只看自己的数据，教师能切换在评学生并直接扣分，管理员管人不评分。权限写在配置里，不是在每个页面里手写判断。
        </p>
      </header>

      <ul class="role-grid">
        <li
          v-for="(role, i) in columns"
          :key="role.key"
          v-reveal="{ delay: i * 60 }"
          class="role-col"
        >
          <h3 class="role-col__name">{{ role.name }}</h3>
          <p class="role-col__scope">{{ role.scope }}</p>

          <p class="role-col__label">负责</p>
          <ul class="role-col__list">
            <li v-for="duty in role.duties" :key="duty">{{ duty }}</li>
          </ul>

          <p class="role-col__boundary">
            <span>边界</span>
            {{ role.boundary }}
          </p>
        </li>
      </ul>

      <div v-reveal="{ delay: 180 }" class="matrix">
        <div class="matrix__head">
          <h3>功能边界</h3>
          <p>同一项功能，三个人能做的事不一样。「—」不是没做，是不对这个角色开放。</p>
        </div>

        <table class="matrix__table">
          <thead>
            <tr>
              <th scope="col">功能</th>
              <th v-for="key in roleKeys" :key="key" scope="col">{{ roleNames[key] }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in capabilities" :key="row.label">
              <th scope="row">{{ row.label }}</th>
              <td
                v-for="key in roleKeys"
                :key="key"
                :class="`is-${row[key]}`"
                :data-role="roleNames[key]"
              >
                {{ ACCESS_LABEL[row[key]] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer v-reveal="{ delay: 240 }" class="roles__foot">
        <span>登录后菜单按角色生成，越权地址会被拦回工作台。</span>
        <RouterLink to="/login" class="link-btn">登录后按角色查看 →</RouterLink>
      </footer>
    </div>
  </section>
</template>

<style scoped lang="scss">
.roles {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  background: $site-ground;

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 88px $site-gutter;
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    gap: $space-3;
    align-items: center;
    justify-content: space-between;
    padding-top: 28px;
    margin-top: 48px;
    font-size: $site-label;
    color: $site-ink-muted;
    border-top: 1px solid $color-border-light;
  }
}

.section-head {
  max-width: 46em;
  margin-bottom: 52px;

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

.role-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 0;
  margin: 0;
  list-style: none;
}

.role-col {
  padding: 0 40px;

  // 细竖线分隔：三栏之间的关系靠线，不靠底色
  & + & {
    border-left: 1px solid $color-border-light;
  }

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    padding-right: 0;
  }

  &__name {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
    color: $site-ink;
    letter-spacing: -0.015em;
  }

  &__scope {
    min-height: 3.4em;
    margin: 10px 0 0;
    font-size: 14.5px;
    line-height: 1.7;
    color: $site-ink-muted;
  }

  &__label {
    padding-bottom: 8px;
    margin: 26px 0 0;
    font-size: 12px;
    color: $site-ink-muted;
    letter-spacing: 0.08em;
    border-bottom: 1px solid $color-border-light;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    margin: 14px 0 0;
    list-style: none;

    li {
      position: relative;
      padding-left: 13px;
      font-size: 14px;
      line-height: 1.6;
      color: $site-ink-soft;

      &::before {
        position: absolute;
        top: 9px;
        left: 0;
        width: 5px;
        height: 1px;
        content: '';
        background: $site-ink-muted;
      }
    }
  }

  &__boundary {
    padding-top: 14px;
    margin: 22px 0 0;
    font-size: 13px;
    line-height: 1.65;
    color: $site-ink-muted;
    border-top: 1px solid $color-border-light;

    span {
      margin-right: 6px;
      font-size: 11px;
      color: $site-ink;
      letter-spacing: 0.06em;
    }
  }
}

// ---------- 权限矩阵 ----------
.matrix {
  padding-top: 26px;
  margin-top: 36px;
  border-top: 1px solid $color-border-light;

  &__head {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
    align-items: baseline;

    h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: $site-ink;
      letter-spacing: -0.01em;
    }

    p {
      margin: 0;
      font-size: 13px;
      color: $site-ink-muted;
    }
  }

  &__table {
    width: 100%;
    margin-top: 16px;
    font-size: 13.5px;
    text-align: left;
    border-collapse: collapse;

    thead th {
      padding: 0 0 10px;
      font-size: 12px;
      font-weight: 500;
      color: $site-ink-muted;
      letter-spacing: 0.04em;
      border-bottom: 1px solid $color-border;
    }

    tbody tr {
      border-bottom: 1px solid $color-border-light;
    }

    tbody th {
      padding: 9px 0;
      font-weight: 400;
      color: $site-ink-soft;
    }

    // 四列按 52% / 16% ×3 分：第一列读功能名，后三列各占等宽，
    // 视线沿着表头往下扫就能比出差别，不会挤在右边缘
    thead th:first-child {
      width: 52%;
    }

    td,
    thead th:not(:first-child) {
      width: 16%;
    }

    td {
      padding: 9px 0;
      color: $site-ink-muted;
    }

    // 「可操作」加重，「不开放」压到最淡——一眼能分出三层
    .is-edit {
      font-weight: 500;
      color: $site-ink;
    }

    .is-none {
      color: $color-text-placeholder;
    }
  }
}

@media (max-width: $breakpoint-lg) {
  .roles {
    align-items: flex-start;

    &__inner {
      padding: 80px $site-gutter-tablet;
    }
  }

  .role-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 36px;
  }

  .role-col {
    padding: 0;

    & + & {
      padding-top: 32px;
      border-top: 1px solid $color-border-light;
      border-left: 0;
    }

    &__scope {
      min-height: 0;
    }
  }
}

// 手机上表格横向放不下：整表拆成「一行一项功能，下面三行三档权限」。
// 不用横向滚动条——滚到一半看不到行名，矩阵就失去意义。
@media (max-width: $breakpoint-md) {
  .matrix {
    margin-top: 32px;

    &__head {
      flex-direction: column;
      gap: 6px;
    }

    &__table {
      margin-top: 12px;

      thead {
        display: none;
      }

      tbody tr {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 3px;
        padding: 12px 0;
      }

      tbody th {
        padding: 0 0 3px;
        font-size: 14px;
        color: $site-ink;
        border: 0;
      }

      td {
        display: flex;
        gap: 10px;
        width: auto;
        padding: 0;
        font-size: 12.5px;

        &::before {
          min-width: 40px;
          color: $site-ink-muted;
          content: attr(data-role);
        }
      }
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .roles__inner {
    padding: 64px $site-gutter-phone;
  }

  .section-head {
    margin-bottom: 32px;
  }

  .role-col__name {
    font-size: 19px;
  }
}
</style>
