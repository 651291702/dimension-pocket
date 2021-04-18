<template>
  <div class="main">
    <div class="mt-5 w-10/12 m-auto">
      <el-tabs v-model="tab">
        <el-tab-pane label="下载列表" name="list">
          <div class="task-list">
            <div class="task-item" v-for="item in tasks" :key="item.id">
              <div class="task-item__name">
                <span>{{ item.filename }}</span>
              </div>
              <el-progress
                class="task-item__progress"
                :text-inside="true"
                :stroke-width="20"
                :percentage="item.progress"
                :status="(item.progress >= 100 && 'success') || ''"
              ></el-progress>
              <div class="task-item__action">
                <template v-if="item.progress < 100">
                  <lucky-icon
                    v-if="item.status === 'pause'"
                    :hover="true"
                    :size="20"
                    icon="play"
                    class="task-item__action-btn"
                  />
                  <lucky-icon v-else icon="pause" :hover="true" :size="20" class="task-item__action-btn" />
                </template>
                <lucky-icon icon="delete" :size="20" :hover="true" class="task-item__action-btn" />
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive } from "vue"

type VideoTaskStatus = "downloading" | "pause"

interface VideoTaskBrief {
  id: String
  filename: String
  progress: Number
  status: VideoTaskStatus
}

export default defineComponent({
  data() {
    return {
      tab: "list",
    }
  },
  setup() {
    const tasks: VideoTaskBrief[] = reactive([
      {
        id: "laskd;jfa;slfj",
        filename: "hello",
        progress: 10,
        status: "downloading",
      },
    ])

    return { tasks }
  },
})
</script>

<style lang="scss" scoped>
@import "@/assets/css/function.scss";

.main {
  width: 100%;
  height: 100%;
}
.task-item {
  display: flex;
  height: 55px;
  padding: 0 10px;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.5s linear;

  &:hover {
    background: rgb(217, 226, 233);
  }

  &__name {
    width: 20%;
    min-width: 150px;

    @include trim;
    @include vertical-middle;
  }

  &__progress {
    width: 50%;
    margin-left: 20px;
    margin-right: 20px;

    @include vertical-middle;
  }

  &__action {
    margin-left: auto;
    display: flex;
    align-items: center;

    &-btn {
      margin-right: 10px;
    }

    &-btn:last-child {
      margin-right: 0;
    }
  }
}
</style>
