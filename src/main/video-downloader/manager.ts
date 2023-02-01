import got from "got"
import EventBus, { VideoDLerEvent } from "~/commons/eventbus"
import { download, get, generateProxy, generateHeaders } from "~/commons/request"
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
import { createDecipheriv } from "crypto"
import { readFileSync, accessSync, constants, rmdirSync } from "fs"

const logger = createLogger("main/video-manager")

const NetUrlRex = /^http/

type Segment = {
  duration: number
  uri: string
  key?: {
    method: string
    uri: string
    iv?: Uint32Array
  }
  [key: string]: number | string | any
}

function generateRequestOption(video: VideoItem) {
  const opt = {}
  if (video.proxy) {
    generateProxy(opt, video.proxy)
  }

  if (video.headers) {
    generateHeaders(opt, video.headers)
  }

  return opt
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
      logger.info('create task', info, oriVideo);
      //  100%完成
      if (oriVideo.totalSegs && oriVideo.segs.length === oriVideo.totalSegs) {
        bus.emit(VideoDLerEvent.ManifestLoaded, oriVideo, [])
        return
      }

      let m3u8Text

      if (info.url.match(NetUrlRex)) {
        logger.info('request m3u8 text with opt', generateRequestOption(oriVideo));
        m3u8Text = await get(info.url, generateRequestOption(oriVideo)).text()
      } else {
        m3u8Text = readFileSync(info.url, "utf8")
      }

      const parser = new Parser()
      parser.push(m3u8Text)
      parser.end()

      let segments: Segment[] = parser.manifest.segments || []

      segments = segments.filter((seg, idx) => {
        const baseurl = getBaseUrl(oriVideo)
        const url = buildAbsoluteURL(baseurl, seg.uri)
        if (url.match(NetUrlRex)) {
          return true
        } else {
          logger.error(`Video ${oriVideo.name} segment No.${idx} url is invalid`)
          return false
        }
      })

      await updateSegLen(oriVideo._id, segments.length)

      oriVideo = await findByUrl(info.url)

      bus.emit(VideoDLerEvent.ManifestLoaded, oriVideo, segments)
    })

    bus.on(VideoDLerEvent.ManifestLoaded, async (_, info: VideoItem & { _id: string }, segs: Segment[]) => {
      const task = new Task(this.bus, info._id, info, segs)
      this.tasks.push(task)
    })

    bus.on(VideoDLerEvent.TaskStarting, (_, _id: string) => {
      for (const task of this.tasks) {
        if (task.id === _id) {
          task.start()
          break
        }
      }
    })

    bus.on(VideoDLerEvent.TaskStoping, (_, _id: string) => {
      for (const task of this.tasks) {
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

function getBaseUrl(video: VideoItem) {
  if (video.prefix) {
    return video.prefix
  }
  if (video.url.match(NetUrlRex)) {
    return video.url
  }
  return ""
}

/**
 * Return a hex buffer
 */
function normalizateKey(key: Buffer) {
  if (key.byteLength === 16) {
    return key
  }

  // 其余情况假设key为编码为utf8的 hex string

  return Buffer.from(key.toString("utf8").padStart(32, "0"), "hex")
}

function normalizateIv(v: Uint32Array | number | string) {
  let result
  if (typeof v === "number") {
    result = Buffer.from(v.toString().padStart(32, "0"), "hex")
  } else if (typeof v === "string") {
    result = Buffer.from(v.padStart(32, "0"), "hex")
  } else {
    result = Buffer.from(v.buffer)
  }

  return result
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
  /**
   * 视频解密
   */
  private encode: boolean
  private waitKey: boolean
  private _key?: Buffer

  constructor(bus: EventBus, id: string, video: VideoItem, segments: Segment[]) {
    this.id = id
    this.bus = bus
    this.video = video
    this.segments = segments
    this.segLen = video.totalSegs || 0
    this.segs = []
    this.options = generateRequestOption(video)
    this.thread = video.thread || 20
    this.stopThread = 0
    this.encode = false
    this.waitKey = false
    this.joiner = new Joiner(video.dir, video.name, this.segLen)
    this.tryCountSegs = Array(this.segLen).fill(0)
    this.dir = join(video.dir, video.name)

    if (video.merge) {
      this.status = TaskStatus.merged
    } else if (video.segs.length === this.segLen) {
      this.status = TaskStatus.merging
      this.mergeFragments()
    } else {
      this.status = TaskStatus.paused
    }

    const keyInfo = segments[0] && segments[0].key
    if (keyInfo && keyInfo.uri) {
      this.encode = true
      this.getKey(keyInfo.uri).then((key) => {
        this.key = key
      })
    }

    video.segs.forEach((idx) => {
      this.segs[idx] = TaskSegStatus.downloaded
    })
    for (let i = 0; i < this.segLen; i++) {
      if (!this.segs[i]) {
        this.segs[i] = TaskSegStatus.idel
      }
    }

    this.emitTaskInfo()
  }

  async getKey(uri: string) {
    const baseurl = getBaseUrl(this.video)
    const url = buildAbsoluteURL(baseurl, uri)
    if (!url.match(NetUrlRex)) {
      logger.error(`Get video ${this.video.name} encrty key failed And the url is ${url}`)
      throw new Error("Url Valid")
    }
    return get(url, this.options)
      .buffer()
      .then((buff) => normalizateKey(buff))
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
      await this.joiner
        .start()
        .then(() => {
          try {
            accessSync(this.dir, constants.F_OK)
            rmdirSync(this.dir, { recursive: true, })
          } catch (e) {
            logger.info(`Merge fragments failed `, e);
          }
          updateMergeFlag(this.id)
          this.status = TaskStatus.merged
          this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
        })
        .catch(() => {
          this.status = TaskStatus.mergeFailed
          this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
        })
    }
  }

  start() {
    if (this.status !== TaskStatus.paused) return
    // 等待key下载
    if (this.encode && !this.key) {
      this.waitKey = true
      return
    }

    this.status = TaskStatus.started
    createDir(this.dir)

    this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)

    this.stopThread = 0
    this.bus.emit(VideoDLerEvent.ThreadUpdate, this.id, this.thread);
    for (let i = 0; i < this.thread; i++) {
      this.threadDownload()
    }
  }

  stop() {
    if (this.status !== TaskStatus.started) return
    this.stopThread =  this.thread;
    this.bus.emit(VideoDLerEvent.ThreadUpdate, this.id, 0);
    this.status = TaskStatus.paused

    this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  }

  /**
   * 当前线程完成、结束判断是否所有线程已经都结束了
   */
  threadUpdate() {
    this.stopThread++
    this.bus.emit(VideoDLerEvent.ThreadUpdate, this.id, this.thread - this.stopThread);
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

  async threadDownload(from = 0) {
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
    await this.downloadSeg(idx).catch((err) => {
      logger.error(`download ${this.video.name} with index ${idx} failed`)
      logger.error(err)
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

  findAvailable(from = 0) {
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
  async downloadSeg(idx: number) {
    const segment = this.segments[idx]
    const baseurl = getBaseUrl(this.video)
    const url = buildAbsoluteURL(baseurl, segment.uri)
    if (!this.encode) {
      await download(url, this.dir, `${idx}.ts`, this.options)
    } else {
      const iv = normalizateIv(segment.key?.iv || idx)
      const algorithm = `${segment.key?.method}-cbc`.toLowerCase()
      const cipher = createDecipheriv(algorithm, this.key as Buffer, iv)
      await download(url, this.dir, `${idx}.ts`, this.options, cipher)
    }
  }

  destory() {
    this.stop()
    this.joiner.destory()
  }

  set key(k: Buffer | undefined) {
    this._key = k
    if (this.waitKey) {
      this.waitKey = false
      this.start()
    }
  }

  get key() {
    return this._key
  }
}
