import { getUserDataPath, isRender, getDBPath, createFile } from "../util"
import { join } from "path"
const Datastore = require("nedb")

const dbPath = getDBPath()
const path = join(getDBPath(), "video-downloader.db")
createFile(dbPath, path)

const ins = new Datastore({
  filename: path,
  autoload: true,
})

export default ins
