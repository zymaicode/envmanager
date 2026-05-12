import { describe, it, expect } from 'vitest'

// Test pure functions — import directly, no Docker needed

describe('normalizeProjectPath', () => {
  it('should convert Windows path to WSL2 format', async () => {
    // Import the function dynamically to avoid platform-specific module loading
    const { normalizeProjectPath } = await import('../docker')
    // On any platform, forward slashes are converted
    const result = normalizeProjectPath('C:\\Users\\dev\\project')
    expect(result).not.toContain('\\')
    expect(result).toContain('project')
  })

  it('should preserve Unix paths', async () => {
    const { normalizeProjectPath } = await import('../docker')
    const result = normalizeProjectPath('/home/dev/project')
    expect(result).toBe('/home/dev/project')
  })
})

describe('VERSION_COMMANDS', () => {
  it('should have commands for all supported languages', async () => {
    const { VERSION_COMMANDS } = await import('../docker')
    expect(VERSION_COMMANDS).toHaveProperty('python')
    expect(VERSION_COMMANDS).toHaveProperty('node')
    expect(VERSION_COMMANDS).toHaveProperty('java')
    expect(VERSION_COMMANDS).toHaveProperty('go')
    expect(VERSION_COMMANDS).toHaveProperty('rust')
    expect(VERSION_COMMANDS).toHaveProperty('cpp')
    expect(VERSION_COMMANDS).toHaveProperty('mysql')
    expect(VERSION_COMMANDS).toHaveProperty('postgres')
    expect(VERSION_COMMANDS).toHaveProperty('redis')
    expect(VERSION_COMMANDS).toHaveProperty('mongo')
  })

  it('should have valid version check commands', async () => {
    const { VERSION_COMMANDS } = await import('../docker')
    for (const [lang, cmd] of Object.entries(VERSION_COMMANDS)) {
      expect(cmd).toBeTruthy()
      expect(typeof cmd).toBe('string')
      // Each command should include --version or similar
      expect(cmd).toMatch(/version|echo/)
    }
  })
})
