import Docker from 'dockerode'
import path from 'path'
import os from 'os'
import fs from 'fs'

// ====== Docker 连接方式自动探测 ======
export function detectDockerConnection(): { socketPath?: string; host?: string; port?: number } {
  const envHost = process.env['DOCKER_HOST']
  if (envHost) {
    console.log(`[EnvManager] Docker: using DOCKER_HOST = ${envHost}`)
    const match = envHost.match(/^(tcp:\/\/)?(.+):(\d+)$/)
    if (match) {
      return { host: match[2], port: parseInt(match[3]) }
    }
    return { socketPath: envHost.replace('unix://', '') }
  }

  if (process.platform === 'win32') {
    const windowsPipes = [
      '//./pipe/docker_engine',
      '//./pipe/dockerDesktopLinuxEngine',
      '//./pipe/DockerDesktopLinuxEngine'
    ]
    for (const pipe of windowsPipes) {
      try {
        if (fs.statSync(pipe)) {
          console.log(`[EnvManager] Docker: using named pipe ${pipe}`)
          return { socketPath: pipe }
        }
      } catch { /* pipe not available */ }
    }
  }

  const unixSockets = [
    '/var/run/docker.sock',
    path.join(os.homedir(), '.docker', 'run', 'docker.sock'),
    path.join(os.homedir(), '.colima', 'default', 'docker.sock'),
    path.join(os.homedir(), '.colima', 'docker.sock'),
    path.join(os.homedir(), '.rd', 'docker.sock'),
    '/run/user/1000/podman/podman.sock',
  ]
  for (const sock of unixSockets) {
    if (fs.existsSync(sock)) {
      console.log(`[EnvManager] Docker: using unix socket ${sock}`)
      return { socketPath: sock }
    }
  }

  console.log('[EnvManager] Docker: using default connection (dockerode auto-detect)')
  return {}
}

const dockerConfig = detectDockerConnection()
export const docker = new Docker(dockerConfig)

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

/** 端口类型分类：SSH / Web 开发端口 / 自定义 */
function classifyPort(port: number): 'ssh' | 'web' | 'custom' {
  if (port === 22) return 'ssh'
  if ([3000, 8080, 5000, 8000, 9000].includes(port)) return 'web'
  return 'custom'
}

/** 探测空闲端口 */
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

/** 容器运行时版本检测命令 */
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

/**
 * 转换 Windows 路径为容器内挂载路径。
 * 默认使用 WSL2 路径映射 (C:\ → /mnt/c/)。
 * 未来可扩展：通过 wsl -d <distro> wslpath -a <winpath> 探测真实 WSL 路径。
 */
export function normalizeProjectPath(rawPath: string): string {
  if (process.platform === 'win32') {
    return rawPath.replace(/^([A-Z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
  }
  return rawPath
}
