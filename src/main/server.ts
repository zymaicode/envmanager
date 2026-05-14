import express from 'express'
import { createServer } from 'http'
import { registerRoutes } from './routes'
import { initDockerConnection } from './docker'

let server: ReturnType<typeof createServer> | null = null

export async function startServer(port = 20920): Promise<void> {
  const app = express()
  app.use(express.json())
  registerRoutes(app)

  server = app.listen(port, '127.0.0.1', async () => {
    console.log(`[EnvManager] API Server running on http://127.0.0.1:${port}`)
    await initDockerConnection()
  })
}

export function stopServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
