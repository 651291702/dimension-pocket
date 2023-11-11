import { IpcRendererEvent, IpcMainEvent, WebContents } from "electron"
import { getEleModule, isRender } from "./util"
const electron = require("electron")

type FromMainListener = (event: IpcMainEvent, ...args: any[]) => void
type FromRenderListener = (event: IpcRendererEvent, ...args: any[]) => void
type SameProcessListener = (event: null, ...args: any[]) => void
interface AnyListener {
  (event: any, ...args: any[]): void
  _wrapperFn?: FromMainListener | FromRenderListener | SameProcessListener
}

function getIpc() {
  const ipc = isRender() ? electron.ipcRenderer : electron.ipcMain
  return ipc
}

/**
 * 用于在单个Main process 与 单个Render Process间消息通信的插件
 * 支持监听同一进程事件以及另一进程事件
 */
export default class EventBus {
  private set: { [key: string]: SameProcessListener[] }
  private win?: WebContents
  constructor(win?: WebContents) {
    this.set = {}
    if (win && !isRender()) {
      this.win = win
    }
  }

  on(channel: string, listener: AnyListener): void {
    const ipc = getIpc()

    const wrapperFn = function (e: IpcMainEvent | IpcRendererEvent | null, ...args: any[]) {
      listener && listener(e, ...args)
    }

    listener._wrapperFn = wrapperFn

    if (!this.set[channel]) {
      this.set[channel] = []
    }

    this.set[channel].push(wrapperFn)

    ipc.on(channel, listener)
  }

  removeListener(channel: string, listener: AnyListener): void {
    const listeners = this.set[channel]
    if (!listeners) return

    for (let i = listener.length - 1; i >= 0; i--) {
      if (listeners[i] === listener._wrapperFn) {
        listeners.splice(i, 1)
        delete listener._wrapperFn
        break
      }
    }
    return
  }

  once(channel: string, listener: AnyListener): void {
    const wrapperFn = (e: IpcMainEvent | IpcRendererEvent | null, ...args: any[]) => {
      listener && listener(e, ...args)
      this.removeListener(channel, wrapperFn)
    }

    this.on(channel, wrapperFn)
  }

  emit(channel: string, ...args: any[]): void {
    const ipc = isRender() ? electron.ipcRenderer : this.win

    if (ipc) {
      ipc.send(channel, ...args)
    }
    const listeners = this.set[channel]
    if (!listeners) return

    for (let i = 0; i < listeners.length; i++) {
      listeners[i](null, ...args)
    }
  }
}

export const VideoDLerEvent = {
  ManifestLoading: "ManifestLoading",
  ManifestLoaded: "ManifestLoaded",
  RecoverTasks: "RecoverTasks",
  TaskInited: "TaskInited",
  TaskStarting: "TaskStarting",
  TaskUpdated: "TaskUpdated",
  TaskStoping: "TaskStoping",
  TaskStatusChanged: "TaskStatusChanged",
  TaskDeleting: "TaskDeleting",
  TaskDeleted: "TaskDeleted",
  ThreadUpdate: "ThreadUpdate",
  OpenPathSelector: "OpenPathSelector",
  OpenPathSelectorEnd: "OpenPathSelectorEnd",
}
