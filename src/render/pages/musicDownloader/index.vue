<template>
  <div class="main">
    <div class="mt-5 w-10/12 m-auto">
      <el-tabs v-model="tab">
        <el-tab-pane label="下载列表" name="list">
          <div class="task-list">
            <div class="task-item" v-for="item in sortTasks" :key="item.id">
              <div class="task-item__name">
                <span>{{ item.filename }} {{ item.artist ? `- ${item.artist}` : '' }}</span>
              </div>
              <div class="task-item__progress">
                <div :class="{ 'desc_error': item.log }" @click="item.log && $message.error(item.log)">{{ item.description }}</div>
              </div>
              <div class="task-item__action">
                <lucky-icon
                  v-if="item.status === TaskStatus.paused"
                  :hover="true"
                  :size="20"
                  icon="play"
                  class="task-item__action-btn"
                  @click="startDownload(item.id)"
                />
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
          <div class="text-center text-lg select-none cursor-pointer">新建下载任务</div>
        </div>
        <div class="create-panel__form">
          <div class="create-panel__form-field">
            <label>音乐id</label>
            <input type="text" spellcheck="false" v-model="taskForm.musicId"  class="pr-6" />
          </div>

          <div class="create-panel__form-field">
            <input type="radio" id="wy163" name="musictype" :value="MusicType.WY163" v-model="taskForm.type" checked/>
            <label for="wy163">网易云音乐</label>
          
            <input type="radio" id="qqmusic" name="musictype" :value="MusicType.QQMusic" v-model="taskForm.type" disabled/>
            <label for="qqmusic">QQ音乐</label>
          </div>

         

          <div class="create-panel__form-field">
            <label>网易云Cookie</label>
            <textarea
              rows="5"
              spellcheck="false"
              placeholder="[必填]"
              v-model="taskForm.wymusicCookie"
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
          <el-button type="primary" round @click="downloadVideo">创建</el-button>
        </el-row>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, computed } from "vue"
import { MusicDlerEvent } from "~/commons/eventbus"
import { MusicItem } from "~/commons/database/music-downloader"
import { musicDler as DB } from "~/commons/database"
import { TaskStatus, MusicType } from "~/main/music-downloader/typs"

interface MusicTaskBrief {
  id: string
  filename: string
  artists: Array<string>
  status: TaskStatus
  hasAudio: boolean
  hasAlbum: boolean
  logs: string[]
}

interface MusicTaskForm {
  musicId: string
  type: MusicType,
  dir: string
  qqmusicCookie: string
  wymusicCookie: string
  proxy: string
}

