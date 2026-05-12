import express from 'express'
import { createServer } from 'http'
import Docker from 'dockerode'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ====== Docker 连接方式自动探测 ======
function detectDockerConnection(): { socketPath?: string; host?: string; port?: number } {
  // 1. DOCKER_HOST 环境变量（远程 Docker / TCP 连接）
  const envHost = process.env['DOCKER_HOST']
  if (envHost) {
    console.log(`[EnvManager] Docker: using DOCKER_HOST = ${envHost}`)
    // 解析 tcp://host:port 或 unix:///path
    const match = envHost.match(/^(tcp:\/\/)?(.+):(\d+)$/)
    if (match) {
      return { host: match[2], port: parseInt(match[3]) }
    }
    return { socketPath: envHost.replace('unix://', '') }
  }

  // 2. Docker Desktop for Windows — 多种 Named Pipe 路径
  if (process.platform === 'win32') {
    const windowsPipes = [
      '//./pipe/docker_engine',
      '//./pipe/dockerDesktopLinuxEngine',
      '//./pipe/DockerDesktopLinuxEngine'
    ]
    for (const pipe of windowsPipes) {
      try {
        const stat = fs.statSync(pipe)
        if (stat) {
          console.log(`[EnvManager] Docker: using named pipe ${pipe}`)
          return { socketPath: pipe }
        }
      } catch { /* pipe not available */ }
    }
  }

  // 3. Standard Unix socket（Linux / macOS 原生 Docker、Colima、Rancher）
  const unixSockets = [
    '/var/run/docker.sock',                    // Docker Engine (Linux/macOS)
    path.join(os.homedir(), '.docker', 'run', 'docker.sock'),  // Docker Desktop macOS
    path.join(os.homedir(), '.colima', 'default', 'docker.sock'), // Colima
    path.join(os.homedir(), '.colima', 'docker.sock'),           // Colima (旧)
    path.join(os.homedir(), '.rd', 'docker.sock'),               // Rancher Desktop
    '/run/user/1000/podman/podman.sock',       // Podman (Linux)
  ]
  for (const sock of unixSockets) {
    if (fs.existsSync(sock)) {
      console.log(`[EnvManager] Docker: using unix socket ${sock}`)
      return { socketPath: sock }
    }
  }

  // 4. WSL2 内原生 Docker（通过 docker context 的 endpoint）
  // dockerode 默认会读取 DOCKER_HOST, 这里回退到默认行为
  console.log('[EnvManager] Docker: using default connection (dockerode auto-detect)')
  return {}
}

const dockerConfig = detectDockerConnection()
const docker = new Docker(dockerConfig)

let server: ReturnType<typeof createServer> | null = null

