/**
 * electron 主文件
 */
import { join, resolve } from "path"
import { app, BrowserWindow, BrowserWindowConstructorOptions, Menu } from "electron"
import { createLogger } from "~/main/logger"
import EventBus, { ProtocolEvent } from "~/commons/eventbus"
import VideoDlerManager from "./video-downloader/manager"
// import MusicDlerManager from "./music-downloader/manager"
const is_dev = require("electron-is-dev")

const PROTOCOL_SCHEME = "dpocket"
let win: BrowserWindow
let bus: EventBus

/**
 * Single Instance Mode
 */
function existInstance(): boolean {
  if (!app.requestSingleInstanceLock()) {
    app.exit()
    return true
  }
  app.on("second-instance", (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      } else if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.focus()
      }
      const url = commandLine.pop()
      if (url && url.startsWith(`${PROTOCOL_SCHEME}://`)) {
        // handleProtocolUrl(url)
        console.log(`[DEV] awake protocol url ${url}`)
        bus.emit(ProtocolEvent.ProtocolAwake, url)
      }
    } else {
      app.exit()
    }
  })
  return false
}

function createWin(): BrowserWindow
function createWin(config: BrowserWindowConstructorOptions): BrowserWindow
function createWin(config?: BrowserWindowConstructorOptions | void): BrowserWindow {
  // 创建浏览器窗口
  const overrideConf: BrowserWindowConstructorOptions = Object.assign(
    {
      width: 1080,
      height: 700,
      webPreferences: {
        enableRemoteModule: true,
        devTools: false,
        /**
         * 理论上并不推荐使用nodeIntefration标志，安全操作：将操作在main线程中实现，利用通信机制
         * @see https://www.electronjs.org/docs/api/browser-window
         * 主要考虑该项目仅为个人用途且方便文件操作，故打开开关
         */
        nodeIntegration: true,
        contextIsolation: false,
      },
    } as BrowserWindowConstructorOptions,
    config || {}
  )

  win = new BrowserWindow(overrideConf)
  if (is_dev) {
    win.loadURL("http://localhost:3000")
  } else {
    win.loadFile(join(__dirname, "index.html"))
  }
  win.webContents.openDevTools()
  return win
}

function main(): void {
  if (existInstance()) return
  if (is_dev) {
    if (process.platform === "win32") {
      // Windows 开发模式下必须指定 electron.exe 路径和当前项目路径
      const isSet = app.setAsDefaultProtocolClient(
        PROTOCOL_SCHEME,
        process.execPath,
        [resolve(__dirname, "../")],
      )
      console.log(`[DEV] Protocol registered: ${isSet} ${process.execPath} ${resolve(__dirname, "../")}`)
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
  }
  app
    .whenReady()
    .then(createWin)
    .then(() => {
      Menu.setApplicationMenu(null)
    })
    .then(() => {
      bus = new EventBus(win.webContents)
      new VideoDlerManager(bus)
      // new MusicDlerManager(bus)
    })
}

main()
