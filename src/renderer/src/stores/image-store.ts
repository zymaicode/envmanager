import { create } from 'zustand'
import type { LocalImage } from '@/types'
import { api } from '@/lib/api'

interface ImageStore {
  images: LocalImage[]
  loading: boolean
  pullLoading: boolean
  fetchImages: () => Promise<void>
  pullImage: (image: string) => Promise<void>
  deleteImage: (id: string) => Promise<void>
  cleanupImages: () => Promise<number>
}

export const useImageStore = create<ImageStore>((set) => ({
  images: [],
  loading: false,
  pullLoading: false,

  fetchImages: async () => {
    set({ loading: true })
    try {
      const images = await api.getImages()
      set({ images })
    } finally {
      set({ loading: false })
    }
  },

  pullImage: async (image: string) => {
    set({ pullLoading: true })
    try {
      await api.pullImage(image)
      // Refresh list after pull
      const images = await api.getImages()
      set({ images })
    } finally {
      set({ pullLoading: false })
    }
  },

  deleteImage: async (id: string) => {
    await api.deleteImage(id)
    set((s) => ({ images: s.images.filter((i) => i.id !== id) }))
  },

  cleanupImages: async () => {
    const res = await api.cleanupImages()
    const images = await api.getImages()
    set({ images })
    return res.removedCount
  }
}))
