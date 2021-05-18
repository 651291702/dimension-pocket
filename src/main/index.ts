/**
 * electron 主文件
 */
import { join } from "path"
import { app, BrowserWindow, BrowserWindowConstructorOptions, Menu } from "electron"
import { createLogger } from "~/main/logger"
import EventBus from "~/commons/eventbus"
import VideoDlerManager from "./video-downloader/manager"
const is_dev = require("electron-is-dev")

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
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      } else if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.focus()
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
        devTools: true,
        /**
         * 理论上并不推荐使用nodeIntefration标志，安全操作：将操作在main线程中实现，利用通信机制
         * @see https://www.electronjs.org/docs/api/browser-window
         * 主要考虑该项目仅为个人用途且方便文件操作，故打开开关
         */
        nodeIntegration: true,
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
  app
    .whenReady()
    .then(createWin)
    .then(() => {
      Menu.setApplicationMenu(null)
    })
    .then(() => {
      bus = new EventBus(win.webContents)
      new VideoDlerManager(bus)
    })
}

main()
