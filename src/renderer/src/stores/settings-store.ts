import { create } from 'zustand'

export interface Settings {
  sshPortRange: [number, number]
  devPorts: number[]
  mountPath: string
  dockerSocketPath: string
  mirrorUrl: string
  autoCleanup: 'never' | 'stop' | 'destroy' | 'stop-all'
  vscodePath: string
}

interface SettingsStore {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void
  resetSettings: () => void
}

const defaults: Settings = {
  sshPortRange: [22000, 30000],
  devPorts: [3000, 8080, 5000, 8000, 9000],
  mountPath: '/workspace',
  dockerSocketPath: '',
  mirrorUrl: '',
  autoCleanup: 'never',
  vscodePath: ''
}

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem('envmanager-settings')
    if (stored) return { ...defaults, ...JSON.parse(stored) }
  } catch {
    // ignore
  }
  return defaults
}

function saveSettings(settings: Settings): void {
  localStorage.setItem('envmanager-settings', JSON.stringify(settings))
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: loadSettings(),

  updateSettings: (partial) =>
    set((s) => {
      const updated = { ...s.settings, ...partial }
      saveSettings(updated)
      return { settings: updated }
    }),

  resetSettings: () => {
    saveSettings(defaults)
    set({ settings: defaults })
  }
}))
