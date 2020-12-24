const path = require("path")
const rollup = require("rollup")
const argv = require("minimist")(process.argv.slice(2))
const chalk = require("chalk")
const ora = require("ora")
const waitOn = require("wait-on")
const electronConnect = require("electron-connect")
const dotenv = require("dotenv")
const config = require("./rollup.config")
const electron = electronConnect.server.create({ stopOnClose: true })

dotenv.config({ path: path.join(__dirname, "../", ".env") })

const LogFile = "[script|build.js]"

// Make hot-reload in main process when command line with --watch
if (argv.watch) {
  waitOn(
    {
      resources: ["http://localhost:3000"],
      log: false,
    },
    (err) => {
      if (err) {
        console.info(err)
        process.exit(1)
      }

      const watcher = rollup.watch(config)

      watcher.on("change", (filename) => {
        console.info(LogFile, chalk.green(`> > >  Changed  > > >   [${filename}]`))
      })
      watcher.on("event", (ev) => {
        if (ev.code === "END") {
          electron.electronState === "init" ? electron.start() : electron.restart()
        }

        if (ev.code === "ERROR") {
          console.info(LogFile, chalk.red(`Watch Error`), ev.error)
        }
      })
    }
  )
}
//  only build target
else {
  const spinner = ora(`${LogFile} Electron build...`).start()
  rollup
    .rollup(config)
    .then((build) => {
      spinner.stop()
      console.info(LogFile, chalk.green("Electron build successed."))
      build.write(config.output)
    })
    .catch((error) => {
      spinner.stop()
      console.info(LogFile, chalk.red("Electron build failed. "), error)
    })
}
