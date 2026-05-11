import { create } from 'zustand'
import type { EnvironmentTemplate, CreateContainerResponse } from '@/types'
import { api } from '@/lib/api'

interface MarketplaceStore {
  templates: EnvironmentTemplate[]
  loading: boolean
  searchQuery: string
  selectedTemplate: EnvironmentTemplate | null
  selectedVersion: string | null
  createError: string
  createErrorType: string
  creatingContainer: boolean
  createProgress: string
  fetchTemplates: () => Promise<void>
  setSearchQuery: (q: string) => void
  selectTemplate: (t: EnvironmentTemplate | null) => void
  selectVersion: (v: string | null) => void
  createContainer: (lang: string, version: string, projectPath: string) => Promise<{ containerId: string; sshPort: number }>
  resetCreateState: () => void
  getFilteredTemplates: () => EnvironmentTemplate[]
}

export const useMarketplaceStore = create<MarketplaceStore>((set, get) => ({
  templates: [],
  loading: false,
  searchQuery: '',
  selectedTemplate: null,
  selectedVersion: null,
  creatingContainer: false,
  createProgress: '',
  createError: '',
  createErrorType: '',

  fetchTemplates: async () => {
    set({ loading: true })
    try {
      const templates = await api.getEnvironments()
      set({ templates })
    } finally {
      set({ loading: false })
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  selectTemplate: (t) => set({ selectedTemplate: t, selectedVersion: null }),

  selectVersion: (v) => set({ selectedVersion: v }),

  createContainer: async (lang, version, projectPath) => {
    set({ creatingContainer: true, createProgress: '正在创建环境...', createError: '', createErrorType: '' })

    try {
      // Start creation (returns taskId immediately)
      const { taskId } = await api.createContainer({ lang, version, projectPath })

      // Poll for progress
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500))
        const progress = await api.getCreateProgress(taskId)
        set({ createProgress: progress.phase })

        if (progress.done) {
          if (progress.error) {
            if (progress.error === 'IMAGE_NOT_FOUND') {
              set({
                creatingContainer: false,
                createProgress: '',
                createError: '镜像未下载，请先在「镜像管理」页面拉取该镜像',
                createErrorType: 'IMAGE_NOT_FOUND'
              })
              throw new Error('IMAGE_NOT_FOUND')
            }
            set({
              creatingContainer: false,
              createProgress: '',
              createError: progress.phase,
              createErrorType: 'UNKNOWN'
            })
            throw new Error(progress.phase)
          }
          set({ creatingContainer: false, createProgress: '', createError: '', createErrorType: '' })
          return { containerId: progress.containerId!, sshPort: progress.sshPort! }
        }
      }
      throw new Error('创建超时，请检查 Docker 是否正常运行')
    } catch (err: any) {
      if (err.message !== 'IMAGE_NOT_FOUND') {
        set({
          creatingContainer: false,
          createProgress: '',
          createError: err.message || '创建失败',
          createErrorType: 'UNKNOWN'
        })
      }
      throw err
    }
  },

  resetCreateState: () => set({ selectedTemplate: null, selectedVersion: null }),

  getFilteredTemplates: () => {
    const { templates, searchQuery } = get()
    if (!searchQuery.trim()) return templates
    const q = searchQuery.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.versions.some(
          (v) =>
            v.version.includes(q) ||
            v.tools.some((tool) => tool.toLowerCase().includes(q))
        )
    )
  }
}))
