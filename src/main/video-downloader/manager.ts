import got from "got"
import EventBus, { VideoDLerEvent } from "~/commons/eventbus"
import { download, generateProxy, generateHeaders } from "~/commons/request"
import { buildAbsoluteURL } from "url-toolkit"
// @ts-ignore
import { Parser } from "m3u8-parser"
import { VideoItem } from "~/commons/database/video-downloader"
import { findByUrl, create, updateSegLen, updateSeg, findAll, remove, updateMergeFlag } from "./model"
import { join } from "path"
import { createDir } from "~/commons/util"
import Joiner from "./ts-merge"
import { TaskStatus, TaskSegStatus } from "./typs"
import { createLogger } from "~/main/logger"

const logger = createLogger("video-manager.ts")

type Segment = {
  duration: number
  uri: string
  [key: string]: number | string
}

export default class DownloaderManager {
  private bus: EventBus
  private tasks: Task[]
  private registed: boolean // 注册过所有任务
  constructor(bus: EventBus) {
    this.bus = bus
    this.tasks = []
    this.registed = false
    bus.on(VideoDLerEvent.ManifestLoading, async function (_, info: VideoItem) {
      let oriVideo = await findByUrl(info.url)
      if (!oriVideo) {
        oriVideo = await create({
          ...info,
          segs: [],
          merge: false,
        })
      }

      //  100%完成
      if (oriVideo.totalSegs && oriVideo.segs.length === oriVideo.totalSegs) {
        bus.emit(VideoDLerEvent.ManifestLoaded, oriVideo, [])
        return
      }

      const m3u8Text = await got.get(info.url).text()

      const parser = new Parser()
      parser.push(m3u8Text)
      parser.end()

      const segments = parser.manifest.segments || []

      await updateSegLen(oriVideo._id, segments.length)

      oriVideo = await findByUrl(info.url)

      bus.emit(VideoDLerEvent.ManifestLoaded, oriVideo, segments)
    })

    bus.on(VideoDLerEvent.ManifestLoaded, async (_, info: VideoItem & { _id: string }, segs: Segment[]) => {
      const task = new Task(this.bus, info._id, info, segs)
      this.tasks.push(task)
    })

    bus.on(VideoDLerEvent.TaskStarting, (_, _id: string) => {
      for (let task of this.tasks) {
        if (task.id === _id) {
          task.start()
          break
        }
      }
    })

    bus.on(VideoDLerEvent.TaskStoping, (_, _id: string) => {
      for (let task of this.tasks) {
        if (task.id === _id) {
          task.stop()
          break
        }
      }
    })

    bus.on(VideoDLerEvent.RecoverTasks, async () => {
      if (!this.registed) {
        const videos = await findAll()
        videos.forEach((video) => {
          this.bus.emit(VideoDLerEvent.ManifestLoading, video)
        })
        this.registed = true
      } else {
        this.tasks.forEach((task) => {
          task.emitTaskInfo()
        })
      }
    })

    bus.on(VideoDLerEvent.TaskDeleting, async (_, _id: string) => {
      const idx = this.tasks.findIndex((task) => task.id === _id)
      if (idx === -1) return
      const task = this.tasks[idx]
      task.destory()
      await remove(_id)
      this.tasks.splice(idx, 1)
      this.bus.emit(VideoDLerEvent.TaskDeleted, _id)
    })
  }
}

const DefaultTryCount = 5

