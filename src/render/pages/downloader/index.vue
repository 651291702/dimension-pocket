<template>
  <div class="main">
    <div class="mt-5 w-10/12 m-auto">
      <el-tabs v-model="tab">
        <el-tab-pane label="下载列表" name="list">
          <div class="task-list">
            <div class="task-item" v-for="item in sortTasks" :key="item.id">
              <div class="task-item__name">
                <span>{{ item.filename }}</span>
              </div>
              <div class="task-item__progress">
                <div>{{ item.description }}</div>
                <el-progress
                  :text-inside="true"
                  :stroke-width="20"
                  :percentage="item.perc"
                  :status="(item.perc >= 100 && 'success') || ''"
                ></el-progress>
              </div>
              <div class="task-item__action">
                <template v-if="item.perc < 100">
                  <lucky-icon
                    v-if="item.status === TaskStatus.paused"
                    :hover="true"
                    :size="20"
                    icon="play"
                    class="task-item__action-btn"
                    @click="startDownload(item.id)"
                  />
                  <lucky-icon
                    v-else-if="item.status === TaskStatus.started"
                    icon="pause"
                    :hover="true"
                    :size="20"
                    class="task-item__action-btn"
                    @click="stopDownload(item.id)"
                  />
                </template>
                <lucky-icon
                  icon="delete"
                  :size="20"
                  :hover="true"
                  class="task-item__action-btn"
                  @click="deleteTask(item.id)"
                />
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    <button class="create" @click="toggleCreatePanel">
      <lucky-icon :hover="true" icon="create" />
    </button>
    <transition name="slider">
      <div class="create-panel" v-if="createPanel">
        <div class="create-panel__header">
          <el-button
            type="text"
            icon="el-icon-arrow-down"
            class="text-2xl ml-8 absolute left-0"
            @click="toggleCreatePanel"
          />
          <div class="text-center text-lg">新建下载任务</div>
        </div>
        <div class="create-panel__form">
          <div class="create-panel__form-field">
            <label>视频URI</label>
            <input type="text" spellcheck="false" v-model="taskForm.url" placeholder="支持本地/网络资源" class="pr-6" />
            <el-button type="text" icon="el-icon-upload2" @click="selectFile" />
          </div>
          <div class="create-panel__form-field">
            <label>文件名</label>
            <input type="text" spellcheck="false" v-model="taskForm.name" placeholder="[选填]默认使用时间戳" />
          </div>

          <div class="create-panel__form-field">
            <label>M3U8前缀</label>
            <input
              type="text"
              spellcheck="false"
              v-model="taskForm.prefix"
              placeholder="[选填]M3U8 Segmeng URI前缀, e.g. http://xxx.com/a120"
            />
          </div>

          <div class="create-panel__form-field">
            <label>请求Header</label>
            <textarea
              rows="5"
              spellcheck="false"
              placeholder="[选填]一对header一行，格式：key:value&#10;refer: http://baidu.com"
              v-model="taskForm.headers"
            ></textarea>
          </div>

          <div class="create-panel__form-field">
            <label>代理</label>
            <input type="text" v-model="taskForm.proxy" placeholder="[选填]仅支持HTTP协议，格式ip:port" />
          </div>

          <div class="create-panel__form-field">
            <label>下载至</label>
            <input type="text" spellcheck="false" v-model="taskForm.dir" class="cursor-not-allowed pr-6" disabled />
            <el-button type="text" icon="el-icon-upload2" @click="selectDirctor" />
          </div>
        </div>
        <el-row class="flex justify-center mt-20">
          <el-button round>创建</el-button>
          <el-button type="primary" round @click="downloadVideo">下载</el-button>
        </el-row>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Dialog } from "electron"
import { defineComponent, reactive, ref, computed } from "vue"
import { getEleModule } from "~/commons/util"
import { VideoDLerEvent } from "~/commons/eventbus"
import { VideoItem } from "~/commons/database/video-downloader"
import { videoDler as DB } from "~/commons/database"
import { TaskStatus, TaskSegStatus } from "~/main/video-downloader/typs"

const dialog: Dialog = getEleModule("dialog")

interface VideoTaskBrief {
  id: string
  filename: string
  segs: TaskSegStatus[]
  status: TaskStatus
  segLen: number
}

interface VideoTaskForm {
  url: string
  name: string
  dir: string
  prefix: string
  headers: string
  proxy: string
}

