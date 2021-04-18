const resources = import.meta.glob("../../assets/icon/*.svg")

const iconMap: {
  [key: string]: any
} = {}

for (const path in resources) {
  const result = path.match(/[\s\S]*\/(.*)\.svg/)

  const key = result && result[1]

  if (key) {
    iconMap[key] = resources[path]()
  }
}

export default iconMap
