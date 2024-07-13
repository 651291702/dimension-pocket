import ffmpeg from "./ffmpeg"
import { join } from "path"
import Ffmpeg from "fluent-ffmpeg"
import { createLogger } from "~/main/logger"

const logger = createLogger("main/mp3-merge")

export default class Joiner {
  private name: string
  private artist: string
  private dir: string
  private ffIns: Ffmpeg.FfmpegCommand = null
  private joining: boolean

  constructor(dir: string, name: string, artist: string) {
    this.dir = dir
    this.name = name
    this.artist = artist;
    this.joining = false
  }

  start(hasAlbum?: boolean, ): Promise<any> {
    if (this.ffIns) {
      this.ffIns.kill("SIGKILL");
    }
    this.ffIns = ffmpeg();
    
    const options: Array<string> = [];
    if (hasAlbum) {
      options.push('-i', join(this.dir, this.name, `${this.name}.image`));
      options.push('-map', '0:0', '-map', '1:0')
      options.push('-id3v2_version', '3');
    }

    options.push('-metadata', `title="${this.name}"`);
    
    if (this.artist) {
      options.push('-metadata', `artist="${this.artist}"`);
    }
    

    logger.info('join output options', JSON.stringify(options));

    return new Promise((resolve, reject) => {
      this.ffIns
        .input(join(this.dir, this.name, `${this.name}.audio`))
        // .addOutputOption('-c:a', 'libmp3lame')
        .addOutputOptions(...options)
        .format('mp3')
        .save(join(this.dir, `${this.name}.mp3`))
        .on("error", function (...args) {
          logger.error("join mp3 poster artist failed", ...args)
          reject(...args)
        })
        .on("end", () => {
          this.joining = false
          resolve(null)
        })
    })

  }
  destory() {
    if (this.joining) {
      this.ffIns.kill("SIGKILL")
    }
  }
}