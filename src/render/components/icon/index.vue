<template>
  <img v-if="url" :src="url" :style="style" />
</template>

<script>
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
    if (iconMap[props.icon]) {
      if (typeof iconMap[props.icon].then === "function") {
        iconMap[props.icon].then((res) => {
          url.value = res.default
        })
      } else {
        url = iconMap[props.icon]
      }
    }

    let style = {
      width: `${props.size || 40}px`,
    }

    if (props.hover) {
      style["cursor"] = "pointer"
    }

    return { url, style }
  },
})
</script>
