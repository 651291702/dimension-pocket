import { createApp } from "vue"
import ElementPlus from "element-plus"
import App from "./App.vue"
import "element-plus/lib/theme-chalk/index.css"
import "@/assets/css/index.css"
import "@/assets/css/index.scss"
import routes from "./routes"
import { createRouter, createWebHistory } from "vue-router"
import LuckyIcon from "@/components/icon/index.vue"
import { getUserDataPath } from "~/commons/util"

const app = createApp(App)
const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to, from) => {
  const toDepth = to.path.split("/").filter((t) => t).length
  const fromDepth = from.path.split("/").filter((t) => t).length
  to.meta.transitionName = toDepth < fromDepth ? "slide-right" : "slide-left"
})

/**
 * https://stackoverflow.com/questions/63628677/how-to-enable-devtools-in-vue-3-with-typescipt-in-development-mode
 * 至少安装 devtool v6.0.0.2 beta （v6.0.0.1报错)
 */

// app.config.performance = true

app.component("lucky-icon", LuckyIcon)

app.use(ElementPlus).use(router).mount("#app")
