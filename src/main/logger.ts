// Only work in main render
import { app, App } from "electron"
const { join } = require("path")
const { existsSync, mkdirSync } = require("fs")
import { default as log4js, configure, getLogger, levels } from "log4js"
import { isRender, getEleModule } from "~/commons/util"

let udDir: string // userData directory
let logDir: string // the logs dirctory below userData directory

enum Categories {
  Default = "default",
  Main = "main",
  Render = "render",
}

enum Appenders {
  Default = "default",
  Main = "main",
  MainError = "main-error", // It don't need be used because all level log will log in main
  RenderError = "render-error",
  Render = "render",
  Console = "console",
}

enum Levels {
  ALL = "all",
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
  MARK = "mark",
  OFF = "off",
}

log4js.addLayout("file-info", function (conf) {
  return function (e) {
    const levelStr = e.level.levelStr
    const info = e.data
      .map((i) => {
        if (typeof i === "string" || typeof i === "number") {
          return i
        } else {
          return JSON.stringify(i)
        }
      })
      .join(" ‖ ")
    const context = e.context
    const filename = context.filename || ""
    return `[${levelStr}] - <${filename}> - ${info}`
  }
})

class Logger {
  private config: log4js.Configuration
  public instance: log4js.Logger
  constructor(dir: string, filename: string, category: Categories, conf?: log4js.Configuration) {
    // generate file path with os format
    function genFilePath(filename: string): string {
      return join(dir, filename)
    }

    const defaultConf: log4js.Configuration = {
      appenders: {
        [Appenders.Console]: { type: "console", layout: { type: "file-info" } },
        [Appenders.Default]: { type: "file", filename: genFilePath("all.log"), layout: { type: "file-info" } },
        [Appenders.Main]: { type: "file", filename: genFilePath("main.log"), layout: { type: "file-info" } },
        [Appenders.Render]: { type: "file", filename: genFilePath("render.log"), layout: { type: "file-info" } },
        [Appenders.MainError]: { type: "logLevelFilter", appender: Appenders.Main, level: Levels.ERROR },
        [Appenders.RenderError]: { type: "logLevelFilter", appender: Appenders.Render, level: levels.ERROR },
      },
      categories: {
        [Categories.Default]: {
          appenders: [Appenders.Console],
          level: Levels.ALL,
        },
        [Categories.Main]: {
          appenders: [Appenders.Console, Appenders.Main],
          level: Levels.ALL,
        },
        [Categories.Render]: {
          appenders: [Appenders.Console, Appenders.RenderError],
          level: Levels.ERROR,
        },
      },
    }
    this.config = Object.assign(defaultConf, conf || {})
    configure(this.config)
    this.instance = getLogger(category)
    this.instance.addContext("filename", filename)
  }
  info(message: string) {
    return this.instance.info(message)
  }
  error(message: string) {
    return this.instance.error(message)
  }
  warn(message: string) {
    return this.instance.warn(message)
  }
}

export function createLogger(filename: string, conf?: log4js.Configuration): Logger {
  const app: App = getEleModule("app")
  if (!udDir || !logDir) {
    udDir = app.getPath("userData")
    logDir = join(udDir, "logs")
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
  }

  let category: Categories
  if (filename.split("/")[0] === "main") {
    category = Categories.Main
  } else if (filename.split("/")[0] === "render") {
    category = Categories.Render
  } else {
    category = Categories.Default
  }

  return new Logger(logDir, filename, category, conf)
}
