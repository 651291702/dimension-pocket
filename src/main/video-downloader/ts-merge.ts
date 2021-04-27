import { Readable } from "stream"
import ffmpeg from "./ffmpeg"
import { join } from "path"
import { readFileSync, createWriteStream } from "fs"
import Ffmpeg from "fluent-ffmpeg"
import { createLogger } from "~/main/logger"

const logger = createLogger("ts-merge")

class TsStream extends Readable {
  private index: number
  private dir: string
  private name: string
  private size: number
  constructor(dir: string, name: string, size: number) {
    super()
    this.index = 0
    this.dir = dir
    this.size = size
    this.name = name
  }

  _read() {
    if (this.index >= this.size) {
      this.push(null)
    } else {
      const path = join(this.dir, this.name, `${this.index}.ts`)
      try {
        this.push(readFileSync(path))
      } catch (err) {
        logger.error(`push the ${this.index} and ${path} file failed`, err)
      }
      this.index++
    }
  }
}

export default class Joiner {
  private dir: string
  private name: string
  private ffIns: Ffmpeg.FfmpegCommand
  private input: TsStream
  private joining: boolean
  constructor(dir: string, name: string, size: number) {
    this.dir = dir
    this.name = name
    this.ffIns = ffmpeg()
    this.joining = false
    this.input = new TsStream(dir, name, size)
  }
  start(): Promise<any> {
    this.joining = true
    const filePath = join(this.dir, `${this.name}.mp4`)
    // const outputStream = createWriteStream(filePath)
    return new Promise((resolve) => {
      this.ffIns
        .input(this.input)
        .videoCodec("copy")
        .audioCodec("copy")
        .save(filePath)
        .on("error", function (...args) {
          logger.error(`join ts fragement failed`, ...args)
        })
        .on("end", () => {
          this.joining = false
          resolve(null)
        })
      // .format("mp4")
      // .pipe(outputStream, { end: true })
    })
  }
  destory() {
    if (this.joining) {
      this.ffIns.kill("SIGKILL")
    }
  }
}
