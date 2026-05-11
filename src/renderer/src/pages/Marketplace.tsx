import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Search, X, ChevronRight, Check, Loader2, FolderOpen, AlertTriangle } from 'lucide-react'
import { useMarketplaceStore } from '@/stores/marketplace-store'
import { useContainerStore } from '@/stores/container-store'
import { cn } from '@/lib/utils'
import type { EnvironmentTemplate, EnvironmentVersion } from '@/types'
import { useState } from 'react'

export function Marketplace(): JSX.Element {
  const {
    loading,
    searchQuery,
    setSearchQuery,
    selectedTemplate,
    selectedVersion,
    selectTemplate,
    selectVersion,
    creatingContainer,
    createProgress,
    createError,
    createErrorType,
    fetchTemplates,
    getFilteredTemplates,
    createContainer,
    resetCreateState
  } = useMarketplaceStore()

  const { fetchContainers } = useContainerStore()

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [projectPath, setProjectPath] = useState('')
  const [showProjectInput, setShowProjectInput] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ containerId: string; sshPort: number } | null>(null)

  useEffect(() => {
    fetchTemplates()
    // Check for pre-selected language/version from URL params (clone flow)
    const langParam = searchParams.get('lang')
    const versionParam = searchParams.get('version')
    if (langParam && versionParam) {
      // Need to wait for templates to load, then select
      const checkAndSelect = (): void => {
        const tpl = getFilteredTemplates().find((t) => t.id === langParam)
        if (tpl) {
          selectTemplate(tpl)
          selectVersion(versionParam)
        }
      }
      // Templates loaded synchronously via store, check on next tick
      setTimeout(checkAndSelect, 200)
    }
  }, [fetchTemplates])

  const filtered = getFilteredTemplates()

  const handleStartEnvironment = async (version: EnvironmentVersion): Promise<void> => {
    if (!selectedTemplate || !projectPath.trim()) return
    try {
      const result = await createContainer(selectedTemplate.id, version.version, projectPath)
      setCreatedInfo(result)
      await fetchContainers()
    } catch {
      // error handled by store
    }
  }

  const handleSelectDirectory = async (): Promise<void> => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.selectDirectory()
      if (dir) setProjectPath(dir)
    } else {
      // Fallback for browser dev
      setProjectPath(prompt('请输入项目目录路径:', '/path/to/project') || '')
    }
  }

  const closeDrawer = (): void => {
    resetCreateState()
    setShowProjectInput(false)
    setProjectPath('')
    setCreatedInfo(null)
  }

  const iconMap: Record<string, string> = {
    python: '🐍',
    nodejs: '⬢',
    java: '☕',
    go: '🔵',
    rust: '🦀',
    cpp: '⚙️'
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg-content)' }}>
      {/* Search Bar */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          环境市场
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          选择一个技术栈，快速创建容器化开发环境
        </p>
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            placeholder="搜索语言、版本或工具..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:ring-2"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)'
            }}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <EnvironmentCard
              key={template.id}
              template={template}
              icon={iconMap[template.icon] || '📦'}
              onClick={() => selectTemplate(template)}
            />
          ))}
        </div>
      )}

      {/* Version Drawer */}
      {selectedTemplate && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 transition-opacity"
            onClick={closeDrawer}
          />
          <div
            className="fixed right-0 top-0 z-50 h-full w-[420px] overflow-y-auto p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{iconMap[selectedTemplate.icon] || '📦'}</span>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {selectedTemplate.name}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {selectedTemplate.versions.length} 个可用版本
                  </p>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-lg p-1.5 transition-colors hover:bg-black/5"
              >
                <X size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {selectedTemplate.description}
            </p>

            {/* Project Path Input */}
            <div className="mb-6">
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                项目目录
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="选择项目代码目录..."
                  value={projectPath}
                  readOnly
                  className="flex-1 rounded-lg border py-2 px-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--color-bg-primary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)'
                  }}
                />
                <button
                  onClick={handleSelectDirectory}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-black/5"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  <FolderOpen size={14} />
                  浏览
                </button>
              </div>
            </div>

            {/* Version List */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                选择版本
              </h3>
              {selectedTemplate.versions.map((ver) => (
                <VersionItem
                  key={ver.version}
                  version={ver}
                  isSelected={selectedVersion === ver.version}
                  isCreating={creatingContainer && selectedVersion === ver.version}
                  projectPath={projectPath}
                  onSelect={() => {
                    selectVersion(ver.version)
                    setCreatedInfo(null)
                  }}
                  onCreate={() => handleStartEnvironment(ver)}
                />
              ))}
            </div>

            {/* Creating Progress */}
            {creatingContainer && (
              <div className="mt-4 rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {createProgress}
                </span>
              </div>
            )}

            {/* Error Display */}
            {createError && !creatingContainer && (
              <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: '#FFF5F2' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} style={{ color: 'var(--color-status-red)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-status-red)' }}>
                    {createError}
                  </span>
                </div>
                {createErrorType === 'IMAGE_NOT_FOUND' && (
                  <button
                    onClick={() => navigate('/images')}
                    className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: 'var(--color-accent)',
                      color: '#FFFFFF'
                    }}
                  >
                    前往镜像管理页面拉取镜像
                  </button>
                )}
              </div>
            )}

            {/* Created Success */}
            {createdInfo && !creatingContainer && !createError && (
              <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: 'var(--color-accent-light)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Check size={16} style={{ color: 'var(--color-status-green)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    环境创建成功
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  SSH 端口: {createdInfo.sshPort} · ID: {createdInfo.containerId}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function EnvironmentCard({
  template,
  icon,
  onClick
}: {
  template: EnvironmentTemplate
  icon: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border)'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)'
          }}
        >
          {template.versions.length} 版本
        </span>
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        {template.name}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {template.description}
      </p>
      <div
        className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: 'var(--color-accent)' }}
      >
        选择版本 <ChevronRight size={12} />
      </div>
    </button>
  )
}

function VersionItem({
  version,
  isSelected,
  isCreating,
  projectPath,
  onSelect,
  onCreate
}: {
  version: EnvironmentVersion
  isSelected: boolean
  isCreating: boolean
  projectPath: string
  onSelect: () => void
  onCreate: () => void
}): JSX.Element {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-4 transition-all cursor-pointer',
        isSelected && 'ring-2'
      )}
      style={{
        backgroundColor: isSelected ? 'var(--color-accent-light)' : 'var(--color-bg-primary)',
        borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border)',
        ...(isSelected ? { '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties : {})
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            v{version.version}
          </span>
          {version.isLTS && (
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: '#FFFFFF'
              }}
            >
              LTS
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          ~{version.size}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {version.tools.map((tool) => (
          <span
            key={tool}
            className="rounded-md px-1.5 py-0.5 text-xs"
            style={{
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)'
            }}
          >
            {tool}
          </span>
        ))}
      </div>

      {isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCreate()
          }}
          disabled={isCreating || !projectPath.trim()}
          className="mt-2 w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#FFFFFF'
          }}
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              创建中...
            </span>
          ) : !projectPath.trim() ? (
            '请先选择项目目录'
          ) : (
            '启动环境'
          )}
        </button>
      )}
    </div>
  )
}
