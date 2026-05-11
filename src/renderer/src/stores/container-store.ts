import { create } from 'zustand'
import type { RunningContainer, SystemStatus } from '@/types'
import { api } from '@/lib/api'

interface ContainerStore {
  containers: RunningContainer[]
  status: SystemStatus | null
  loading: boolean
  fetchContainers: () => Promise<void>
  fetchStatus: () => Promise<void>
  stopContainer: (id: string) => Promise<void>
  startContainer: (id: string) => Promise<void>
  deleteContainer: (id: string) => Promise<void>
  stopAll: () => Promise<void>
  deleteAll: () => Promise<void>
  addContainer: (c: RunningContainer) => void
  removeContainer: (id: string) => void
}

export const useContainerStore = create<ContainerStore>((set, get) => ({
  containers: [],
  status: null,
  loading: false,

  fetchContainers: async () => {
    set({ loading: true })
    try {
      const containers = await api.getContainers()
      set({ containers })
    } finally {
      set({ loading: false })
    }
  },

  fetchStatus: async () => {
    try {
      const status = await api.getStatus()
      set({ status })
    } catch {
      // ignore
    }
  },

  stopContainer: async (id: string) => {
    await api.stopContainer(id)
    set((s) => ({
      containers: s.containers.map((c) =>
        c.id === id ? { ...c, status: 'stopped' as const } : c
      )
    }))
  },

  startContainer: async (id: string) => {
    await api.startContainer(id)
    set((s) => ({
      containers: s.containers.map((c) =>
        c.id === id ? { ...c, status: 'running' as const } : c
      )
    }))
  },

  deleteContainer: async (id: string) => {
    await api.deleteContainer(id)
    set((s) => ({ containers: s.containers.filter((c) => c.id !== id) }))
  },

  stopAll: async () => {
    const { containers } = get()
    await Promise.all(
      containers.filter((c) => c.status === 'running').map((c) => api.stopContainer(c.id))
    )
    set((s) => ({
      containers: s.containers.map((c) => ({ ...c, status: 'stopped' as const }))
    }))
  },

  deleteAll: async () => {
    const { containers } = get()
    await Promise.all(containers.map((c) => api.deleteContainer(c.id)))
    set({ containers: [] })
  },

  addContainer: (c) => set((s) => ({ containers: [...s.containers, c] })),
  removeContainer: (id) => set((s) => ({ containers: s.containers.filter((c) => c.id !== id) }))
}))
