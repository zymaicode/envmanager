import express from 'express'
import { createServer } from 'http'
import { registerRoutes } from './routes'

let server: ReturnType<typeof createServer> | null = null

export function startServer(port = 20920): void {
  const app = express()
  app.use(express.json())
  registerRoutes(app)

  server = app.listen(port, '127.0.0.1', () => {
    console.log(`[EnvManager] API Server running on http://127.0.0.1:${port}`)
  })
}

export function stopServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
