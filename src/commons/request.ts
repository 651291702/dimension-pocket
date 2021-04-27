import got, { OptionsOfTextResponseBody } from "got"
import * as stream from "stream"
import { promisify } from "util"
import * as fs from "fs"
import { join } from "path"
import tunnel, { ProxyOptions } from "tunnel" // @plugin-esm2cjs ignore

const pipeline = promisify(stream.pipeline)

export interface RequestHeaders {
  [key: string]: string | number
}

export function generateProxy(target: any, option: ProxyOptions) {
  if (!target) target = {}

  target.agent = {
    https: tunnel.httpsOverHttp({
      proxy: option,
    }),
  }

  return target
}

export function generateHeaders(target: any, option: RequestHeaders) {
  if (!target) target = {}

  target.headers = option

  return target
}

export function download(
  url: string,
  dir: string,
  filename: string,
  opt?: Partial<OptionsOfTextResponseBody>
): Promise<any> {
  const target = join(dir, filename)
  return pipeline(got.stream(url, opt as any), fs.createWriteStream(target))
}
