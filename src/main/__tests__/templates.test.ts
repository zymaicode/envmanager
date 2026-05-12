import { describe, it, expect } from 'vitest'
import { allTemplates, templates, databaseTemplates } from '../templates'

describe('templates', () => {
  it('should have 6 language templates', () => {
    expect(templates).toHaveLength(6)
    const ids = templates.map((t) => t.id)
    expect(ids).toContain('python')
    expect(ids).toContain('node')
    expect(ids).toContain('java')
    expect(ids).toContain('go')
    expect(ids).toContain('rust')
    expect(ids).toContain('cpp')
  })

  it('should have 4 database templates', () => {
    expect(databaseTemplates).toHaveLength(4)
    const ids = databaseTemplates.map((t) => t.id)
    expect(ids).toContain('mysql')
    expect(ids).toContain('postgres')
    expect(ids).toContain('redis')
    expect(ids).toContain('mongo')
  })

  it('should combine to 10 total templates', () => {
    expect(allTemplates).toHaveLength(10)
  })

  it('should have at least one LTS version per language', () => {
    for (const tpl of templates) {
      const lts = tpl.versions.filter((v) => v.isLTS)
      expect(lts.length).toBeGreaterThan(0)
    }
  })

  it('should have unique image names across versions', () => {
    for (const tpl of allTemplates) {
      const images = tpl.versions.map((v) => v.image)
      const unique = new Set(images)
      expect(unique.size).toBe(images.length)
    }
  })

  it('should have valid categories', () => {
    const validCategories = ['backend', 'frontend', 'data', 'systems']
    for (const tpl of allTemplates) {
      expect(validCategories).toContain(tpl.category)
    }
  })

  it('database templates should have defaultPorts', () => {
    for (const tpl of databaseTemplates) {
      expect(tpl.defaultPorts).toBeDefined()
      expect(tpl.defaultPorts!.length).toBeGreaterThan(0)
    }
  })

  it('all versions should have non-empty image strings', () => {
    for (const tpl of allTemplates) {
      for (const ver of tpl.versions) {
        expect(ver.image).toBeTruthy()
        expect(ver.version).toBeTruthy()
        expect(ver.tools.length).toBeGreaterThan(0)
      }
    }
  })
})
