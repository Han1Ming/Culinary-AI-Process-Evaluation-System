<script setup lang="ts">
/**
 * 官网首页
 * ----------------------------------------------------------------------------
 * 页面按「一屏一节」组织，顺序对应访客的疑问：
 *   这是做什么的（首屏）→ 有哪些能力（模块）→ 谁看到什么（角色）
 *   → 一节课怎么跑（流程）→ 长什么样（界面）→ 能省多少（测算）
 *   → 多少钱（定价）→ 多久上线（实施）→ 怎么接进来（对接）
 *   → 谁在用（场景）→ 还有什么问题（FAQ）
 *
 * 后四节是商业闭环：没有测算与报价，官网只是产品说明书，
 * 采购方看完还得回来问一遍，转化链路就断在这里。
 *
 * 【动效】进场统一走 v-reveal：滚到视口才播，只播一次，位移 14px。
 * 首屏不挂 v-reveal（它在打开时就该在），用组件内的加载动画。
 * 模块 / 角色 / 定价三节不在这里挂，改在组件内按卡片逐个延迟，
 * 否则「整节一起淡入」和「卡片依次落下」会叠加成两层位移。
 * 首屏照片与产品截图另挂 v-parallax（≤40px 行程），文字不做视差。
 *
 * 刻意没有做的事：
 *   · 没有鼠标跟随、没有跟随滚动缩放、没有数字滚动播报
 *   · 没有客户 logo 墙与评价轮播——没有授权就不摆别人的名字
 *   · 没有渐变按钮、彩色图标底板、飘浮胶囊标签
 *   · 没有「已服务 100+ 院校」「效率提升 300%」——没有对照组就没有这个数
 */
import SiteClose from './sections/SiteClose.vue'
import SiteDelivery from './sections/SiteDelivery.vue'
import SiteFaq from './sections/SiteFaq.vue'
import SiteFlow from './sections/SiteFlow.vue'
import SiteHero from './sections/SiteHero.vue'
import SiteIntegration from './sections/SiteIntegration.vue'
import SiteModules from './sections/SiteModules.vue'
import SitePricing from './sections/SitePricing.vue'
import SiteProduct from './sections/SiteProduct.vue'
import SiteRoi from './sections/SiteRoi.vue'
import SiteRoles from './sections/SiteRoles.vue'
import SiteScenes from './sections/SiteScenes.vue'
</script>

<template>
  <div class="home">
    <SiteHero />
    <SiteModules />
    <SiteRoles />
    <SiteFlow v-reveal />
    <SiteProduct v-reveal />
    <SiteRoi v-reveal />
    <SitePricing />
    <SiteDelivery v-reveal />
    <SiteIntegration v-reveal />
    <SiteScenes v-reveal />
    <SiteFaq v-reveal />
    <SiteClose v-reveal />
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
