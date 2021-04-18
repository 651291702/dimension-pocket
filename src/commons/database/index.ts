import Datastore from "nedb"
import videoDler from "./video-downloader"

const db: {
  videoDler: Datastore
  [key: string]: Datastore
} = {
  videoDler,
}

export default db
