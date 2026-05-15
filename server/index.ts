/**
 * EnvManager Docker 自托管版入口
 * 纯 Express 启动，不依赖 Electron
 * 用户通过浏览器访问 http://localhost:20920
 */

import express from 'express'
import path from 'path'
import { registerRoutes } from '../src/main/routes'
import { initDockerConnection } from '../src/main/docker'

const PORT = parseInt(process.env['PORT'] || '20920', 10)

async function main(): Promise<void> {
  const app = express()
  app.use(express.json())

  // API routes
  registerRoutes(app)

  // Serve React frontend static files
  // __dirname = out/server/, renderer is at out/renderer/
  const staticDir = path.join(__dirname, '..', 'renderer')
  app.use(express.static(staticDir))

  // SPA fallback: all non-API routes serve index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'))
  })

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[EnvManager] Web Server running on http://0.0.0.0:${PORT}`)
    await initDockerConnection()
  })
}

main().catch((err) => {
  console.error('[EnvManager] Failed to start:', err)
  process.exit(1)
})
