import { sep } from "path"

/**
 * Typescript下使用 const xxx = require("") 无法很好进行语法提示
 * 使用import xxx = require("") 能够render process正常工作, 但是该语法无法正常在 main process中运行
 * 因此该插件的目前是将import xxx from "xxx"    =>  const xxx = require("")
 *
 * 配置项 includes 为需要替换的node模块
 */

const reg = /import[\n\s]+([\S\s]+?)[\n\s]*from[\n\s]*(['|"](\S+)['|"])/g
// const reg = /import[\n\s]+([\S\s]+?)[\n\s]*from[\n\s]*(['|"](\S+)['|"])(.*)[\r\n]?/g     匹配一行

export default function (options: { includes: string[] }) {
  return {
    name: "plugin-esm2cjs",
    transform(code: string, id: string) {
      if (id.includes(`${sep}node_modules${sep}`)) {
        return code
      }

      const res = code.match(reg)
      if (res) {
        code = code.replace(reg, function ($, to, from, lib) {
          if (!options.includes.includes(lib)) {
            return $
          }
          let target = to.trim().replace("s+", " ")
          if (target.slice(0, 4) === "* as") {
            to = target.slice(4).trim()
          }

          return `const ${to} = require(${from})`
        })
      }
      return code
    },
  }
}
