import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import 'element-plus/dist/index.css'
// 顺序：Element 默认样式 → 本项目令牌与覆盖（必须在其后，才能生效）
import '@/assets/styles/index.scss'

import App from './App.vue'
import router from './router'
import pinia from './stores'
import { vStagger } from './directives/stagger'

const app = createApp(App)

// 全量注册 Element Plus 图标，模板中可直接使用 <el-icon><Odometer /></el-icon>
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局指令：v-stagger 列表顺序进场
app.directive('stagger', vStagger)

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn, size: 'default', zIndex: 3000 })

app.mount('#app')
