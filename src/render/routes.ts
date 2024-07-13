import Downloader from "./pages/downloader/index.vue"
import MusicDownloader from "./pages/musicDownloader/index.vue"
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
  {
    path: "/music",
    component: MusicDownloader,
  }
]

export default routes
