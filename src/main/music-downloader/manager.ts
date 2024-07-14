import EventBus, { MusicDlerEvent } from "~/commons/eventbus"
import { download,  generateProxy, generateHeaders } from "~/commons/request"
// @ts-ignore
import { MusicItem } from "~/commons/database/music-downloader"
import { findByMusicId, create, findAll, remove, updateFlagTrue, updateNameArtists, } from "./model"
import { join } from "path"
import { createDir, handleReqeustError, } from "~/commons/util"
import Joiner from "./joiner"
import { TaskStatus } from "./typs"
import { createLogger } from "~/main/logger"
import { readFileSync, accessSync, constants, rmdirSync } from "fs"
import { getEleModule } from "~/commons/util"
import { Dialog, clipboard } from "electron"
import wyMusicRequest from './wyMusicRequest';

const logger = createLogger("main/music-manager")


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

function generateRequestOption(video: MusicItem) {
  const opt = {}
  if (video.proxy) {
    generateProxy(opt, video.proxy)
  }

  if (video.headers) {
    generateHeaders(opt, video.headers)
  }

  (opt as any).timeout = 30 * 1000

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
    bus.on(MusicDlerEvent.AudioTaskCreate, async (_, info: MusicItem) => {
      let oriMusic = await findByMusicId(info.musicId, info.type)
      if (!oriMusic) {
        oriMusic = await create({
          ...info,
          merge: false,
        })
      }
      
      logger.info("create task", info, oriMusic)

      if (!oriMusic.name) {
        const data = await wyMusicRequest.getSongDetail(info.musicId).catch(err => {
          const error = handleReqeustError(err);
          bus.emit(MusicDlerEvent.Error, oriMusic._id, error);
          logger.error(`Music ${oriMusic.musicId}-${oriMusic.type} detail get failed`);
          return {
            name: '',
            artists: [],
            pic: '',
          }
        });

        if (!data.name) return;
        info.name = data.name;
        info.artists = data.artists;
        updateNameArtists(oriMusic._id, data.name, data.artists);
      }

      const task = new Task(bus, oriMusic._id, info)
      
      this.tasks.push(task);
    })

    bus.on(MusicDlerEvent.TaskStarting, (_, _id: string) => {
      for (const task of this.tasks) {
        if (task.id === _id) {
          task.start()
          break
        }
      }
    })


    bus.on(MusicDlerEvent.RecoverTasks, async () => {
      if (!this.registed) {
        const musics = await findAll()
        musics.forEach((music) => {
          this.bus.emit(MusicDlerEvent.AudioTaskCreate, music)
        })
        this.registed = true
      } else {
        this.tasks.forEach((task) => {
          task.emitTaskInfo()
        })
      }
    })

    bus.on(MusicDlerEvent.TaskDeleting, async (_, _id: string) => {
      const idx = this.tasks.findIndex((task) => task.id === _id)
      if (idx === -1) {
        remove(_id)
        this.bus.emit(MusicDlerEvent.TaskDeleted, _id)
        return
      }
      const task = this.tasks[idx]
      task.destory()
      await remove(_id)
      this.tasks.splice(idx, 1)
      this.bus.emit(MusicDlerEvent.TaskDeleted, _id)
    })

    bus.on(MusicDlerEvent.OpenPathSelector, (_, isDir) => {
      const dialog: Dialog = getEleModule("dialog")
      dialog
        .showOpenDialog({
          properties: [ isDir ? "openDirectory" : "openFile"],
        })
        .then((info) => {
          if (!info.filePaths || info.filePaths.length === 0) return
          this.bus.emit(MusicDlerEvent.OpenPathSelectorEnd,  info.filePaths[0], isDir)
        })
    })

  }
}


class Task {
  private music: MusicItem
  public id: string
  private options: any
  private dir: string
  private bus: EventBus
  private status: TaskStatus
  private joiner: Joiner

  constructor(bus: EventBus, id: string, music: MusicItem) {
    this.id = id
    this.bus = bus
    this.music = music
    this.options = generateRequestOption(music)
    this.dir = join(music.dir, music.name)
    this.joiner = new Joiner(music.dir, music.name, music.artists)
    

    if (music.merge) {
      this.status = TaskStatus.merged
    } else {
      this.status = TaskStatus.paused
    }

    this.emitTaskInfo()
  }


  emitTaskInfo(isUpdate?: boolean) {
    this.bus.emit(isUpdate ? MusicDlerEvent.TaskUpdated : MusicDlerEvent.TaskInited, {
      id: this.id,
      filename: this.music.name,
      status: this.status,
      artists: this.music.artists,
      hasAudio: this.music.hasAudio,
      hasAlbum: this.music.hasAlbum,
    })
  }

  // async mergeFragments() {
  //   if (this.segLen > 0) {
  //     await this.joiner
  //       .start()
  //       .then(() => {
  //         try {
  //           accessSync(this.dir, constants.F_OK)
  //           rmdirSync(this.dir, { recursive: true, })
  //         } catch (e) {
  //           logger.info("Merge fragments failed ", e)
  //         }
  //         updateMergeFlag(this.id)
  //         this.status = TaskStatus.merged
  //         this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  //       })
  //       .catch(() => {
  //         this.status = TaskStatus.mergeFailed
  //         this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  //       })
  //   }
  // }

