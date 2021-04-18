import { join } from "path"
import { UserConfig } from "vite"
import dotenv from "dotenv"
import vue from "@vitejs/plugin-vue"
import esm2cjs from "./script/plugins/esm2cjs"

dotenv.config({ path: join(__dirname, ".env") })

const root = join(__dirname, "src/render")

const config: UserConfig = {
  root,
  base: "./",
  resolve: {
    alias: {
      "~": join(__dirname, "src"),
      "@": join(__dirname, "src/render"),
    },
  },
  plugins: [esm2cjs({ includes: ["fs", "path"] }), vue()],
}

export default config
