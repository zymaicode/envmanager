import Docker from 'dockerode'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ====== Docker 连接方式自动探测 ======
// 用实际 API 调用来验证连通性，而非文件系统检测（Named Pipe 不是文件）
async function probeConnection(config: { socketPath?: string; host?: string; port?: number }): Promise<boolean> {
  try {
    const testDocker = new Docker(config)
    const info = await testDocker.info()
    console.log(`[EnvManager] Docker probe OK: ${info.ServerVersion} ${config.socketPath || config.host || 'default'}`)
    return true
  } catch {
    return false
  }
}

export async function detectDockerConnection(): Promise<{ socketPath?: string; host?: string; port?: number }> {
  // 1. 默认连接（dockerode 内部自动检测 DOCKER_HOST / docker context）
  if (await probeConnection({})) {
    console.log('[EnvManager] Docker: default connection OK')
    return {}
  }

  // 2. TCP 连接（通过 DOCKER_HOST 环境变量明确指定）
  const envHost = process.env['DOCKER_HOST']
  if (envHost) {
    const tcpMatch = envHost.match(/^tcp:\/\/(.+):(\d+)$/)
    if (tcpMatch) {
      const config = { host: tcpMatch[1], port: parseInt(tcpMatch[2]) }
      if (await probeConnection(config)) return config
    }
    const unixPath = envHost.replace('unix://', '')
    if (unixPath && (await probeConnection({ socketPath: unixPath }))) {
      return { socketPath: unixPath }
    }
  }

  // 3. Windows Named Pipe（Docker Desktop 两种）
  if (process.platform === 'win32') {
    const pipes = ['//./pipe/docker_engine', '//./pipe/dockerDesktopLinuxEngine']
    for (const p of pipes) {
      if (await probeConnection({ socketPath: p })) {
        console.log(`[EnvManager] Docker: connected via ${p}`)
        return { socketPath: p }
      }
    }
  }

  // 4. Unix socket 系列（macOS / Linux 的各种 Docker 发行版）
  const unixCandidates = [
    '/var/run/docker.sock',
    path.join(os.homedir(), '.docker', 'run', 'docker.sock'),
    path.join(os.homedir(), '.colima', 'default', 'docker.sock'),
    path.join(os.homedir(), '.colima', 'docker.sock'),
    path.join(os.homedir(), '.rd', 'docker.sock'),
    '/run/user/1000/podman/podman.sock',
  ]
  for (const sock of unixCandidates) {
    if (fs.existsSync(sock)) {
      if (await probeConnection({ socketPath: sock })) {
        console.log(`[EnvManager] Docker: connected via ${sock}`)
        return { socketPath: sock }
      }
    }
  }

  console.error('[EnvManager] Docker: ALL connection methods failed')
  return {}
}

// 全局 docker 实例（export 给 routes 等模块引用）
// 初始用 dockerode 默认连接，initDockerConnection 会重新创建正确连接的实例
export let docker = new Docker()

// 启动后台探测，成功后替换全局 docker 实例
// Docker Desktop 启动后需要一些时间就绪，带重试
export async function initDockerConnection(maxRetries = 3): Promise<boolean> {
  const config = await detectDockerConnection()
  docker = new Docker(Object.keys(config).length > 0 ? config : {})

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await docker.info()
      console.log(`[EnvManager] Docker connected: v${info.ServerVersion}`)
      return true
    } catch (err: any) {
      console.error(`[EnvManager] Docker attempt ${attempt}/${maxRetries} failed: ${err.message}`)
      if (attempt < maxRetries) {
        console.log('[EnvManager] Retrying in 3s...')
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }
  console.error('[EnvManager] Docker: all reconnection attempts failed')
  return false
}

// ====== 辅助函数：解析 Docker 容器数据 ======
export function mapContainer(info: Docker.ContainerInfo) {
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
        type: classifyPort(p.PrivatePort)
      })),
    projectPath: labels['envmanager.project'] || '',
    createdAt: info.Created ? new Date(info.Created * 1000).toISOString() : ''
  }
}

export async function getContainerDetail(containerId: string) {
  const c = docker.getContainer(containerId)
  const info = await c.inspect()
  const stats = await c.stats({ stream: false })
  const labels = info.Config.Labels || {}
  const ports = info.NetworkSettings?.Ports || {}

  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
  const cpuCount = stats.cpu_stats.online_cpus || 1
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0

  const memUsage = stats.memory_stats.usage || 0
  const memLimit = stats.memory_stats.limit || 0

  const allPorts: { container: number; host: number | null; type: string }[] = []
  for (const [privatePort, bindings] of Object.entries(ports)) {
    const portNum = parseInt(privatePort.split('/')[0])
    const hostPort = bindings && bindings.length > 0 ? parseInt(bindings[0].HostPort) : null
    allPorts.push({
      container: portNum,
      host: hostPort || portNum,
      type: classifyPort(portNum)
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

function classifyPort(port: number): 'ssh' | 'web' | 'custom' {
  if (port === 22) return 'ssh'
  if ([3000, 8080, 5000, 8000, 9000].includes(port)) return 'web'
  return 'custom'
}

export async function findFreePort(start: number, end: number): Promise<number> {
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

export const VERSION_COMMANDS: Record<string, string> = {
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

export function normalizeProjectPath(rawPath: string): string {
  if (process.platform === 'win32') {
    return rawPath.replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
  }
  return rawPath
}
