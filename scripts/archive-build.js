const fs = require('fs')
const path = require('path')

const pkg = require('../package.json')
const version = pkg.version
const distDir = path.join(__dirname, '..', 'dist')
const archiveDir = path.join(distDir, 'archive', `v${version}`)

// Create archive directory
fs.mkdirSync(archiveDir, { recursive: true })

// Copy installer
const installerPattern = new RegExp(`环境管理平台 Setup ${version.replace(/\./g, '\\.')}`)
const files = fs.readdirSync(distDir)
for (const f of files) {
  if (installerPattern.test(f)) {
    fs.copyFileSync(path.join(distDir, f), path.join(archiveDir, f))
    console.log(`[archive] Copied: ${f}`)
  }
}

// Copy portable version
const portableSrc = path.join(distDir, 'win-unpacked')
// Don't copy the entire unpacked dir (too large), just note it exists
fs.writeFileSync(
  path.join(archiveDir, 'portable-port.txt'),
  `Portable version available at dist/win-unpacked/ (v${version})\nBuilt: ${new Date().toISOString()}\n`
)

// Keep only last 5 versions
const archives = fs.readdirSync(path.join(distDir, 'archive'))
  .filter((f) => f.startsWith('v'))
  .sort()
if (archives.length > 5) {
  const toRemove = archives.slice(0, archives.length - 5)
  for (const dir of toRemove) {
    fs.rmSync(path.join(distDir, 'archive', dir), { recursive: true, force: true })
    console.log(`[archive] Removed old: ${dir}`)
  }
}

console.log(`[archive] Build archived to dist/archive/v${version}/`)