export default defineComponent({
  data() {
    return {
      tab: "list",
      createPanel: false,
      TaskStatus,
    }
  },
  mounted() {
    ;(window as any).db = DB
    ;(window as any).k = this
    this.$bus.emit(VideoDLerEvent.RecoverTasks)

    this.$bus.on(VideoDLerEvent.TaskInited, (_, item: VideoTaskBrief) => {
      this.tasks.push(reactive(item))
      if (this.createPanel) {
        this.toggleCreatePanel()
      }
    })

    this.$bus.on(VideoDLerEvent.TaskUpdated, (_, id: string, segs: TaskSegStatus[]) => {
      for (let task of this.tasks) {
        if (task.id === id) {
          task.segs = segs
          return
        }
      }
    })

    this.$bus.on(VideoDLerEvent.TaskStatusChanged, (_, id: string, status: TaskStatus) => {
      for (let task of this.tasks) {
        if (task.id === id) {
          task.status = status
        }
      }
    })

    this.$bus.on(VideoDLerEvent.TaskDeleted, (_, id: string) => {
      const idx = this.tasks.findIndex((i) => i.id === id)
      if (idx !== -1) {
        this.tasks.splice(idx, 1)
      }
    })
  },
  setup() {
    const tasks: VideoTaskBrief[] = reactive([])

    const taskForm: VideoTaskForm = reactive({
      url: "",
      name: "",
      dir: "",
      prefix: "",
      headers: "",
      proxy: "",
    })

    const sortTasks = computed(() => {
      return tasks
        .map((t) => {
          let loadedSegs = t.segs.filter((i) => i === TaskSegStatus.downloaded)
          let description
          switch (t.status) {
            case TaskStatus.merging:
              description = "合并中..."
              break
            case TaskStatus.merged:
              description = "任务完成"
              break
            default:
              description = `片段 ${loadedSegs.length} / ${t.segLen}`
              break
          }

          return {
            id: t.id,
            filename: t.filename,
            status: t.status,
            perc: +((loadedSegs.length * 100) / t.segLen).toFixed(2),
            description: description,
          }
        })
        .sort((left, right) => left.perc - right.perc)
    })

    return { tasks, taskForm, sortTasks }
  },
  methods: {
    toggleCreatePanel() {
      this.createPanel = !this.createPanel
    },
    startDownload(id: string) {
      this.$bus.emit(VideoDLerEvent.TaskStarting, id)
    },
    stopDownload(id: string) {
      this.$bus.emit(VideoDLerEvent.TaskStoping, id)
    },
    selectFile() {
      dialog
        .showOpenDialog({
          properties: ["openFile"],
        })
        .then((info) => {
          if (!info.filePaths || info.filePaths.length === 0) return
          this.taskForm.url = info.filePaths[0]
        })
    },
    selectDirctor() {
      dialog
        .showOpenDialog({
          properties: ["openDirectory"],
        })
        .then((info) => {
          if (!info.filePaths || info.filePaths.length === 0) return
          this.taskForm.dir = info.filePaths[0]
        })
    },
    downloadVideo() {
      const { url, dir, name, headers, prefix, proxy } = this.taskForm

      if (!url) {
        this.$message.error("资源链接为必填项")
        return
      }
      if (!dir) {
        this.$message.error("下载目录为必填项")
        return
      }

      const info: Partial<VideoItem> = {
        name: name || new Date().getTime().toString(),
        url,
        dir,
      }

      if (proxy) {
        let tProxy = proxy.trim().split(":")
        if (tProxy.length < 2) {
          this.$message.error("代理格式错误")
          return
        }
        info.proxy = {
          host: tProxy[0],
          port: +tProxy[1],
        }
      }

      if (headers) {
        let tHeaders = headers.match(/(.*?): ?(.*?)(\n|\r|$)/g)
        info.headers = {}
        tHeaders?.forEach((_) => {
          const __ = _.match(/(.*?): ?(.*?)(\n|\r|$)/i)
          if (info.headers && __ && __[1] && __[2]) {
            info.headers[__[1]] = __[2]
          }
        })
      }

      if (prefix) {
        info.prefix = prefix
      }

      this.$bus.emit(VideoDLerEvent.ManifestLoading, info)
    },

    deleteTask(id: string) {
      this.$bus.emit(VideoDLerEvent.TaskDeleting, id)
    },
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

.create {
  width: 40px;
  height: 40px;
  position: absolute;
  bottom: 40px;
  right: 40px;
  box-shadow: 2px 2px rgb(217, 226, 233), -2px 2px rgb(217, 226, 233), 2px -2px rgb(217, 226, 233),
    -2px -2px rgb(217, 226, 233);
  border-radius: 50%;
}

.create-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgb(241 249 255);
  z-index: 100;

  &__header {
    height: 50px;
    display: flex;
    align-items: center;
    position: relative;
    justify-content: center;
  }

  &__form {
    width: 60%;
    margin: 25px auto auto;

    &-field {
      min-height: 35px;
      position: relative;
      margin-bottom: 25px;

      label {
        display: inline-block;
        width: 100px;
        text-align: justify;
        height: 35px;
        line-height: 35px;
        margin-right: 40px;
        vertical-align: middle;

        &::after {
          content: "";
          width: 100%;
          display: inline-block;
        }
      }

      input {
        vertical-align: middle;
        height: 30px;
        outline: none;
        background: transparent;
        border: 0;
        border-bottom: 2px solid;
        border-bottom-color: gray;
        transition: all 0.5s linear;
        width: calc(100% - 145px);
        padding-left: 5px;

        &:focus {
          border-bottom-color: #71e6b5;
        }
      }

      textarea {
        vertical-align: top;
        width: calc(100% - 145px);
        background: transparent;
        outline: 0;
        border: 2px solid gray;
        transition: border-color 0.5s linear;
        border-radius: 5px;
        padding-left: 5px;

        &:focus {
          border-color: #71e6b5;
        }
      }

      button {
        position: absolute;
        font-size: 18px;
        right: 5px;
        top: -5px;
      }
    }
  }
}

// animation
.slider {
  &-enter-from {
    transform: translateY(100%);
    opacity: 0.3;
  }

  &-enter-active,
  &-leave-active {
    transition: transform 0.5s ease, opacity 0.5s ease;
  }

  &-enter-to {
    transform: translateY(0);
    opacity: 1;
  }

  &-leave-to {
    transform: translateY(50%);
    opacity: 0;
  }

  &-leave-from {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