// ====== 静态数据：环境模板配置 ======
const templates = [
  {
    id: 'python', name: 'Python', icon: 'python', color: '#3776AB',
    description: 'Python 开发环境，支持数据科学与 Web 开发', category: 'backend',
    versions: [
      { version: '3.10', image: 'python:3.10-slim', size: '~150 MB', tools: ['pip'], isLTS: true },
      { version: '3.11', image: 'python:3.11-slim', size: '~160 MB', tools: ['pip'], isLTS: true },
      { version: '3.12', image: 'python:3.12-slim', size: '~160 MB', tools: ['pip'], isLTS: true },
      { version: '3.13', image: 'python:3.13-slim', size: '~170 MB', tools: ['pip'], isLTS: false }
    ]
  },
  {
    id: 'node', name: 'Node.js', icon: 'nodejs', color: '#339933',
    description: 'Node.js 开发环境，支持前端与后端开发', category: 'backend',
    versions: [
      { version: '18', image: 'node:18-slim', size: '~250 MB', tools: ['npm', 'yarn'], isLTS: true },
      { version: '20', image: 'node:20-slim', size: '~260 MB', tools: ['npm', 'yarn'], isLTS: true },
      { version: '22', image: 'node:22-slim', size: '~270 MB', tools: ['npm', 'yarn', 'pnpm'], isLTS: true },
      { version: '23', image: 'node:23-slim', size: '~270 MB', tools: ['npm', 'yarn', 'pnpm'], isLTS: false }
    ]
  },
  {
    id: 'java', name: 'Java', icon: 'java', color: '#ED8B00',
    description: 'Java 开发环境，支持 Maven/Gradle 构建', category: 'backend',
    versions: [
      { version: '17', image: 'eclipse-temurin:17-jdk', size: '~450 MB', tools: ['Maven'], isLTS: true },
      { version: '21', image: 'eclipse-temurin:21-jdk', size: '~460 MB', tools: ['Maven', 'Gradle'], isLTS: true }
    ]
  },
  {
    id: 'go', name: 'Go', icon: 'go', color: '#00ADD8',
    description: 'Go 开发环境，支持模块管理与调试', category: 'backend',
    versions: [
      { version: '1.22', image: 'golang:1.22-bookworm', size: '~850 MB', tools: ['Go Modules'], isLTS: true },
      { version: '1.23', image: 'golang:1.23-bookworm', size: '~880 MB', tools: ['Go Modules'], isLTS: false }
    ]
  },
  {
    id: 'rust', name: 'Rust', icon: 'rust', color: '#DEA584',
    description: 'Rust 开发环境，包含 Cargo 与常用工具链', category: 'systems',
    versions: [
      { version: '1.78', image: 'rust:1.78-slim-bookworm', size: '~800 MB', tools: ['Cargo', 'rustup'], isLTS: true },
      { version: 'latest', image: 'rust:latest', size: '~850 MB', tools: ['Cargo', 'rustup', 'Clippy'], isLTS: false }
    ]
  },
  {
    id: 'cpp', name: 'C/C++', icon: 'cpp', color: '#00599C',
    description: 'C/C++ 开发环境，包含 GCC + CMake 工具链', category: 'systems',
    versions: [
      { version: '12', image: 'gcc:12-bookworm', size: '~1.2 GB', tools: ['CMake', 'GDB'], isLTS: true },
      { version: '14', image: 'gcc:14-bookworm', size: '~1.3 GB', tools: ['CMake', 'GDB'], isLTS: false }
    ]
  }
]

// ====== 数据库环境模板（独立类别，端口映射不同） ======
const databaseTemplates = [
  {
    id: 'mysql', name: 'MySQL', icon: 'mysql', color: '#4479A1',
    description: 'MySQL 数据库服务，企业级关系型数据库', category: 'data',
    versions: [
      { version: '8.0', image: 'mysql:8.0', size: '~580 MB', tools: ['mysqlsh'], isLTS: true },
      { version: '8.4', image: 'mysql:8.4', size: '~600 MB', tools: ['mysqlsh'], isLTS: true }
    ],
    defaultPorts: [{ container: 3306, host: 3306, type: 'web' as const }],
    env: { MYSQL_ROOT_PASSWORD: 'envmanager' }
  },
  {
    id: 'postgres', name: 'PostgreSQL', icon: 'postgres', color: '#336791',
    description: 'PostgreSQL 数据库服务，功能强大的开源关系型数据库', category: 'data',
    versions: [
      { version: '16', image: 'postgres:16-alpine', size: '~270 MB', tools: ['psql'], isLTS: true },
      { version: '17', image: 'postgres:17-alpine', size: '~280 MB', tools: ['psql'], isLTS: false }
    ],
    defaultPorts: [{ container: 5432, host: 5432, type: 'web' as const }],
    env: { POSTGRES_PASSWORD: 'envmanager' }
  },
  {
    id: 'redis', name: 'Redis', icon: 'redis', color: '#DC382D',
    description: 'Redis 缓存服务，高性能内存键值存储', category: 'data',
    versions: [
      { version: '7', image: 'redis:7-alpine', size: '~40 MB', tools: ['redis-cli'], isLTS: true }
    ],
    defaultPorts: [{ container: 6379, host: 6379, type: 'web' as const }],
    env: {}
  },
  {
    id: 'mongo', name: 'MongoDB', icon: 'mongo', color: '#47A248',
    description: 'MongoDB 数据库服务，高性能 NoSQL 文档数据库', category: 'data',
    versions: [
      { version: '7', image: 'mongo:7', size: '~760 MB', tools: ['mongosh'], isLTS: true }
    ],
    defaultPorts: [{ container: 27017, host: 27017, type: 'web' as const }],
    env: {}
  }
]

