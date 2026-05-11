export interface EnvironmentVersion {
  version: string
  image: string
  size: string
  tools: string[]
  isLTS: boolean
}

export interface EnvironmentTemplate {
  id: string
  name: string
  icon: string
  color: string
  description: string
  category: 'backend' | 'frontend' | 'data' | 'systems'
  versions: EnvironmentVersion[]
}

export interface ContainerPort {
  container: number
  host: number
  type: 'ssh' | 'web' | 'custom'
}

export interface ContainerMount {
  source: string
  destination: string
}

export interface ContainerState {
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  health?: 'healthy' | 'unhealthy' | 'starting'
}

export interface ContainerResources {
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
}

export type ContainerStatus = 'running' | 'stopped' | 'exited' | 'dead' | 'paused'

export interface RunningContainer {
  id: string
  dockerId: string
  name: string
  image: string
  language: string
  version: string
  status: ContainerStatus
  state: ContainerState
  ports: ContainerPort[]
  mounts: ContainerMount[]
  resources: ContainerResources
  projectPath: string
  createdAt: string
}

export interface LocalImage {
  id: string
  repoTags: string[]
  size: number
  created: number
  containers: number
  isDangling: boolean
}

export interface SystemStatus {
  docker: boolean
  version: string
  containersRunning: number
  containersStopped: number
  imagesCount: number
  totalMemory: number
  usedMemory: number
}

export interface CreateContainerRequest {
  lang: string
  version: string
  projectPath: string
}

export interface CreateContainerResponse {
  taskId: string
}

export interface CreateProgress {
  phase: string
  containerId?: string
  sshPort?: number
  error?: string
  done: boolean
}

export interface OpenVscodeResponse {
  command: string
  host: string
  port: number
}

declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string | null>
      getApiPort: () => Promise<number>
      openVscode: (command: string, path: string) => Promise<{ success: boolean; error?: string }>
      openTerminal: (containerName: string) => Promise<{ success: boolean; error?: string }>
      onMessage: (channel: string, callback: (...args: unknown[]) => void) => void
    }
  }
}
