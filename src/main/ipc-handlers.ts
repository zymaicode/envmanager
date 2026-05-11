import { ipcMain, dialog, shell } from 'electron'
import { exec, spawn } from 'child_process'

export function registerIpcHandlers(): void {
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('envmanager:getApiPort', () => {
    return 20920
  })

  ipcMain.handle('envmanager:openVscode', async (_event, command: string, path: string) => {
    try {
      await new Promise<void>((resolve, reject) => {
        exec(command, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
      return { success: true }
    } catch {
      try {
        await shell.openPath(path)
        return { success: true }
      } catch {
        return { success: false, error: 'VS Code not found' }
      }
    }
  })

  ipcMain.handle('envmanager:openTerminal', async (_event, containerName: string) => {
    // Open a system terminal with docker exec -it
    try {
      if (process.platform === 'win32') {
        exec(`start "终端 - ${containerName}" cmd /c "docker exec -it ${containerName} /bin/bash || docker exec -it ${containerName} /bin/sh"`)
      } else if (process.platform === 'darwin') {
        exec(`osascript -e 'tell app "Terminal" to do script "docker exec -it ${containerName} /bin/bash || docker exec -it ${containerName} /bin/sh"'`)
      } else {
        exec(`x-terminal-emulator -e "docker exec -it ${containerName} /bin/bash || docker exec -it ${containerName} /bin/sh"`)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
