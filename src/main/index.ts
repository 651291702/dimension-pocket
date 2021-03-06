/**
 * electron 主文件
 */
import { join } from "path"
import { app, BrowserWindow, BrowserWindowConstructorOptions } from "electron"
import is_dev from "electron-is-dev"
import { createLogger } from "~/main/logger"

let win: BrowserWindow

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

function createWin(): void
function createWin(config: BrowserWindowConstructorOptions): void
function createWin(config: BrowserWindowConstructorOptions | void) {
  // 创建浏览器窗口
  const overrideConf: BrowserWindowConstructorOptions = Object.assign(
    {
      width: 1024,
      height: 720,
      webPreferences: {
        enableRemoteModule: true,
        devTools: true,
      },
    } as BrowserWindowConstructorOptions,
    config || {}
  )

  win = new BrowserWindow(overrideConf)
  const URL = is_dev ? "http://localhost:3000" : `file://${join(__dirname, "../render/index.html")}`
  win.loadURL(URL)
  win.webContents.openDevTools()
}

function main(): void {
  if (existInstance()) return
  app.whenReady().then(createWin)
}

main()