  async start() {
    if (this.status !== TaskStatus.paused) return
    
    this.status = TaskStatus.started
    // createDir(this.dir)

    this.bus.emit(MusicDlerEvent.TaskStatusChanged, this.id, this.status)
    
    createDir(this.dir);

    await this.downloadAlbum();
    await this.downloadAudio();

    if (this.music.hasAudio) {
      this.status = TaskStatus.merging;
      this.mergeAudioAndAlbum();
      this.bus.emit(MusicDlerEvent.TaskStatusChanged, this.id, this.status)
    }

  }

  async mergeAudioAndAlbum() {
    await this.joiner.start(this.music.hasAlbum).then(() => {
      try {
        accessSync(this.dir, constants.F_OK)
        rmdirSync(this.dir, { recursive: true, })
      } catch (e) {
        logger.info("Merge fragments failed ", e)
      }
      updateFlagTrue(this.id, 'merge')
      this.status = TaskStatus.merged
      this.bus.emit(MusicDlerEvent.TaskStatusChanged, this.id, this.status)
    })
    .catch(() => {
      this.status = TaskStatus.mergeFailed
      this.bus.emit(MusicDlerEvent.TaskStatusChanged, this.id, this.status)
    })
  }

  async downloadAlbum() {
    if (this.music.hasAlbum) return;
    const data = await wyMusicRequest.getSongDetail(this.music.musicId);

    if (data.pic ) {
      await download(data.pic, this.dir, `${data.name}.image`, this.options)
      this.music.hasAlbum = true;
      updateFlagTrue(this.id, 'hasAlbum');
      this.emitTaskInfo(true);
    }
  }

  async downloadAudio() {
    const data = await wyMusicRequest.getPlayUrl(this.music.musicId, this.options);
    let error;
    if (data.code == 200) {
      await download(data.url, this.dir, `${this.music.name}.audio`, this.options).catch(err => {
        error = handleReqeustError(err);
      })
      if (!error) {
        this.music.hasAudio = true;
        updateFlagTrue(this.id, 'hasAudio');
        this.emitTaskInfo(true);
      }
    } 
    if (!error && data.code != '200') {
      if (data.code == '-110') {
        error = {
          code: '-110',
          tip: '重新更新cookie'
        }
      } else {
        error = {
          code: data.code
        }
      }
    }
    if (error) {
      this.bus.emit(MusicDlerEvent.Error, this.id, error);

      this.status = TaskStatus.paused
      this.bus.emit(MusicDlerEvent.TaskStatusChanged, this.id, this.status)
    }
  }

  /**
   * 当前线程完成、结束判断是否所有线程已经都结束了
   */
  // threadUpdate() {
  //   this.stopThread++
  //   this.bus.emit(VideoDLerEvent.ThreadUpdate, this.id, this.thread - this.stopThread)
  //   if (this.stopThread !== this.thread) return

  //   const loadedSegs = this.segs.filter((i) => i === TaskSegStatus.downloaded)

  //   if (loadedSegs.length === this.segLen) {
  //     this.status = TaskStatus.merging
  //     this.mergeFragments()

  //     this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  //   } else if (this.status !== TaskStatus.paused) {
  //     this.status = TaskStatus.paused
  //     this.bus.emit(VideoDLerEvent.TaskStatusChanged, this.id, this.status)
  //   }
  // }

  // async threadDownload(from = 0) {
  //   if (this.status !== TaskStatus.started) {
  //     this.threadUpdate()
  //     return
  //   }
  //   const idx = this.findAvailable(from)
  //   if (idx === -1) {
  //     this.threadUpdate()
  //     return
  //   }

  //   logger.info(`downloading ${this.video.name} with index ${idx}`)

  //   this.segs[idx] = TaskSegStatus.downloading
  //   this.bus.emit(VideoDLerEvent.TaskUpdated, this.id, this.segs)

  //   let error = null
  //   await this.downloadSeg(idx).catch((err) => {
  //     error = err
  //     this.tryCountSegs[idx]++
  //     this.segs[idx] = TaskSegStatus.idel
  //   })
  //   if (error) {
  //     logger.error(`download ${this.video.name} with index ${idx} failed, tryCount ${this.tryCountSegs[idx]}`)
  //     logger.error(error)
  //     this.segs[idx] = TaskSegStatus.idel
  //     if (this.tryCountSegs[idx] > DefaultTryCount) {
  //       this.threadUpdate()
  //     } else {
  //       this.threadDownload(idx)
  //     }
  //   } else {
  //     logger.info(`download ${this.video.name} with index ${idx} success`)
  //     this.segs[idx] = TaskSegStatus.downloaded
  //     this.bus.emit(VideoDLerEvent.TaskUpdated, this.id, this.segs)

  //     updateSeg(this.video.url, idx)

  //     this.threadDownload(idx + 1)
  //   }
  // }

  /**
   * 下載某個片段
   */
  // async downloadSeg(idx: number) {
  //   const segment = this.segments[idx]
  //   const baseurl = getBaseUrl(this.video)
  //   const url = buildAbsoluteURL(baseurl, segment.uri)
  //   if (!this.encode) {
  //     await download(url, this.dir, `${idx}.ts`, this.options)
  //   } else {
  //     const iv = normalizateIv(segment.key?.iv || idx)
  //     const algorithm = `${segment.key?.method}-cbc`.toLowerCase()
  //     const cipher = createDecipheriv(algorithm, this.key as Buffer, iv)
  //     await download(url, this.dir, `${idx}.ts`, this.options, cipher)
  //   }
  // }

  destory() {
    // this.joiner.destory()
  }

}
