import { getDBPath, createFile } from "../util"
import { join } from "path"
import DatastoreType from "nedb-promises"
const Datastore: typeof DatastoreType = require("nedb-promises")
import { RequestHeaders } from "../request"
import { ProxyOptions } from "tunnel"

const dbPath = getDBPath()
const path = join(getDBPath(), "video-downloader.db")
createFile(dbPath, path)

const ins = Datastore.create({
  filename: path,
  autoload: true,
})

export type VideoItem = {
  url: string
  name: string // filename
  dir: string // target dir
  segs: number[]
  merge: boolean
  headers?: RequestHeaders
  proxy?: ProxyOptions
  totalSegs?: number
  prefix?: string
}

export default ins

export function create(video: VideoItem) {
  return ins.insert(video)
}

export function findOne(query: Partial<VideoItem>) {
  return ins.findOne<VideoItem>(query)
}
