const electron = require("electron")

export function isRender(): boolean {
  return process && process.type === "renderer"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEleModule(key: string): any {
  let ele = electron
  if (isRender()) {
    ele = ele.remote
  }
  if (!ele[key]) {
    throw Error(`Not Such Key ${key} in electron`)
  } else {
    return ele[key]
  }
}
