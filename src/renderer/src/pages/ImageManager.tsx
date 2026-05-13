import { useEffect, useState } from 'react'
import { Loader2, Download, Trash2, RefreshCw, Plus, X, AlertTriangle, Check } from 'lucide-react'
import { useImageStore } from '@/stores/image-store'
import { formatBytes } from '@/lib/utils'
import { api } from '@/lib/api'

// 常用镜像推荐列表（与 server.ts 的预拉取列表一致）
const RECOMMENDED_IMAGES = [
  { label: 'Python 3.12', image: 'python:3.12-slim', size: '~160 MB' },
  { label: 'Node.js 20', image: 'node:20-slim', size: '~260 MB' },
  { label: 'Java 21', image: 'eclipse-temurin:21-jdk', size: '~460 MB' },
  { label: 'Go 1.22', image: 'golang:1.22-bookworm', size: '~850 MB' },
  { label: 'Rust 1.78', image: 'rust:1.78-slim-bookworm', size: '~800 MB' },
  { label: 'GCC 12', image: 'gcc:12-bookworm', size: '~1.2 GB' }
]

export function ImageManager(): JSX.Element {
  const { images, loading, pullLoading, fetchImages, pullImage, deleteImage, cleanupImages } = useImageStore()

  const [pullDialog, setPullDialog] = useState(false)
  const [pullImageName, setPullImageName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [cleanupConfirm, setCleanupConfirm] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [cachedStatus, setCachedStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  // 检查推荐镜像的缓存状态
  useEffect(() => {
    const checkCache = async (): Promise<void> => {
      const status: Record<string, boolean> = {}
      for (const img of RECOMMENDED_IMAGES) {
        try {
          const res = await api.checkImageCached(img.image)
          status[img.image] = res.cached
        } catch {
          status[img.image] = false
        }
      }
      setCachedStatus(status)
    }
    checkCache()
  }, [images])

  const handlePull = async (): Promise<void> => {
    if (!pullImageName.trim()) return
    await pullImage(pullImageName)
    setPullDialog(false)
    setPullImageName('')
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteImage(id)
    setDeleteConfirm(null)
  }

  const handleCleanup = async (): Promise<void> => {
    await cleanupImages()
    setCleanupConfirm(false)
  }

  const [pullProgress, setPullProgress] = useState<{ taskId: string; layers: { id: string; status: string; progress: string }[] } | null>(null)

  const handleQuickDownload = async (image: string): Promise<void> => {
    setDownloading(image)
    try {
      const { taskId } = await api.pullImage(image)
      setPullProgress({ taskId, layers: [] })

      // Poll every 1s, timeout 5min
      let timedOut = false
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        const progress = await api.getPullProgress(taskId)
        setPullProgress({ taskId, layers: progress.layers || [] })
        if (progress.done) {
          if (progress.error) throw new Error(progress.error)
          break
        }
      }
      if (!pullProgress?.layers?.length) {
        timedOut = true
        throw new Error('下载超时，请检查网络后重试')
      }
      await fetchImages()
    } finally {
      setDownloading(null)
      setPullProgress(null)
    }
  }

  const dangling = images.filter((i) => i.isDangling)
  const unused = images.filter((i) => !i.isDangling && i.containers === 0)

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg-content)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            镜像管理
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            管理本地 Docker 镜像缓存，共 {images.length} 个镜像
          </p>
        </div>
        <div className="flex gap-2">
          {(dangling.length > 0 || unused.length > 0) && (
            <button
              onClick={() => setCleanupConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <RefreshCw size={12} /> 批量清理 ({dangling.length + unused.length})
            </button>
          )}
          <button
            onClick={() => setPullDialog(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Download size={12} /> 自定义拉取
          </button>
        </div>
      </div>

      {/* 常用镜像快速下载 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          常用开发环境镜像
        </h2>
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          应用启动时会在后台自动预拉取，你也可以手动点击下载
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {RECOMMENDED_IMAGES.map((img) => {
            const isCached = cachedStatus[img.image]
            const isDownloading = downloading === img.image
            return (
              <button
                key={img.image}
                disabled={isCached || isDownloading}
                onClick={() => handleQuickDownload(img.image)}
                className="flex flex-col items-center gap-2 rounded-xl border p-4 transition-all disabled:cursor-default"
                style={{
                  borderColor: isCached ? 'var(--color-status-green)' : 'var(--color-border)',
                  backgroundColor: isCached ? '#F3F8F4' : 'var(--color-bg-card)'
                }}
              >
                {isCached ? (
                  <Check size={20} style={{ color: 'var(--color-status-green)' }} />
                ) : isDownloading ? (
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                ) : (
                  <Download size={20} style={{ color: 'var(--color-text-muted)' }} />
                )}
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {img.label}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {isCached ? '已缓存' : isDownloading ? '下载中...' : img.size}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Pull Progress */}
      {pullProgress && pullProgress.layers.length > 0 && (
        <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Loader2 size={12} className="animate-spin" /> 正在下载...
          </h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {pullProgress.layers.map((layer, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                <span className="truncate max-w-[200px]" style={{ color: 'var(--color-text-secondary)' }}>{layer.id}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{layer.status} {layer.progress}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 本地镜像列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Plus size={48} style={{ color: 'var(--color-text-muted)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            暂无本地镜像
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            点击上方常用镜像一键下载，或使用自定义拉取
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>镜像</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>标签</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>大小</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>关联容器</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>创建时间</th>
                <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {images.map((img) => (
                <tr key={img.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {img.repoTags[0]?.split(':')[0] || '<none>'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {img.repoTags[0]?.split(':')[1] || '<none>'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {formatBytes(img.size)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {img.containers}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(img.created).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                        title="更新"
                        style={{ color: 'var(--color-text-secondary)' }}
                        onClick={() => handleQuickDownload(img.repoTags[0] || '')}
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        className="rounded-md p-1.5 transition-colors hover:bg-black/5 disabled:opacity-30"
                        title={img.containers > 0 ? '有关联容器，无法删除' : '删除'}
                        disabled={img.containers > 0}
                        onClick={() => setDeleteConfirm(img.id)}
                        style={{ color: img.containers > 0 ? 'var(--color-text-muted)' : 'var(--color-status-red)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pull Dialog */}
      {pullDialog && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setPullDialog(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-96 rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>自定义拉取</h3>
                <button onClick={() => setPullDialog(false)} className="rounded-lg p-1">
                  <X size={18} style={{ color: 'var(--color-text-secondary)' }} />
                </button>
              </div>
              <input
                type="text"
                placeholder="输入镜像地址，如 python:3.12"
                value={pullImageName}
                onChange={(e) => setPullImageName(e.target.value)}
                className="w-full rounded-lg border py-2 px-3 text-sm mb-4 outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                onKeyDown={(e) => e.key === 'Enter' && handlePull()}
              />
              <button
                onClick={handlePull}
                disabled={!pullImageName.trim() || pullLoading}
                className="w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {pullLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> 拉取中...
                  </span>
                ) : (
                  '拉取镜像'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-96 rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>确认删除镜像</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>删除后需要重新拉取才能使用。</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>取消</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--color-status-red)' }}>确认删除</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cleanup Confirm */}
      {cleanupConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setCleanupConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-96 rounded-xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} style={{ color: 'var(--color-status-yellow)' }} />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>批量清理镜像</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                将删除 {dangling.length} 个悬空镜像和 {unused.filter((i) => !i.isDangling).length} 个未使用的镜像。
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setCleanupConfirm(false)} className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>取消</button>
                <button onClick={handleCleanup} className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}>确认清理</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
