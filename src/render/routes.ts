import Downloader from "./pages/downloader/index.vue"
import Entry from "./pages/entry.vue"
import { RouteRecordRaw } from "vue-router"

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: Entry,
  },
  {
    path: "/downloader",
    component: Downloader,
  },
]

export default routes
