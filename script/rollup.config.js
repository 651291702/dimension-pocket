const path = require("path")
const { nodeResolve } = require("@rollup/plugin-node-resolve")
const commonjs = require("@rollup/plugin-commonjs")
const typescript = require("@rollup/plugin-typescript")
const json = require("@rollup/plugin-json")

module.exports = {
  input: path.join(__dirname, "../src/main/index.ts"),
  output: {
    file: path.join(__dirname, "../dist/main/_.js"),
    format: "cjs",
    sourcemap: true,
  },
  plugins: [nodeResolve({ jsnext: true, preferBuiltins: true, browser: true }), commonjs(), typescript(), json()],
  external: ["fs", "path", "http", "https", "child_process", "os", "electron", "util", "zlib", "buffer", "events"],
}
