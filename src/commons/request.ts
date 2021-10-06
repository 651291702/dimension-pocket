import got, { OptionsOfTextResponseBody } from "got"
import * as stream from "stream"
import { promisify } from "util"
import * as fs from "fs"
import { join } from "path"
import tunnel, { ProxyOptions } from "tunnel" // @plugin-esm2cjs ignore

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

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

  target.headers = Object.keys(option).reduce((o: any, k) => {
    o[k.toLowerCase()] = option[k]
    o[k] = option[k]
    return o
  }, {})

  return target
}

export function download(
  url: string,
  dir: string,
  filename: string,
  opt?: Partial<OptionsOfTextResponseBody>,
  transform?: any
): Promise<any> {
  const target = join(dir, filename)
  if (transform) {
    return pipeline(got.stream(url, opt as any), transform, fs.createWriteStream(target))
  } else {
    return pipeline(got.stream(url, opt as any), fs.createWriteStream(target))
  }
}

export function get(url: string, opt?: Partial<OptionsOfTextResponseBody>) {
  return got(url, opt)
}
