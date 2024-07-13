import { musicDler as DB } from "~/commons/database"
import { create, findOne, MusicItem } from "~/commons/database/music-downloader"
import { MusicType } from "./typs"

function findByMusicId(musicId: string, type: MusicType) {
  return findOne({ musicId, type })
}

function findAll() {
  return DB.find<MusicItem>({})
}

function updateNameArticle(id: string, name: string, article: string) {
  return DB.update({ _id: id }, { $set: { name, article } }, {})
}

function updateFlagTrue(id: string, key: string) {
  return DB.update({ _id: id }, { $set: { [key]: true } }, {})
}

function remove(id: string) {
  return DB.remove({ _id: id }, {})
}


export { findByMusicId, create, updateFlagTrue, findAll, remove, updateNameArticle }
