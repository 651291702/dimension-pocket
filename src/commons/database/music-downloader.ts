import { getDBPath, createFile } from "../util"
import { join } from "path"
import DatastoreType from "nedb-promises"
const Datastore: typeof DatastoreType = require("nedb-promises")
import { RequestHeaders } from "../request"
import { ProxyOptions } from "tunnel"
import { MusicType } from '../../main/music-downloader/typs'

const dbPath = getDBPath()
const path = join(getDBPath(), "music-downloader.db")
createFile(dbPath, path)

const ins = Datastore.create({
  filename: path,
  autoload: true,
})

export type MusicItem = {
  musicId: string
  type: MusicType
  hasAudio: boolean
  hasAlbum: boolean
  name: string // filename
  artist: string
  dir: string // target dir
  merge: boolean
  headers?: RequestHeaders
  proxy?: ProxyOptions
}

export default ins

export function create(music: MusicItem) {
  return ins.insert(music)
}

export function findOne(query: Partial<MusicItem>) {
  return ins.findOne<MusicItem>(query)
}
