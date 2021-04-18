<template>
  <div class="main">
    <div class="selection" title="支持HLS协议" @click="toDownloader">
      <lucky-icon icon="video-downloader" :size="80"></lucky-icon>
      <span>视频下载器</span>
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
  },
})
</script>

<style lang="scss" scoped>
.selection {
  display: inline-block;
  margin-left: 20px;
  margin-top: 20px;
  text-align: center;
  font-size: 0.9em;
  cursor: pointer;
}
.main {
  height: 100%;
  width: 100%;
}
</style>
