import { join } from "path"
import { UserConfig } from "vite"
import dotenv from "dotenv"

dotenv.config({ path: join(__dirname, ".env") })

const root = join(__dirname, "src/render")

const config: UserConfig = {
  root,
  entry: join(root, "main.js"),
  base: "./",
  outDir: join(__dirname, "dist/render"),
  alias: {
    "~": join(__dirname, "src"),
  },
  rollupInputOptions: {
    external: [
      // 'crypto',
      // 'assert',
      // 'fs',
      // 'util',
      // 'os',
      // 'events',
      // 'child_process',
      // 'http',
      // 'https',
      // 'path',
      // 'electron',
      "winston",
    ],
  },
}

export default config
