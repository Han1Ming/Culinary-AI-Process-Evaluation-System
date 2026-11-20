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
</script>

<template>
  <section id="roles" class="roles">
    <div class="roles__inner">
      <header class="section-head">
        <h2>三个角色，三套看到的界面</h2>
        <p>
          同一套系统，学生只看自己的数据，教师能切换在评学生并直接扣分，管理员管人不评分。权限写在配置里，不是在每个页面里手写判断。
        </p>
      </header>

      <ul class="role-grid">
        <li v-for="role in columns" :key="role.key" class="role-col">
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

      <footer class="roles__foot">
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
    padding: 96px $site-gutter;
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
