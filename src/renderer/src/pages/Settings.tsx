import { RotateCcw } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'

export function Settings(): JSX.Element {
  const { settings, updateSettings, resetSettings } = useSettingsStore()

  return (
    <div className="p-6" style={{ backgroundColor: 'var(--color-bg-content)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            系统设置
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            配置 Docker 连接、端口策略与清理规则
          </p>
        </div>
        <button
          onClick={resetSettings}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <RotateCcw size={12} /> 恢复默认
        </button>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* SSH Port Range */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>SSH 端口范围</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            容器 SSH 服务映射到宿主机的端口范围
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={settings.sshPortRange[0]}
              onChange={(e) => updateSettings({ sshPortRange: [parseInt(e.target.value) || 22000, settings.sshPortRange[1]] })}
              className="w-28 rounded-lg border py-2 px-3 text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>至</span>
            <input
              type="number"
              value={settings.sshPortRange[1]}
              onChange={(e) => updateSettings({ sshPortRange: [settings.sshPortRange[0], parseInt(e.target.value) || 30000] })}
              className="w-28 rounded-lg border py-2 px-3 text-sm outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
            />
          </div>
        </section>

        {/* Dev Ports */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>开发端口白名单</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            自动映射到宿主机的常用开发端口（逗号分隔）
          </p>
          <input
            type="text"
            value={settings.devPorts.join(', ')}
            onChange={(e) =>
              updateSettings({
                devPorts: e.target.value
                  .split(',')
                  .map((p) => parseInt(p.trim()))
                  .filter((n) => !isNaN(n))
              })
            }
            className="w-full max-w-md rounded-lg border py-2 px-3 text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
          />
        </section>

        {/* Mount Path */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>默认代码挂载路径</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            容器内挂载用户代码的目录
          </p>
          <input
            type="text"
            value={settings.mountPath}
            onChange={(e) => updateSettings({ mountPath: e.target.value })}
            className="w-full max-w-md rounded-lg border py-2 px-3 text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
          />
        </section>

        {/* Mirror URL */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>镜像源加速</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            国内用户可配置 Docker 镜像加速地址（如阿里云/腾讯云）
          </p>
          <input
            type="text"
            placeholder="https://your-mirror.aliyuncs.com"
            value={settings.mirrorUrl}
            onChange={(e) => updateSettings({ mirrorUrl: e.target.value })}
            className="w-full max-w-md rounded-lg border py-2 px-3 text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
          />
        </section>

        {/* Auto Cleanup */}
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>退出应用时</h2>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            选择退出应用时对运行中环境的处理方式
          </p>
          <div className="space-y-2">
            {[
              { value: 'never' as const, label: '保留所有环境（默认）' },
              { value: 'stop' as const, label: '停止运行中的环境' },
              { value: 'stop-all' as const, label: '停止所有环境' },
              { value: 'destroy' as const, label: '销毁所有环境（高危）' }
            ].map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 cursor-pointer text-sm"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <input
                  type="radio"
                  name="autoCleanup"
                  checked={settings.autoCleanup === opt.value}
                  onChange={() => updateSettings({ autoCleanup: opt.value })}
                  className="accent-current"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </section>

        {/* Saved indicator */}
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          设置已自动保存至本地
        </div>
      </div>
    </div>
  )
}