// ====== 辅助函数：解析 Docker 容器数据 ======
function mapContainer(info: Docker.ContainerInfo) {
  const labels = info.Labels || {}
  const ports = info.Ports || []
  return {
    id: info.Id.substring(0, 12),
    dockerId: info.Id,
    name: (info.Names[0] || '').replace(/^\//, ''),
    image: info.Image,
    language: labels['envmanager.language'] || '',
    version: labels['envmanager.version'] || '',
    status: info.State,
    state: {
      startedAt: '',
      finishedAt: null as string | null,
      exitCode: null as number | null,
      health: undefined as string | undefined
    },
    ports: ports
      .filter((p) => p.PublicPort)
      .map((p) => ({
        container: p.PrivatePort,
        host: p.PublicPort,
        type: p.PrivatePort === 22 ? 'ssh' : p.PrivatePort === 3000 || p.PrivatePort === 8080 || p.PrivatePort === 5000 || p.PrivatePort === 8000 ? 'web' : 'custom'
      })),
    projectPath: labels['envmanager.project'] || '',
    createdAt: info.Created ? new Date(info.Created * 1000).toISOString() : ''
  }
}

async function getContainerDetail(containerId: string): Promise<any> {
  const c = docker.getContainer(containerId)
  const info = await c.inspect()
  const stats = await c.stats({ stream: false })
  const labels = info.Config.Labels || {}
  const ports = info.NetworkSettings?.Ports || {}

  // Calculate CPU %
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
  const cpuCount = stats.cpu_stats.online_cpus || 1
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0

  // Memory
  const memUsage = stats.memory_stats.usage || 0
  const memLimit = stats.memory_stats.limit || 0

  const allPorts: { container: number; host: number | null; type: string }[] = []
  for (const [privatePort, bindings] of Object.entries(ports)) {
    const portNum = parseInt(privatePort.split('/')[0])
    const hostPort = bindings && bindings.length > 0 ? parseInt(bindings[0].HostPort) : null
    allPorts.push({
      container: portNum,
      host: hostPort || portNum,
      type: portNum === 22 ? 'ssh' : portNum === 3000 || portNum === 8080 || portNum === 5000 || portNum === 8000 ? 'web' : 'custom'
    })
  }

  return {
    id: info.Id.substring(0, 12),
    dockerId: info.Id,
    name: info.Name.replace(/^\//, ''),
    image: info.Config.Image,
    language: labels['envmanager.language'] || '',
    version: labels['envmanager.version'] || '',
    status: info.State.Running ? 'running' : info.State.Paused ? 'paused' : info.State.Dead ? 'dead' : 'stopped',
    state: {
      startedAt: info.State.StartedAt,
      finishedAt: info.State.FinishedAt || null,
      exitCode: info.State.ExitCode,
      health: info.State.Health?.Status
    },
    ports: allPorts,
    mounts: (info.Mounts || []).map((m) => ({ source: m.Source, destination: m.Destination })),
    resources: {
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      memoryUsage: memUsage,
      memoryLimit: memLimit
    },
    projectPath: labels['envmanager.project'] || '',
    createdAt: info.Created
  }
}

// ====== 端口分配 ======
async function findFreePort(start: number, end: number): Promise<number> {
  const net = await import('net')
  for (let port = start; port <= end; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer()
      server.unref()
      server.on('error', () => resolve(false))
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true))
      })
    })
    if (available) return port
  }
  throw new Error(`No free port found in range ${start}-${end}`)
}

// ====== SSH 密钥管理 ======
function ensureSshKey(): { publicKey: string; privateKeyPath: string } {
  const keyDir = path.join(os.homedir(), '.envmanager', 'keys')
  fs.mkdirSync(keyDir, { recursive: true })
  const privateKeyPath = path.join(keyDir, 'id_rsa')
  const publicKeyPath = path.join(keyDir, 'id_rsa.pub')

  if (!fs.existsSync(privateKeyPath)) {
    // Generate a simple SSH key pair using Node.js crypto
    const crypto = require('crypto')
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 })
    fs.writeFileSync(publicKeyPath, publicKey)
    console.log('[EnvManager] SSH key pair generated')
  }

  const publicKey = fs.readFileSync(publicKeyPath, 'utf8')
  return { publicKey, privateKeyPath }
}

