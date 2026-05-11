import type {
  EnvironmentTemplate,
  RunningContainer,
  LocalImage,
  SystemStatus,
  CreateContainerRequest,
  CreateContainerResponse,
  OpenVscodeResponse
} from '@/types'

const BASE_URL = 'http://127.0.0.1:20920'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Environments
  getEnvironments: () => request<EnvironmentTemplate[]>('/api/environments'),

  // Containers
  getContainers: () => request<RunningContainer[]>('/api/containers'),
  getContainer: (id: string) => request<RunningContainer>(`/api/containers/${id}`),
  createContainer: (data: CreateContainerRequest) =>
    request<{ taskId: string }>('/api/containers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getCreateProgress: (taskId: string) =>
    request<{ phase: string; containerId?: string; sshPort?: number; error?: string; done: boolean }>(`/api/containers/create/${taskId}`),
  deleteContainer: (id: string) =>
    request<{ success: boolean }>(`/api/containers/${id}`, { method: 'DELETE' }),
  stopContainer: (id: string) =>
    request<{ success: boolean }>(`/api/containers/${id}/stop`, { method: 'POST' }),
  startContainer: (id: string) =>
    request<{ success: boolean }>(`/api/containers/${id}/start`, { method: 'POST' }),
  getContainerLogs: (id: string) =>
    request<string>(`/api/containers/${id}/logs`),
  openVscode: (id: string) =>
    request<OpenVscodeResponse>(`/api/containers/${id}/open-vscode`, { method: 'POST' }),

  // Images
  getImages: () => request<LocalImage[]>('/api/images'),
  pullImage: (image: string) =>
    request<{ success: boolean }>('/api/images/pull', {
      method: 'POST',
      body: JSON.stringify({ image })
    }),
  deleteImage: (id: string) =>
    request<{ success: boolean }>(`/api/images/${id}`, { method: 'DELETE' }),
  cleanupImages: () =>
    request<{ success: boolean; removedCount: number }>('/api/images/cleanup', { method: 'POST' }),
  checkImageCached: (image: string) =>
    request<{ cached: boolean; image: string }>(`/api/images/check/${encodeURIComponent(image)}`),

  // System
  getStatus: () => request<SystemStatus>('/api/status')
}
