import sharp from "sharp";
import { join } from "path"
import * as fs from "fs";
import { createLogger } from "~/main/logger"


const logger = createLogger("main/mp3-imageResize")


export default async function imageLimitSize(dir: string, filename: string, MAX_SIZE = 500) {
  const target = join(dir, filename)
  
  const temp = join(dir, 'temp')
  fs.copyFileSync(target, temp)

  const image = await sharp(temp);
  const metadata = await image.metadata();
  logger.info(`image metadata width[${metadata.width}] height[${metadata.height}]`);
  if (typeof metadata.width == 'number' && metadata.width > MAX_SIZE) {
    await image.resize(MAX_SIZE, MAX_SIZE, { fit: 'outside' });
    await image.toFile(target)
    sharp.cache(false);
  }

}