export function startServer(port = 20920): void {
  const app = express()
  app.use(express.json())

  // ====== 环境模板 ======
  app.get('/api/environments', (req, res) => {
    const category = req.query.category as string | undefined
    const all = [...templates]
    if (!category || category === 'data') {
      all.push(...databaseTemplates.map((t) => ({ ...t, isDatabase: true })))
    }
    if (category) {
      return res.json(all.filter((t) => t.category === category))
    }
    res.json(all)
  })

  // ====== 容器列表 ======
  app.get('/api/containers', async (_req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const mapped = containers
        .filter((c) => c.Labels?.['envmanager.language'])
        .map(mapContainer)
      res.json(mapped)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 容器详情 ======
  app.get('/api/containers/:id', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const detail = await getContainerDetail(found.Id)
      res.json(detail)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 创建任务状态缓存 ======
  const creationTasks = new Map<string, { phase: string; containerId?: string; sshPort?: number; error?: string; done: boolean }>()

  // Auto-cleanup: remove done/errored tasks after 60 seconds
  setInterval(() => {
    const now = Date.now()
    for (const [key, task] of creationTasks) {
      if (task.done) creationTasks.delete(key)
    }
  }, 60000)

  // ====== 创建容器 ======
  app.post('/api/containers', async (req, res) => {
    const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    creationTasks.set(taskId, { phase: '正在检查镜像缓存...', done: false })

    // Respond immediately with taskId, do the work async
    res.json({ taskId })

    const { lang, version, projectPath: rawProjectDir } = req.body as { lang: string; version: string; projectPath: string }

    // Normalize path for Windows (WSL2)
    let projectPath = rawProjectDir
    if (process.platform === 'win32') {
      projectPath = rawProjectDir.replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    }

    const containerName = `env-${lang}-${version.replace('.', '')}-${taskId}`
    const allTemplates = [...templates, ...databaseTemplates]
    const template = allTemplates.find((t) => t.id === lang)
    const ver = template?.versions?.find((v) => v.version === version)
    const isDatabase = (template as any)?.isDatabase
    let container: Docker.Container | null = null

    try {
      // Phase 1: Check image
      if (!ver) throw new Error(`Unknown version: ${version} for ${lang}`)
      const localImages = await docker.listImages({ filters: { reference: [ver.image] } })
      if (localImages.length === 0) {
        creationTasks.set(taskId, {
          phase: `镜像未下载: ${ver.image}`,
          error: 'IMAGE_NOT_FOUND',
          done: true
        })
        return
      }

      // Phase 2: Allocate port
      creationTasks.set(taskId, { phase: '正在分配端口...', done: false })
      const sshPort = await findFreePort(22000, 30000)

      // Phase 3: Create container
      creationTasks.set(taskId, { phase: '正在创建容器...', done: false })

      const dbTemplate = databaseTemplates.find((t) => t.id === lang)
      const createOpts: Docker.ContainerCreateOptions = {
        Image: ver.image,
        name: containerName,
        Tty: true,
        OpenStdin: true,
        Env: isDatabase && dbTemplate?.env
          ? Object.entries(dbTemplate.env).map(([k, v]) => `${k}=${v}`)
          : undefined,
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped' },
          AutoRemove: false
        },
        Labels: {
          'envmanager.language': lang,
          'envmanager.version': version,
          'envmanager.project': projectPath,
          'envmanager.created': new Date().toISOString()
        }
      }

      if (isDatabase && dbTemplate) {
        // Database: map default ports, no workspace bind
        createOpts.HostConfig!.PortBindings = {}
        for (const p of dbTemplate.defaultPorts) {
          const hostPort = await findFreePort(p.host, p.host + 100)
          createOpts.HostConfig!.PortBindings![`${p.container}/tcp`] = [{ HostPort: String(hostPort) }]
        }
      } else {
        // Dev environment: bind workspace + SSH port
        createOpts.WorkingDir = '/workspace'
        createOpts.HostConfig!.Binds = [`${projectPath}:/workspace`]
        createOpts.HostConfig!.PortBindings = { '22/tcp': [{ HostPort: String(sshPort) }] }
      }

      container = await docker.createContainer(createOpts)

      // Phase 4: Start
      creationTasks.set(taskId, { phase: '正在启动容器...', done: false })
      await container.start()

      // Phase 5: Environment readiness check
      creationTasks.set(taskId, { phase: '正在验证环境就绪...', done: false })
      await new Promise((r) => setTimeout(r, 2000))
      const inspect = await container.inspect()
      if (!inspect.State.Running) {
        throw new Error('容器启动失败')
      }

      // Verify the language runtime actually works
      const versionCommands: Record<string, string> = {
        python: 'python --version 2>&1 || python3 --version 2>&1',
        node: 'node --version 2>&1',
        java: 'java -version 2>&1',
        go: 'go version 2>&1',
        rust: 'rustc --version 2>&1',
        cpp: 'gcc --version 2>&1 | head -1',
        mysql: 'mysql --version 2>&1',
        postgres: 'psql --version 2>&1',
        redis: 'redis-server --version 2>&1',
        mongo: 'mongosh --version 2>&1 || mongod --version 2>&1 | head -1'
      }
      let verifiedVersion = ''
      try {
        const cmd = versionCommands[lang] || 'echo "no version check"'
        const exec = await container.exec({
          Cmd: ['/bin/sh', '-c', cmd],
          AttachStdout: true,
          AttachStderr: true
        })
        const output = await exec.start({ Detach: false, Tty: false })
        // dockerode exec output can be a stream or buffer
        if (Buffer.isBuffer(output)) {
          verifiedVersion = output.toString('utf8').trim()
        } else if (typeof output === 'string') {
          verifiedVersion = output.trim()
        }
        // Clean up: strip Docker header bytes if any
        verifiedVersion = verifiedVersion.replace(/[\x00-\x08]/g, '').replace(/\n/g, ' - ').substring(0, 80)
      } catch {
        verifiedVersion = '就绪'
      }

      creationTasks.set(taskId, {
        phase: 'done',
        containerId: container.id.substring(0, 12),
        sshPort,
        verifiedVersion: verifiedVersion || '就绪',
        done: true
      })
    } catch (err: any) {
      console.error(`[EnvManager] Creation failed:`, err.message)
      // Rollback
      if (container) {
        try { await container.remove({ force: true }) } catch { /* ignore */ }
      }
      creationTasks.set(taskId, {
        phase: `创建失败: ${err.message}`,
        error: err.message,
        done: true
      })
    }
  })

  // ====== 查询创建进度 ======
  app.get('/api/containers/create/:taskId', (req, res) => {
    const task = creationTasks.get(req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  })

  // ====== 停止容器 ======
  app.post('/api/containers/:id/stop', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const c = docker.getContainer(found.Id)
      await c.stop()
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 启动容器 ======
  app.post('/api/containers/:id/start', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const c = docker.getContainer(found.Id)
      await c.start()
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 销毁容器 ======
  app.delete('/api/containers/:id', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const c = docker.getContainer(found.Id)
      await c.remove({ force: true })
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 容器日志 ======
  app.get('/api/containers/:id/logs', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const c = docker.getContainer(found.Id)
      const stream = await c.logs({
        stdout: true,
        stderr: true,
        tail: 100,
        timestamps: true
      })

      res.setHeader('Content-Type', 'text/plain')
      // dockerode logs returns a stream
      if (Buffer.isBuffer(stream)) {
        res.send(stream.toString('utf8'))
      } else if (typeof stream === 'string') {
        res.send(stream)
      } else {
        let logs = ''
        ;(stream as any).on('data', (chunk: Buffer) => {
          logs += chunk.toString('utf8')
        })
        ;(stream as any).on('end', () => {
          // Strip Docker's 8-byte header from each line
          logs = logs.replace(/.{8}/g, '').replace(/[\x00-\x08]/g, '')
          res.send(logs)
        })
        ;(stream as any).on('error', (err: Error) => {
          res.status(500).json({ error: err.message })
        })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 在容器中执行命令 ======
  app.post('/api/containers/:id/exec', async (req, res) => {
    try {
      const { cmd } = req.body as { cmd: string[] }
      if (!cmd || cmd.length === 0) return res.status(400).json({ error: 'Command required' })

      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const c = docker.getContainer(found.Id)
      const exec = await c.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true
      })
      const output = await exec.start({ Detach: false, Tty: false })
      const result = Buffer.isBuffer(output) ? output.toString('utf8') : String(output || '')

      res.json({ output: result.replace(/[\x00-\x08]/g, '') })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 打开 VS Code / 终端 ======
  app.post('/api/containers/:id/open-vscode', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const detail = await getContainerDetail(found.Id)
      // Container name for docker exec -it (terminal fallback)
      res.json({
        containerName: detail.name,
        command: `docker exec -it ${detail.name} /bin/bash || docker exec -it ${detail.name} /bin/sh`
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 镜像列表 ======
  app.get('/api/images', async (_req, res) => {
    try {
      const images = await docker.listImages({ all: true })
      // Get container count for each image
      const containers = await docker.listContainers({ all: true })
      const imageContainerMap = new Map<string, number>()
      for (const c of containers) {
        imageContainerMap.set(c.Image, (imageContainerMap.get(c.Image) || 0) + 1)
        // Also check ImageID without sha256:
        const shortId = c.ImageID?.replace('sha256:', '').substring(0, 12) || ''
        imageContainerMap.set(shortId, (imageContainerMap.get(shortId) || 0) + 1)
      }

      const mapped = images.map((img) => {
        const tags = img.RepoTags || ['<none>:<none>']
        const isDangling = tags.length === 1 && tags[0] === '<none>:<none>'
        const containerCount = tags.reduce((sum, tag) => sum + (imageContainerMap.get(tag) || 0), 0)
        return {
          id: img.Id.replace('sha256:', '').substring(0, 12),
          repoTags: tags,
          size: img.Size,
          created: img.Created,
          containers: containerCount,
          isDangling
        }
      })
      res.json(mapped)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 拉取镜像 ======
  app.post('/api/images/pull', async (req, res) => {
    try {
      const { image } = req.body
      if (!image) return res.status(400).json({ error: 'Image name required' })

      await docker.pull(image)
      res.json({ success: true, message: 'Image pulled successfully' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 删除镜像 ======
  app.delete('/api/images/:id', async (req, res) => {
    try {
      const images = await docker.listImages({ all: true })
      const found = images.find((i) => i.Id.replace('sha256:', '').startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Image not found' })

      const img = docker.getImage(found.Id)
      await img.remove({ force: false })
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 清理镜像 ======
  app.post('/api/images/cleanup', async (_req, res) => {
    try {
      // Prune dangling images
      const result = await docker.pruneImages({ filters: { dangling: { '1': true } } })
      res.json({ success: true, removedCount: result.ImagesDeleted?.length || 0 })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

    // ====== 检查指定镜像是否已缓存 / 拉取状态 ======
  app.get('/api/images/check/:image(*)', async (req, res) => {
    try {
      const imageName = decodeURIComponent(req.params.image)
      const existing = await docker.listImages({ filters: { reference: [imageName] } })
      res.json({ cached: existing.length > 0, image: imageName })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 系统状态 ======
  // ====== 连接方式信息 ======
  app.get('/api/connection-info', (_req, res) => {
    res.json({
      platform: process.platform,
      dockerConfig: {
        socketPath: dockerConfig.socketPath || null,
        host: dockerConfig.host || null,
        port: dockerConfig.port || null
      },
      dockerHost: process.env['DOCKER_HOST'] || null
    })
  })

  // ====== 系统状态 ======
  app.get('/api/status', async (_req, res) => {
    try {
      const info = await docker.info()
      const containers = await docker.listContainers({ all: true })
      const envContainers = containers.filter((c) => c.Labels?.['envmanager.language'])
      const images = await docker.listImages({ all: true })

      // Calculate host memory usage
      let usedMemory = 0
      try {
        const allStats = await Promise.all(envContainers.map((c) =>
          docker.getContainer(c.Id).stats({ stream: false }).catch(() => null)
        ))
        usedMemory = allStats.reduce((sum, s) => sum + (s?.memory_stats?.usage || 0), 0)
      } catch { /* stats unavailable, keep 0 */ }

      res.json({
        docker: true,
        version: info.ServerVersion,
        containersRunning: envContainers.filter((c) => c.State === 'running').length,
        containersStopped: envContainers.filter((c) => c.State !== 'running').length,
        imagesCount: images.length,
        totalMemory: info.MemTotal || 0,
        usedMemory
      })
    } catch (err: any) {
      // 返回详细的错误信息，帮助诊断
      res.status(200).json({
        docker: false,
        error: err.message,
        connectionInfo: {
          platform: process.platform,
          dockerHost: process.env['DOCKER_HOST'] || null,
          triedPipes: process.platform === 'win32' ? [
            '//./pipe/docker_engine',
            '//./pipe/dockerDesktopLinuxEngine'
          ] : [],
          triedSockets: [
            '/var/run/docker.sock',
            path.join(os.homedir(), '.colima', 'default', 'docker.sock')
          ]
        }
      })
    }
  })

  server = app.listen(port, '127.0.0.1', () => {
    console.log(`[EnvManager] API Server running on http://127.0.0.1:${port}`)
  })
}
