<template>
  <img v-if="url" :src="url" :style="style" />
</template>

<script lang="ts">
import iconMap from "./map"
import { computed, defineComponent, isReactive, isReadonly, ref, isRef, toRef } from "vue"
export default defineComponent({
  props: {
    icon: String,
    size: Number,
    hover: Boolean,
  },
  setup(props) {
    let url = ref()
    if (props.icon && iconMap[props.icon]) {
      if (typeof iconMap[props.icon].then === "function") {
        iconMap[props.icon].then((res: any) => {
          url.value = res.default
        })
      } else {
        url = iconMap[props.icon]
      }
    }

    let width = "40px"
    if (props.size) {
      width = `${props.size}px`
    }

    let style: {
      width: string
      cursor?: string
    } = {
      width,
    }

    if (props.hover) {
      style["cursor"] = "pointer"
    }

    return { url, style }
  },
})
</script>