class Task {
  private video: VideoItem
  public id: string
  private segs: TaskSegStatus[] // 片段下载片段
  private tryCountSegs: number[]
  private segments: Segment[] // M3U8 segment 元数据
  private segLen: number
  private options: any
  private dir: string
  private bus: EventBus
  private status: TaskStatus
  private thread: number
  private stopThread: number
  private joiner: Joiner
  constructor(bus: EventBus, id: string, video: VideoItem, segments: Segment[]) {
    this.id = id
    this.bus = bus
    this.video = video
    this.segments = segments
    this.segLen = video.totalSegs || 0
    this.segs = []
    this.options = {}
    this.thread = 5
    this.stopThread = 0
    this.joiner = new Joiner(video.dir, video.name, this.segLen)
    this.tryCountSegs = Array(this.segLen).fill(0)

    if (video.merge) {
      this.status = TaskStatus.merged
    } else if (video.segs.length === this.segLen) {
      this.status = TaskStatus.merging
      this.mergeFragments()
    } else {
      this.status = TaskStatus.paused
    }

    video.segs.forEach((idx) => {
      this.segs[idx] = TaskSegStatus.downloaded
    })
    for (let i = 0; i < this.segLen; i++) {
      if (!this.segs[i]) {
        this.segs[i] = TaskSegStatus.idel
      }
    }

    if (video.proxy) {
      generateProxy(this.options, video.proxy)
    }

    if (video.headers) {
      generateHeaders(this.options, video.headers)
    }

    this.dir = join(video.dir, video.name)

    this.emitTaskInfo()
  }

  emitTaskInfo() {
    this.bus.emit(VideoDLerEvent.TaskInited, {
      id: this.id,
      filename: this.video.name,
      segLen: this.video.totalSegs,
      segs: this.segs,
      status: this.status,
    })
  }

  async mergeFragments() {
    if (this.segLen > 0) {
      await this.joiner.start()
      updateMergeFlag(this.id)
      this.status = TaskStatus.merged
      this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
    }
  }

  start() {
    if (this.status !== TaskStatus.paused) return
    this.status = TaskStatus.started
    createDir(this.dir)

    this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)

    this.stopThread = 0
    for (let i = 0; i < this.thread; i++) {
      this.threadDownload()
    }
  }

  stop() {
    if (this.status !== TaskStatus.started) return
    this.status = TaskStatus.paused

    this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  }

  /**
   * 当前线程完成、结束判断是否所有线程已经都结束了
   */
  threadUpdate() {
    this.stopThread++
    if (this.stopThread !== this.thread) return

    const loadedSegs = this.segs.filter((i) => i === TaskSegStatus.downloaded)

    if (loadedSegs.length === this.segLen) {
      this.status = TaskStatus.merging
      this.mergeFragments()

      this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
    } else if (this.status !== TaskStatus.paused) {
      this.status = TaskStatus.paused
      this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
    }
  }

  async threadDownload(from: number = 0) {
    if (this.status !== TaskStatus.started) {
      this.threadUpdate()
      return
    }
    const idx = this.findAvailable(from)
    if (idx === -1) {
      this.threadUpdate()
      return
    }

    logger.info(`downloading ${this.video.name} with index ${idx}`)

    this.segs[idx] = TaskSegStatus.downloading
    this.bus.emit(VideoDLerEvent.TaskUpdated, this.id, this.segs)

    let error = false
    await this.download(idx).catch((err) => {
      logger.error(`download ${this.video.name} with index ${idx} failed`, err)
      this.tryCountSegs[idx]++
      this.segs[idx] = TaskSegStatus.idel
      error = true
    })

    if (error) {
      if (this.tryCountSegs[idx] > DefaultTryCount) {
        this.threadUpdate()
      } else {
        this.threadDownload(idx)
      }
    } else {
      this.segs[idx] = TaskSegStatus.downloaded
      this.bus.emit(VideoDLerEvent.TaskUpdated, this.id, this.segs)

      updateSeg(this.video.url, idx)

      this.threadDownload(idx + 1)
    }
  }

  findAvailable(from: number = 0) {
    let i = from
    while (i < this.segLen) {
      if (this.segs[i] === TaskSegStatus.idel) {
        return i
      }
      i++
    }
    return -1
  }

  /**
   * 下載某個片段
   */
  async download(idx: number) {
    const segment = this.segments[idx]
    const baseurl = this.video.prefix || this.video.url
    const url = buildAbsoluteURL(baseurl, segment.uri)
    await download(url, this.dir, `${idx}.ts`, this.options)
  }

  destory() {
    this.stop()
    this.joiner.destory()
  }
}
