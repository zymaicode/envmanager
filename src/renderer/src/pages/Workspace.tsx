import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Loader2, Play, Square, Trash2, Terminal, Globe, AlertTriangle, Plus, Code, Edit3 } from 'lucide-react'
import { useContainerStore } from '@/stores/container-store'
import { formatBytes, formatUptime } from '@/lib/utils'
import type { RunningContainer, ContainerStatus } from '@/types'

export function Workspace(): JSX.Element {
  const { containers, loading, fetchContainers, fetchStatus, stopContainer, startContainer, deleteContainer, stopAll, deleteAll } =
    useContainerStore()

  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [logsContainerId, setLogsContainerId] = useState<string | null>(null)
  const [logs, setLogs] = useState('')
  const [diskUsage, setDiskUsage] = useState<{ reclaimable: number } | null>(null)

  useEffect(() => {
    fetchContainers()
    fetchStatus()
    const loadDisk = async (): Promise<void> => {
      try {
        const { api: apiModule } = await import('@/lib/api')
        const usage = await apiModule.getDiskUsage()
        setDiskUsage(usage)
      } catch { /* ignore */ }
    }
    loadDisk()
  }, [fetchContainers, fetchStatus])

  const statusLabel: Record<ContainerStatus, string> = {
    running: '运行中',
    stopped: '已停止',
    exited: '已退出',
    dead: '异常',
    paused: '已暂停'
  }

  const statusColor: Record<ContainerStatus, string> = {
    running: 'var(--color-status-green)',
    stopped: 'var(--color-status-yellow)',
    exited: 'var(--color-text-muted)',
    dead: 'var(--color-status-red)',
    paused: 'var(--color-text-muted)'
  }

  const running = containers.filter((c) => c.status === 'running').length
  const stopped = containers.filter((c) => c.status === 'stopped').length
  const dead = containers.filter((c) => c.status === 'dead').length

  const handleDelete = async (id: string): Promise<void> => {
    await deleteContainer(id)
    setDeleteConfirm(null)
  }

  const handleOpenTerminal = async (containerName: string): Promise<void> => {
    if (window.electronAPI?.openTerminal) {
      await window.electronAPI.openTerminal(containerName)
    }
  }

  const handleCloneEnvironment = (container: RunningContainer): void => {
    navigate(`/marketplace?lang=${container.language}&version=${container.version}`)
  }

  const [editContainer, setEditContainer] = useState<RunningContainer | null>(null)
  const [editPorts, setEditPorts] = useState<{ container: number; host: number }[]>([])
  const [editSaving, setEditSaving] = useState(false)

  const handleOpenEdit = async (container: RunningContainer): Promise<void> => {
    setEditContainer(container)
    try {
      const { api: apiModule } = await import('@/lib/api')
      const config = await apiModule.getContainerConfig(container.id)
      setEditPorts(config.ports.map((p: any) => ({ container: p.container, host: p.host })))
    } catch {
      setEditPorts(container.ports.map((p) => ({ container: p.container, host: p.host })))
    }
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!editContainer) return
    setEditSaving(true)
    try {
      const { api: apiModule } = await import('@/lib/api')
      await apiModule.updateContainerConfig(editContainer.id, { ports: editPorts })
      await fetchContainers()
      setEditContainer(null)
    } catch (err) {
      console.error('Config update failed:', err)
    }
    setEditSaving(false)
  }

  const getOpenBrowser = (container: RunningContainer): (() => void) | null => {
    const webPort = container.ports.find((p) => p.type === 'web')
    if (!webPort) return null
    return () => window.open(`http://localhost:${webPort.host}`, '_blank')
  }

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg-content)' }}>
      {/* Stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            我的工作台
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            管理所有运行中的开发环境
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={13} /> 新建环境
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            {viewMode === 'card' ? '表格视图' : '卡片视图'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="运行中" value={running} color="var(--color-status-green)" />
        <StatCard label="已停止" value={stopped} color="var(--color-status-yellow)" />
        <StatCard label="异常" value={dead} color="var(--color-status-red)" />
        <StatCard label="总计" value={containers.length} color="var(--color-accent)" />
      </div>

      {/* Disk Usage */}
      {diskUsage && diskUsage.reclaimable > 0 && (
        <div className="rounded-xl border p-4 mb-4 flex items-center justify-between" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              可回收空间
            </span>
            <span className="text-sm ml-2" style={{ color: 'var(--color-text-secondary)' }}>
              {formatBytes(diskUsage.reclaimable)}
            </span>
            <span className="text-xs ml-3" style={{ color: 'var(--color-text-muted)' }}>
              来自未使用的镜像和构建缓存
            </span>
          </div>
          <button
            onClick={async () => {
              try {
                const { api: apiModule } = await import('@/lib/api')
                await apiModule.cleanupImages()
                await fetchContainers()
                setDiskUsage(null)
              } catch { /* ignore */ }
            }}
            className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            一键清理
          </button>
        </div>
      )}

      {/* Global Actions */}
      {containers.length > 0 && (
        <div className="flex gap-2 mb-4">
          {running > 0 && (
            <button
              onClick={stopAll}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <Square size={12} /> 停止所有
            </button>
          )}
          {deleteAllConfirm ? (
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: 'var(--color-status-red)' }} />
              <span className="text-xs" style={{ color: 'var(--color-status-red)' }}>确认销毁所有环境？</span>
              <button
                onClick={async () => { await deleteAll(); setDeleteAllConfirm(false) }}
                className="rounded px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--color-status-red)' }}
              >
                确认
              </button>
              <button
                onClick={() => setDeleteAllConfirm(false)}
                className="rounded px-2 py-1 text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-red-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-status-red)' }}
            >
              <Trash2 size={12} /> 销毁所有
            </button>
          )}
        </div>
      )}

      {/* Container List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : containers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Code size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            暂无运行中的环境
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            前往环境市场创建你的第一个开发环境
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {containers.map((c) => (
            <ContainerCard
              key={c.id}
              container={c}
              statusLabel={statusLabel}
              statusColor={statusColor}
              onStop={() => stopContainer(c.id)}
              onStart={() => startContainer(c.id)}
              onDelete={() => setDeleteConfirm(c.id)}
              onOpenTerminal={() => handleOpenTerminal(c.name)}
              onOpenBrowser={getOpenBrowser(c)}
              onClone={() => handleCloneEnvironment(c)}
              onEdit={() => handleOpenEdit(c)}
              onOpenLogs={async () => {
                if (logsContainerId === c.id) {
                  setLogsContainerId(null)
                  setLogs('')
                  return
                }
                setLogsContainerId(c.id)
                try {
                  const { api } = await import('@/lib/api')
                  const log = await api.getContainerLogs(c.id)
                  setLogs(log)
                } catch {
                  setLogs('无法获取日志')
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>名称</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>端口</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>资源</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>运行时间</th>
                <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <ContainerTableRow
                  key={c.id}
                  container={c}
                  statusLabel={statusLabel}
                  statusColor={statusColor}
                  onStop={() => stopContainer(c.id)}
                  onStart={() => startContainer(c.id)}
                  onDelete={() => setDeleteConfirm(c.id)}
                  onOpenTerminal={() => handleOpenTerminal(c.name)}
                  onOpenBrowser={getOpenBrowser(c)}
                  onClone={() => handleCloneEnvironment(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Container Config Edit Dialog */}
      {editContainer && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setEditContainer(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-[500px] max-h-[80vh] overflow-y-auto rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                编辑容器: {editContainer.name}
              </h3>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                修改端口映射。更改端口会停止容器并重新创建（保留数据和卷）。
              </p>

              <div className="space-y-3 mb-6">
                <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>端口映射</h4>
                {editPorts.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xs w-20" style={{ color: 'var(--color-text-secondary)' }}>容器端口 {p.container}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>→ 宿主机</span>
                    <input
                      type="number"
                      value={p.host}
                      onChange={(e) => {
                        const updated = [...editPorts]
                        updated[idx] = { ...p, host: parseInt(e.target.value) || p.host }
                        setEditPorts(updated)
                      }}
                      className="w-24 rounded-lg border py-1.5 px-3 text-sm outline-none"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditContainer(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {editSaving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-96 rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                确认销毁环境
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                此操作不可撤销。容器将被强制删除，端口将被释放。
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--color-status-red)' }}
                >
                  确认销毁
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function ContainerCard({
  container,
  statusLabel,
  statusColor,
  onStop,
  onStart,
  onDelete,
  onOpenTerminal,
  onOpenBrowser,
  onOpenLogs,
  onClone,
  onEdit
}: {
  container: RunningContainer
  statusLabel: Record<ContainerStatus, string>
  statusColor: Record<ContainerStatus, string>
  onStop: () => void
  onStart: () => void
  onDelete: () => void
  onOpenTerminal: () => void
  onOpenBrowser: (() => void) | null
  onOpenLogs: () => void
  onClone: () => void
  onEdit: () => void
}): JSX.Element {
  const iconMap: Record<string, string> = { python: '🐍', node: '⬢', java: '☕', go: '🔵', rust: '🦀', cpp: '⚙️' }
  return (
    <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{iconMap[container.language] || '📦'}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{container.name}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{container.image.split('/').pop()}</p>
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: statusColor[container.status] + '20', color: statusColor[container.status] }}>
          {statusLabel[container.status]}
        </span>
      </div>

      <div className="space-y-2 mb-3 text-xs">
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--color-text-muted)' }}>SSH :{container.ports.find((p) => p.type === 'ssh')?.host || '-'}</span>
          <span style={{ color: 'var(--color-text-muted)' }}>{formatUptime(container.state.startedAt)}</span>
        </div>
        {/* CPU bar */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span style={{ color: 'var(--color-text-muted)' }}>CPU</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{container.resources.cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(container.resources.cpuPercent, 100)}%`,
                backgroundColor: container.resources.cpuPercent > 80 ? 'var(--color-status-red)' : 'var(--color-accent)'
              }}
            />
          </div>
        </div>
        {/* Memory bar */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span style={{ color: 'var(--color-text-muted)' }}>内存</span>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {formatBytes(container.resources.memoryUsage)} / {formatBytes(container.resources.memoryLimit)}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${container.resources.memoryLimit > 0 ? Math.min((container.resources.memoryUsage / container.resources.memoryLimit) * 100, 100) : 0}%`,
                backgroundColor: container.resources.memoryUsage / container.resources.memoryLimit > 0.8 ? 'var(--color-status-red)' : 'var(--color-progress)'
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {container.status === 'running' ? (
          <>
            <ActionBtn icon={<Terminal size={13} />} label="终端" onClick={onOpenTerminal} />
            {onOpenBrowser && (
              <ActionBtn icon={<Globe size={13} />} label="浏览器" onClick={onOpenBrowser} />
            )}
            <ActionBtn icon={<Edit3 size={13} />} label="编辑" onClick={onEdit} />
            <ActionBtn icon={<Plus size={13} />} label="克隆" onClick={onClone} />
            <ActionBtn icon={<Square size={13} />} label="停止" onClick={onStop} />
          </>
        ) : (
          <ActionBtn icon={<Play size={13} />} label="启动" onClick={onStart} />
        )}
        <ActionBtn icon={<Trash2 size={13} />} label="销毁" danger onClick={onDelete} />
      </div>
    </div>
  )
}

function ContainerTableRow({
  container,
  statusLabel,
  statusColor,
  onStop,
  onStart,
  onDelete,
  onOpenTerminal,
  onOpenBrowser,
  onClone
}: {
  container: RunningContainer
  statusLabel: Record<ContainerStatus, string>
  statusColor: Record<ContainerStatus, string>
  onStop: () => void
  onStart: () => void
  onDelete: () => void
  onOpenTerminal: () => void
  onOpenBrowser: (() => void) | null
  onClone: () => void
}): JSX.Element {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-4 py-3">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{container.name}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{container.language} v{container.version}</p>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: statusColor[container.status] + '20', color: statusColor[container.status] }}>
          {statusLabel[container.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        :{container.ports.find((p) => p.type === 'ssh')?.host || '-'}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {container.resources.cpuPercent.toFixed(1)}% · {formatBytes(container.resources.memoryUsage)}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {formatUptime(container.state.startedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {container.status === 'running' ? (
            <>
              <IconBtn icon={<Terminal size={14} />} onClick={onOpenTerminal} title="终端" />
              {onOpenBrowser && <IconBtn icon={<Globe size={14} />} onClick={onOpenBrowser} title="浏览器" />}
              <IconBtn icon={<Plus size={14} />} onClick={onClone} title="克隆" />
              <IconBtn icon={<Square size={14} />} onClick={onStop} title="停止" />
            </>
          ) : (
            <IconBtn icon={<Play size={14} />} onClick={onStart} title="启动" />
          )}
          <IconBtn icon={<Trash2 size={14} />} onClick={onDelete} title="销毁" danger />
        </div>
      </td>
    </tr>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
  danger
}: {
  icon: JSX.Element
  label: string
  onClick: () => void
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-black/5"
      style={{ color: danger ? 'var(--color-status-red)' : 'var(--color-text-secondary)' }}
    >
      {icon}
      {label}
    </button>
  )
}

function IconBtn({
  icon,
  onClick,
  title,
  danger
}: {
  icon: JSX.Element
  onClick: () => void
  title: string
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 transition-colors hover:bg-black/5"
      style={{ color: danger ? 'var(--color-status-red)' : 'var(--color-text-secondary)' }}
    >
      {icon}
    </button>
  )
}
