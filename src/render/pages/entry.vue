<template>
  <div class="main">
    <div class="selection" title="支持HLS协议" @click="toDownloader">
      <lucky-icon icon="video-downloader" :size="80"></lucky-icon>
      <span>视频下载器</span>
    </div>
    <div class="selection" title="支持网易云" @click="toMusic">
      <lucky-icon icon="music" :size="80"></lucky-icon>
      <span>音乐下载器</span>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue"
import { useRouter, useRoute } from "vue-router"

export default defineComponent({
  setup() {},
  methods: {
    toDownloader() {
      this.$router.push("/downloader")
    },
    toMusic() {
      this.$router.push("/music")
    }
  },
})
</script>

<style lang="scss" scoped>
.selection {
  display: inline-block;
  margin-left: 80px;
  margin-top: 80px;
  text-align: center;
  font-size: 0.9em;
  cursor: pointer;
}
.main {
  height: 100%;
  width: 100%;
}
</style>
