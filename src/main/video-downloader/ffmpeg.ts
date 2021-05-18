const ffmpeg = require("fluent-ffmpeg")
const is_dev = require("electron-is-dev")
let ffmpegPath = require("ffmpeg-static")
import { createLogger } from "~/main/logger"

const logger = createLogger("main/ffmpeg")

if (!is_dev) {
  ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked")
}

export default function () {
  return ffmpeg().setFfmpegPath(ffmpegPath)
}