export default defineComponent({
  data() {
    return {
      tab: "list",
      createPanel: false,
      TaskStatus,
      MusicType,
    }
  },
  mounted() {
    this.$bus.emit(MusicDlerEvent.RecoverTasks)

    this.$bus.on(MusicDlerEvent.TaskIniting, (_, item: MusicTaskBrief) => {
      this.pushTask(item);
    });

    this.$bus.on(MusicDlerEvent.TaskInited, (_, item: MusicTaskBrief) => {
      this.pushTask(item);
      if (this.createPanel) {
        this.toggleCreatePanel()
        this.taskForm.musicId = ""
      }
    })

    this.$bus.on(MusicDlerEvent.TaskUpdated, (_, item: MusicTaskBrief) => {
      this.pushTask(item);
    })

    this.$bus.on(MusicDlerEvent.TaskStatusChanged, (_, id: string, status: TaskStatus) => {
      for (let task of this.tasks) {
        if (task.id === id) {
          const prevStatus = task.status
          const completeStatus = [TaskStatus.merged, TaskStatus.mergeFailed]
          task.status = status
          if (!completeStatus.includes(prevStatus) && completeStatus.includes(status)) {
            const readyTask = this.tasks.find(t => t.status == TaskStatus.paused);
            if (readyTask) {
              this.$bus.emit(MusicDlerEvent.TaskStarting, readyTask.id);
            }
          }
          break;
        }
      }
    })

    this.$bus.on(MusicDlerEvent.TaskDeleted, (_, id: string) => {
      const idx = this.tasks.findIndex((i) => i.id === id)
      if (idx !== -1) {
        this.tasks.splice(idx, 1)
      }
    })

    this.$bus.on(MusicDlerEvent.OpenPathSelectorEnd, (_, path: string, isDir: boolean) => {
      if (isDir) {
        this.taskForm.dir = path;
      } else {
        // this.taskForm.url = path;
      }
    })

    this.$bus.on(MusicDlerEvent.Error, (_, id: string, error: Record<string, string>) => {
      const task = this.tasks.find(t => t.id == id);
      const log = Object.keys(error).map(k => `${k}=${error[k]}`).join('|')
      if (task) {
        task.logs.push(log)
      } else {
        this.$message.error(log)
      }
    })

    // this.$bus.on(MusicDlerEvent.GetClipboardDataCallback, (_, data: string) => {
    //   const arr: string[] = data.split('\n').map(item => item.replace(/\r|\n/g, ''))
    //   arr.forEach( item => {
    //     const match = item.match(/([\s\S]*?):([\s\S]*)$/)
    //     if (!match) return;
    //     const key = match[1].trim();
    //     const value = match[2].trim();
    //     console.log('gajonchen', key, value)
    //     if (!value) return;
    //     switch (key) {
    //       case 'url':
    //         this.taskForm.url = value;
    //         break;
    //       case 'name':
    //         this.taskForm.name = value;
    //         break;
    //       case 'referer':
    //         this.taskForm.headers = `referer:${value}`;
    //     }
    //   })
    // })
  },
  setup() {
    const tasks: MusicTaskBrief[] = reactive([])

    const taskForm: MusicTaskForm = reactive({
      musicId: "",
      type: MusicType.WY163,
      dir: "",
      qqmusicCookie: '',
      wymusicCookie: "",
      proxy: "",
    })
    console.log('gajonchen taskFrom', taskForm, MusicType)

    const sortTasks = computed(() => {
      return tasks
        .map((t) => {
          let description = '';
          description += `封面：${t.hasAlbum ? '✅' : '❎'} `
          description += `音频：${t.hasAudio ? '✅' : '❎'} `
                    
          switch (t.status) {
            case TaskStatus.merging:
              description += "合并中..."
              break
            case TaskStatus.merged:
              description += "任务完成"
              break
            case TaskStatus.mergeFailed:
              description += "合并失败，具体看日志"
              break
          }

          return {
            id: t.id,
            filename: t.filename,
            artist: t.artists.join('/'),
            status: t.status,
            description: description,
            log: t.logs.join('\n'),
          }
        })
    })

    return { tasks, taskForm, sortTasks }
  },
  methods: {
    pushTask(task: MusicTaskBrief) {
      task.logs = task.logs || []
      const existIdx = this.tasks.findIndex(t => t.id == task.id);
      if (existIdx == -1) {
        this.tasks.push(reactive(task));
      } else {
        this.tasks.splice(existIdx, 1, reactive(task));
      }
    },
    toggleCreatePanel() {
      this.createPanel = !this.createPanel
    },
    startDownload(id: string) {
      this.$bus.emit(MusicDlerEvent.TaskStarting, id)
    },
    stopDownload(id: string) {
      this.$bus.emit(MusicDlerEvent.TaskStoping, id)
    },
    selectFile() {
      this.$bus.emit(MusicDlerEvent.OpenPathSelector, false);
    },
    selectDirctor() {
      this.$bus.emit(MusicDlerEvent.OpenPathSelector, true);
    },
    downloadVideo() {
      const { musicId, type, dir, wymusicCookie, qqmusicCookie, proxy, } = this.taskForm

      if (!musicId) {
        this.$message.error("音乐id为必填项")
        return
      }
      if (!dir) {
        this.$message.error("下载目录为必填项")
        return
      }

      if (type == MusicType.WY163 && !wymusicCookie.trim()) {
        this.$message.error("网易云Cookie为必填项")
        return
      }

      const info: Partial<MusicItem> = {
        musicId: musicId.trim(),
        type,
        dir,
      }

      if (proxy) {
        let tProxy; 
        if (proxy.includes(':')) {
          tProxy = proxy.trim().split(":")
        } else {
          tProxy = ['127.0.0.1', proxy.trim()]
        }
        if (tProxy.length < 2) {
          this.$message.error("代理格式错误")
          return
        }
        info.proxy = {
          host: tProxy[0],
          port: +tProxy[1],
        }
      }

      if (type == MusicType.WY163) {
        info.headers = {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'origin': 'https://music.163.com',
          'referer':  'https://music.163.com/',
        };
        
        info.headers['cookie'] = wymusicCookie.trim();
      }

      this.$bus.emit(MusicDlerEvent.AudioTaskCreate, info)
    },

    deleteTask(id: string) {
      this.$bus.emit(MusicDlerEvent.TaskDeleting, id)
    },
    // checkClipboard() {
    //   this.$bus.emit(MusicDlerEvent.GetClipboardData)
    // }
  },
})
</script>

<style lang="scss" scoped>
@import "@/assets/css/function.scss";

.main {
  width: 100%;
  height: 100%;
  overflow-y: auto;
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
    width: 55%;
    min-width: 150px;

    @include trim;
    @include vertical-middle;
  }

  &__progress {
    width: 30%;
    min-width: 240px;
    margin-left: 10px;
    margin-right: 10px;
    display: flex;
    align-items: center;

    .desc_error {
      color: red;
    }
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
//  background-size: 10%;
//  background-repeat: repeat-x;
//  background-image: url(https://0.z.wiki/autoupload/20240713/TL41/1211X1505/baby.png?type=ha);
//  background-position: 50% 100%;
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

      input[type=radio] {
        width: auto;
        margin-right: 16px;
      }

      label[for] {
        user-select: none;
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
