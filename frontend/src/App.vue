<script setup lang="ts">
// 应用根组件：仅负责挂载路由出口与全局过渡
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <transition name="fade-slide" mode="out-in">
      <component :is="Component" :key="route.path" />
    </transition>
  </router-view>
</template>
