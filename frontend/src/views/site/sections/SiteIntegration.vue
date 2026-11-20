<script setup lang="ts">
/**
 * 接口对接
 * ----------------------------------------------------------------------------
 * 这一屏的目标读者是后端同学与信息化部门：把七个接口摊开写清楚，
 * 比「我们提供开放接口」这种话有用。深色带让它在整页里形成一处停顿，
 * 也是整页唯一的深色区块。
 */
import { apiContracts, techStack } from '@/views/site/data'
</script>

<template>
  <section id="integration" class="integration">
    <div class="integration__inner">
      <header class="section-head">
        <h2>接口对接</h2>
        <p>
          前端已经把七个模块的调用层写完，后端按下列约定返回数据即可切换真实环境。统一响应格式为
          <code>{ code, data, message }</code>，鉴权走 Bearer Token。
        </p>
      </header>

      <div class="api-wrap">
        <table class="api">
          <thead>
            <tr>
              <th scope="col">模块</th>
              <th scope="col">方法</th>
              <th scope="col">路径</th>
              <th scope="col">请求</th>
              <th scope="col">响应</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in apiContracts" :key="row.path">
              <td class="api__module">{{ row.module }}</td>
              <td>
                <span class="api__method" :data-method="row.method">{{ row.method }}</span>
              </td>
              <td class="api__path">{{ row.path }}</td>
              <td class="api__io">{{ row.payload }}</td>
              <td class="api__io">{{ row.response }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="stack">
        <div v-for="group in techStack" :key="group.group" class="stack__col">
          <h3>{{ group.group }}</h3>
          <ul>
            <li v-for="item in group.items" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.integration {
  display: flex;
  align-items: center;
  min-height: calc(100svh - #{$site-nav-height});
  color: $site-ink-inverse;
  background: $site-ground-dark;

  &__inner {
    width: 100%;
    max-width: calc(#{$site-max-width} + #{$site-gutter} * 2);
    margin: 0 auto;
    padding: 76px $site-gutter;
  }
}

.section-head {
  max-width: 52em;
  margin-bottom: 40px;

  h2 {
    margin: 0;
    font-size: $site-h2;
    font-weight: 600;
    line-height: 1.2;
    color: #fff;
    letter-spacing: -0.02em;
  }

  p {
    margin: 16px 0 0;
    font-size: $site-body;
    line-height: 1.7;
    color: $site-ink-inverse-muted;
  }

  code {
    padding: 2px 6px;
    font-family: $font-family-mono;
    font-size: 13px;
    color: #e4e4e7;
    background: rgba(255, 255, 255, 0.08);
    border-radius: $radius-xs;
  }
}

.api-wrap {
  overflow-x: auto;
}

.api {
  width: 100%;
  min-width: 860px;
  font-size: 13px;
  border-collapse: collapse;

  th {
    padding: 0 16px 12px 0;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
    text-align: left;
    letter-spacing: 0.04em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  td {
    padding: 11px 16px 11px 0;
    color: #e4e4e7;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  tbody tr {
    transition: background-color $duration-fast $ease-standard;

    &:hover td {
      background: rgba(255, 255, 255, 0.03);
    }

    &:hover td:first-child {
      border-radius: $radius-sm 0 0 $radius-sm;
    }

    &:hover td:last-child {
      border-radius: 0 $radius-sm $radius-sm 0;
    }
  }

  &__module {
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
  }

  &__method {
    display: inline-block;
    padding: 2px 7px;
    font-family: $font-family-mono;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: $radius-xs;
  }

  &__path {
    font-family: $font-family-mono;
    font-size: 12.5px;
    color: #d4d4d8;
    white-space: nowrap;
  }

  &__io {
    font-family: $font-family-mono;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }
}

.stack {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  padding-top: 30px;
  margin-top: 30px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  &__col {
    h3 {
      margin: 0 0 12px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 0.06em;
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    li {
      font-size: 14px;
      color: #d4d4d8;
    }
  }
}

// ---------- 响应式 ----------
@media (max-width: $breakpoint-lg) {
  .integration {
    align-items: flex-start;

    &__inner {
      padding: 80px $site-gutter-tablet;
    }
  }

  .stack {
    gap: 24px;
  }
}

@media (max-width: $breakpoint-sm) {
  .integration__inner {
    padding: 64px $site-gutter-phone 72px;
  }

  .section-head {
    margin-bottom: 28px;
  }

  .stack {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
    padding-top: 32px;
    margin-top: 32px;
  }
}
</style>
