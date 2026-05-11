import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectDirectory'),
  getApiPort: (): Promise<number> => ipcRenderer.invoke('envmanager:getApiPort'),
  openVscode: (command: string, path: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('envmanager:openVscode', command, path),
  openTerminal: (containerName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('envmanager:openTerminal', containerName),
  onMessage: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
