<template>
  <div class="flex h-full">
    <div class="aside bg-gray-600 flex justify-between flex-col">
      <div class="top flex justify-center">
        <el-button type="text" icon="el-icon-s-home" class="aside__btn" @click="goHome"></el-button>
      </div>
      <div class="bottom flex justify-center">
        <!-- <i class="el-icon-setting w-1/2z"></i> -->
        <el-button type="text" icon="el-icon-setting" class="aside__btn"></el-button>
      </div>
    </div>
    <div class="flex-grow overflow-hidden relative content">
      <router-view v-slot="{ Component, route }">
        <transition :name="route.meta.transitionName">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue"

export default defineComponent({
  name: "App",
  components: {},
  methods: {
    goHome() {
      this.$router.replace("/")
    },
  },
})
</script>

<style lang="scss" scoped>
.aside {
  flex-basis: 65px;

  &__btn {
    font-size: 1.6rem;
  }
}

.content {
  background: linear-gradient(rgb(217, 226, 233), white 70%);
}
</style>
