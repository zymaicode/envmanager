import { useState, useEffect } from 'react'
import { Loader2, Check, Circle, Download, ChevronRight, ChevronLeft } from 'lucide-react'
import { api } from '@/lib/api'

type Step = 'welcome' | 'docker' | 'images' | 'download' | 'done'

interface ImageOption {
  label: string
  image: string
  size: string
  language: string
  checked: boolean
}

const IMAGE_OPTIONS: ImageOption[] = [
  { label: 'Python 3.12', image: 'python:3.12-slim', size: '~160 MB', language: 'python', checked: true },
  { label: 'Node.js 22', image: 'node:22-slim', size: '~270 MB', language: 'node', checked: true },
  { label: 'Java 21', image: 'eclipse-temurin:21-jdk', size: '~460 MB', language: 'java', checked: false },
  { label: 'Go 1.23', image: 'golang:1.23-bookworm', size: '~880 MB', language: 'go', checked: false },
  { label: 'Rust latest', image: 'rust:latest', size: '~850 MB', language: 'rust', checked: false },
  { label: 'GCC 14', image: 'gcc:14-bookworm', size: '~1.3 GB', language: 'cpp', checked: false }
]

interface Props {
  onComplete: () => void
}

export function SetupWizard({ onComplete }: Props): JSX.Element {
  const [step, setStep] = useState<Step>('welcome')
  const [dockerOk, setDockerOk] = useState(false)
  const [dockerVersion, setDockerVersion] = useState('')
  const [checking, setChecking] = useState(false)
  const [images, setImages] = useState<ImageOption[]>(IMAGE_OPTIONS)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState<string[]>([])
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (step === 'docker') checkDocker()
  }, [step])

  const [dockerError, setDockerError] = useState('')

  const checkDocker = async (): Promise<void> => {
    setChecking(true)
    setDockerError('')
    try {
      const status = await api.getStatus()
      if ((status as any).docker === true) {
        setDockerOk(true)
        setDockerVersion(status.version)
      } else {
        setDockerOk(false)
        const errInfo = status as any
        setDockerError(errInfo.error || 'Docker 服务未响应')
      }
    } catch {
      setDockerOk(false)
      setDockerError('无法连接到 API 服务')
    }
    setChecking(false)
  }

  const toggleImage = (idx: number): void => {
    setImages((prev) => prev.map((img, i) => (i === idx ? { ...img, checked: !img.checked } : img)))
  }

  const startDownload = async (): Promise<void> => {
    setStep('download')
    const toDownload = images.filter((i) => i.checked)

    for (const img of toDownload) {
      setDownloading(img.label)
      setDownloadError(null)
      try {
        // Check cache first
        try {
          const { cached } = await api.checkImageCached(img.image)
          if (cached) {
            setDownloaded((prev) => [...prev, img.image])
            continue
          }
        } catch { /* proceed to pull */ }

        await api.pullImage(img.image)
        setDownloaded((prev) => [...prev, img.image])
      } catch {
        setDownloadError(`下载失败，请检查网络后前往镜像管理页面手动下载`)
      }
    }

    setDownloading(null)
    setStep('done')
  }

  const skipDownload = (): void => {
    setStep('done')
  }

  const finish = (): void => {
    localStorage.setItem('envmanager-setup-done', '1')
    onComplete()
  }

  const iconStyle = {
    maxWidth: 520,
    background: 'var(--color-bg-card)',
    borderRadius: 16,
    padding: 32
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div style={iconStyle} className="shadow-2xl max-h-[90vh] overflow-y-auto w-full overflow-x-hidden">

          {/* === Step: Welcome === */}
          {step === 'welcome' && (
            <div className="text-center">
              <div
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <span className="text-2xl font-bold text-white">E</span>
              </div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                欢迎使用环境管理平台
              </h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                一键创建容器化开发环境，隔离运行不污染本机。
                接下来帮你完成首次配置，仅需 2 分钟。
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={finish}
                  className="rounded-xl px-5 py-2.5 text-sm transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  跳过，直接使用
                </button>
                <button
                  onClick={() => setStep('docker')}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  开始配置 <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* === Step: Docker Check === */}
          {step === 'docker' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep('welcome')} className="p-1 rounded-lg hover:bg-black/5">
                  <ChevronLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
                </button>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>步骤 1/3</span>
              </div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                检测 Docker 环境
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                环境管理平台需要 Docker 来创建容器化开发环境
              </p>

              {checking ? (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>正在检测...</span>
                </div>
              ) : dockerOk ? (
                <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#F3F8F4' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Check size={18} style={{ color: 'var(--color-status-green)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-status-green)' }}>
                      Docker 已连接
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    版本 v{dockerVersion}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#FFF5F2' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Circle size={18} style={{ color: 'var(--color-status-red)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-status-red)' }}>
                      Docker 未连接
                    </span>
                  </div>
                  {dockerError && (
                    <p className="text-xs mb-2 font-mono bg-black/5 rounded-lg p-2 break-all" style={{ color: 'var(--color-status-red)' }}>
                      {dockerError}
                    </p>
                  )}
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    请确认 Docker 服务正在运行。支持以下部署方式：
                  </p>
                  <ul className="text-xs mb-3 space-y-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    <li>&bull; Docker Desktop（Windows/Mac/Linux）</li>
                    <li>&bull; Colima（macOS/Linux）</li>
                    <li>&bull; Rancher Desktop</li>
                    <li>&bull; Podman（Linux，需开启兼容 API）</li>
                    <li>&bull; 远程 Docker（设置 DOCKER_HOST 环境变量）</li>
                  </ul>
                  <button
                    onClick={checkDocker}
                    className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    重新检测
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {!dockerOk && !checking && (
                  <button
                    onClick={() => setStep('images')}
                    className="rounded-lg px-3 py-2 text-xs transition-colors hover:bg-black/5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    跳过检测
                  </button>
                )}
                <button
                  onClick={() => setStep('images')}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  下一步 <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* === Step: Image Selection === */}
          {step === 'images' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep('docker')} className="p-1 rounded-lg hover:bg-black/5">
                  <ChevronLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
                </button>
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>步骤 2/3</span>
              </div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                选择开发语言
              </h2>
              <p className="text-xs mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                勾选你常用的语言，预先下载对应镜像。之后在镜像管理中也能随时补充。
              </p>

              <div className="space-y-2 mb-6">
                {images.map((img, idx) => (
                  <label
                    key={img.image}
                    className="flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors hover:bg-black/[0.02]"
                    style={{ borderColor: img.checked ? 'var(--color-accent)' : 'var(--color-border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={img.checked}
                      onChange={() => toggleImage(idx)}
                      className="rounded"
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{img.label}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{img.size}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={skipDownload}
                  className="rounded-lg px-4 py-2 text-xs transition-colors hover:bg-black/5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  跳过，稍后下载
                </button>
                <button
                  onClick={startDownload}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  开始下载 <Download size={14} />
                </button>
              </div>
            </div>
          )}

          {/* === Step: Download === */}
          {step === 'download' && (
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                正在下载镜像
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                下载速度取决于网络环境，可最小化窗口等待
              </p>

              <div className="space-y-2 mb-6">
                {images.filter((i) => i.checked).map((img) => {
                  const isDone = downloaded.includes(img.image)
                  const isCurrent = downloading === img.label
                  return (
                    <div
                      key={img.image}
                      className="flex items-center gap-3 rounded-xl border p-3.5"
                      style={{ borderColor: isDone ? 'var(--color-status-green)' : 'var(--color-border)' }}
                    >
                      {isDone ? (
                        <Check size={16} style={{ color: 'var(--color-status-green)' }} />
                      ) : isCurrent ? (
                        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                      ) : (
                        <Circle size={16} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                      <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>{img.label}</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {isDone ? '已完成' : isCurrent ? '下载中...' : '等待中'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {downloadError && (
                <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#FFF5F2' }}>
                  <span className="text-xs" style={{ color: 'var(--color-status-red)' }}>{downloadError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStep('done')}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  完成 <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* === Step: Done === */}
          {step === 'done' && (
            <div className="text-center">
              <div
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: '#F3F8F4' }}
              >
                <Check size={32} style={{ color: 'var(--color-status-green)' }} />
              </div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                配置完成
              </h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                你可以随时前往镜像管理页面补充下载更多语言环境。
                现在去环境市场创建你的第一个开发环境吧。
              </p>
              <button
                onClick={finish}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                开始使用
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

export function isFirstRun(): boolean {
  return localStorage.getItem('envmanager-setup-done') !== '1'
}
