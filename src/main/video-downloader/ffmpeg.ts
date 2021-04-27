const ffmpeg = require("fluent-ffmpeg")
const is_dev = require("electron-is-dev")
let ffmpegPath = require("ffmpeg-static")

if (!is_dev) {
  ffmpegPath = ffmpegPath.replace("app.asar/", "").replace("app.asar\\", "")
}

export default function () {
  return ffmpeg().setFfmpegPath(ffmpegPath)
}
