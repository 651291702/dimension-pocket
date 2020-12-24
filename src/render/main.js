import { createApp } from "vue"
import ElementPlus from "element-plus"
import App from "./App.vue"
import "element-plus/lib/theme-chalk/index.css"
import "./index.css"

const app = createApp(App)
app.use(ElementPlus).mount("#app")
