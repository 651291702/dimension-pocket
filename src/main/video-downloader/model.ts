import { videoDler as DB } from "~/commons/database"
import { create, findOne, VideoItem } from "~/commons/database/video-downloader"

function findByUrl(url: string) {
  return findOne({ url })
}

function findAll() {
  return DB.find<VideoItem>({})
}

function updateSegLen(id: string, len: number) {
  return DB.update({ _id: id }, { $set: { totalSegs: len } }, {})
}

function updateSeg(url: string, seg: number) {
  return DB.update({ url }, { $addToSet: { segs: seg } }, {})
}

function remove(id: string) {
  return DB.remove({ _id: id }, {})
}

function updateMergeFlag(id: string) {
  return DB.update({ _id: id }, { $set: { merge: true } }, {})
}

export { findByUrl, create, updateSegLen, updateSeg, findAll, remove, updateMergeFlag }
