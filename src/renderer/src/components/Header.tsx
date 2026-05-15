import { useEffect, useState } from 'react'
import { Circle, RefreshCw, Loader2 } from 'lucide-react'
import { useContainerStore } from '@/stores/container-store'
import { formatBytes } from '@/lib/utils'
import { api } from '@/lib/api'

export function Header(): JSX.Element {
  const { status, fetchStatus } = useContainerStore()
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const dockerConnected = status?.docker ?? false

  const handleReconnect = async (): Promise<void> => {
    setReconnecting(true)
    try {
      await api.reconnectDocker()
      await fetchStatus()
    } catch { /* ignore */ }
    setReconnecting(false)
  }

  return (
    <header
      className="flex h-14 items-center justify-between px-6 border-b flex-shrink-0"
      style={{
        backgroundColor: 'var(--color-bg-content)',
        borderColor: 'var(--color-border)'
      }}
    >
      <div className="flex items-center gap-3">
        {status && (
          <>
            <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <Circle
                size={8}
                fill={dockerConnected ? 'var(--color-status-green)' : 'var(--color-status-red)'}
                color={dockerConnected ? 'var(--color-status-green)' : 'var(--color-status-red)'}
              />
              <span>Docker {dockerConnected ? '已连接' : '未连接'}</span>
            </div>
            {dockerConnected ? (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                v{status.version} · {status.containersRunning} 运行中 · {status.imagesCount} 镜像
                {status.totalMemory > 0 && ` · 主机 ${formatBytes(status.totalMemory)}`}
              </span>
            ) : (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors hover:bg-black/5 disabled:opacity-50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {reconnecting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                重新连接
              </button>
            )}
          </>
        )}
        {!status && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>检查 Docker 中...</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          环境管理平台
        </span>
      </div>
    </header>
  )
}
