import { App, IpcMain, IpcRenderer } from "electron"
import { join } from "path"
import { accessSync, constants, closeSync, openSync, mkdirSync } from "fs"

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

export function getIpc(): IpcMain | IpcRenderer {
  const ele = electron

  return (isRender() && ele.ipcRenderer) || ele.ipcMain
}

export function getUserDataPath(): string {
  const app: App = getEleModule("app")
  return app.getPath("userData")
}

export function getDBPath(): string {
  return join(getUserDataPath(), "database")
}

export function createFile(dir: string, path: string): void {
  if (!isRender()) {
    try {
      accessSync(path, constants.F_OK)
    } catch (e) {
      mkdirSync(dir, { recursive: true })
      closeSync(openSync(path, "w"))
    }
  }
}

export function createDir(dir: string) {
  try {
    accessSync(dir, constants.F_OK)
  } catch (e) {
    mkdirSync(dir, { recursive: true })
  }
}

export function handleReqeustError(err: any) {
  return {
    code: err.code,
    ...['statusCode', 'url', 'timings', 'retryCount',].reduce((prev: Record<string, string>, current) => {
      if (err.response && err.response[current]) {
        if (current == 'timings') {
          prev[current] = Object.keys(err.response[current]['phases']).map(k => `${k}:${err.response[current]['phases'][k]}`).join('&')
        } else {
          prev[current] = err.response[current]
        }
      }
      return prev;
    }, {}),
  };
}