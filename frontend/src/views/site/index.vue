<script setup lang="ts">
/**
 * 官网首页
 * ----------------------------------------------------------------------------
 * 页面按「一屏一节」组织，顺序对应访客的疑问：
 *   这是做什么的（首屏）→ 有哪些能力（模块）→ 谁看到什么（角色）
 *   → 一节课怎么跑（流程）→ 长什么样（界面）→ 怎么接进来（对接）
 *   → 谁在用（场景）→ 还有什么问题（FAQ）
 *
 * 刻意没有做的事：
 *   · 没有滚动淡入、视差、鼠标跟随——这些是模板站最明显的记号
 *   · 没有客户 logo 墙与评价轮播——没有授权就不摆别人的名字
 *   · 没有渐变按钮、彩色图标底板、飘浮胶囊标签
 */
import SiteClose from './sections/SiteClose.vue'
import SiteFaq from './sections/SiteFaq.vue'
import SiteFlow from './sections/SiteFlow.vue'
import SiteHero from './sections/SiteHero.vue'
import SiteIntegration from './sections/SiteIntegration.vue'
import SiteModules from './sections/SiteModules.vue'
import SiteProduct from './sections/SiteProduct.vue'
import SiteRoles from './sections/SiteRoles.vue'
import SiteScenes from './sections/SiteScenes.vue'
</script>

<template>
  <div class="home">
    <SiteHero />
    <SiteModules />
    <SiteRoles />
    <SiteFlow />
    <SiteProduct />
    <SiteIntegration />
    <SiteScenes />
    <SiteFaq />
    <SiteClose />
  </div>
</template>

<style scoped lang="scss">
.home {
  // 锚点跳转时把固定顶栏的高度让出来
  :deep(section[id]) {
    scroll-margin-top: $site-nav-height;
  }
}
</style>
