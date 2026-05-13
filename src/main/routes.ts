import express from 'express'
import Docker from 'dockerode'
import path from 'path'
import os from 'os'
import { docker, mapContainer, getContainerDetail, findFreePort, VERSION_COMMANDS, normalizeProjectPath } from './docker'
import { allTemplates, databaseTemplates } from './templates'

export function registerRoutes(app: express.Express): void {
  // ====== 创建任务状态缓存 ======
  const creationTasks = new Map<string, { phase: string; containerId?: string; sshPort?: number; verifiedVersion?: string; error?: string; done: boolean }>()

  // ====== 容器自动休眠监控 ======
  const containerLastActivity = new Map<string, number>()
  let autoSleepInterval: ReturnType<typeof setInterval> | null = null

  app.post('/api/system/auto-sleep/config', (req, res) => {
    const { enabled, minutes } = req.body as { enabled: boolean; minutes: number }
    if (autoSleepInterval) { clearInterval(autoSleepInterval); autoSleepInterval = null }

    if (enabled && minutes > 0) {
      autoSleepInterval = setInterval(async () => {
        try {
          const containers = await docker.listContainers({ all: true })
          const running = containers.filter((c) => c.State === 'running' && c.Labels?.['envmanager.language'])
          const threshold = minutes * 60 * 1000

          for (const info of running) {
            const c = docker.getContainer(info.Id)
            try {
              const stats = await c.stats({ stream: false })
              const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
              const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
              const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0

              const now = Date.now()
              if (cpuPercent < 1.0) {
                // Low CPU: mark idle
                const firstIdle = containerLastActivity.get(info.Id) || now
                if (now - firstIdle > threshold) {
                  console.log(`[EnvManager] Auto-sleep: pausing ${info.Names[0]}`)
                  await c.pause()
                  containerLastActivity.delete(info.Id)
                } else if (!containerLastActivity.has(info.Id)) {
                  containerLastActivity.set(info.Id, now)
                }
              } else {
                containerLastActivity.delete(info.Id)
              }
            } catch { /* skip individual container errors */ }
          }
        } catch { /* monitoring loop error, retry next interval */ }
      }, 30000) // Check every 30 seconds
      console.log(`[EnvManager] Auto-sleep enabled: ${minutes} min idle threshold`)
    }

    res.json({ success: true, enabled, minutes })
  })

  // Auto-cleanup: remove done tasks after 60 seconds
  setInterval(() => {
    for (const [key, task] of creationTasks) {
      if (task.done) creationTasks.delete(key)
    }
  }, 60000)

  // ====== 环境模板 ======
  app.get('/api/environments', (req, res) => {
    const category = req.query.category as string | undefined
    const all = [...allTemplates]
    if (category) {
      return res.json(all.filter((t) => t.category === category))
    }
    res.json(all)
  })

  // ====== 容器列表 ======
  app.get('/api/containers', async (_req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const mapped = containers
        .filter((c) => c.Labels?.['envmanager.language'])
        .map(mapContainer)
      res.json(mapped)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 容器详情 ======
  app.get('/api/containers/:id', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })
      const detail = await getContainerDetail(found.Id)
      res.json(detail)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 创建容器 ======
  app.post('/api/containers', async (req, res) => {
    const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    creationTasks.set(taskId, { phase: '正在检查镜像缓存...', done: false })
    res.json({ taskId })

    const { lang, version, projectPath: rawProjectDir } = req.body as { lang: string; version: string; projectPath: string }
    const projectPath = normalizeProjectPath(rawProjectDir)
    const containerName = `env-${lang}-${version.replace('.', '')}-${taskId}`
    const template = allTemplates.find((t) => t.id === lang)
    const ver = template?.versions?.find((v) => v.version === version)
    const isDatabase = template?.isDatabase
    let container: Docker.Container | null = null

    try {
      if (!ver) throw new Error(`不支持的版本: ${version}`)
      if (!template) throw new Error(`不支持的语言: ${lang}`)

      const localImages = await docker.listImages({ filters: { reference: [ver.image] } })
      if (localImages.length === 0) {
        creationTasks.set(taskId, { phase: `镜像未下载: ${ver.image}`, error: 'IMAGE_NOT_FOUND', done: true })
        return
      }

      creationTasks.set(taskId, { phase: '正在分配端口...', done: false })
      const sshPort = await findFreePort(22000, 30000)

      creationTasks.set(taskId, { phase: '正在创建容器...', done: false })
      const dbTemplate = databaseTemplates.find((t) => t.id === lang)
      const createOpts: Docker.ContainerCreateOptions = {
        Image: ver.image,
        name: containerName,
        Tty: true,
        OpenStdin: true,
        Env: isDatabase && dbTemplate?.env
          ? Object.entries(dbTemplate.env).map(([k, v]) => `${k}=${v}`)
          : undefined,
        HostConfig: {
          RestartPolicy: { Name: 'unless-stopped' },
          AutoRemove: false
        },
        Labels: {
          'envmanager.language': lang,
          'envmanager.version': version,
          'envmanager.project': projectPath,
          'envmanager.created': new Date().toISOString()
        }
      }

      if (isDatabase && dbTemplate) {
        createOpts.HostConfig!.PortBindings = {}
        for (const p of dbTemplate.defaultPorts!) {
          const hostPort = await findFreePort(p.host, p.host + 100)
          createOpts.HostConfig!.PortBindings![`${p.container}/tcp`] = [{ HostPort: String(hostPort) }]
        }
      } else {
        createOpts.WorkingDir = '/workspace'
        createOpts.HostConfig!.Binds = [`${projectPath}:/workspace`]
        createOpts.HostConfig!.PortBindings = { '22/tcp': [{ HostPort: String(sshPort) }] }
      }

      container = await docker.createContainer(createOpts)

      creationTasks.set(taskId, { phase: '正在启动容器...', done: false })
      await container.start()

      creationTasks.set(taskId, { phase: '正在验证环境就绪...', done: false })
      await new Promise((r) => setTimeout(r, 2000))
      const inspect = await container.inspect()
      if (!inspect.State.Running) throw new Error('容器启动失败')

      const cmd = VERSION_COMMANDS[lang] || 'echo "ok"'
      let verifiedVersion = ''
      try {
        const exec = await container.exec({ Cmd: ['/bin/sh', '-c', cmd], AttachStdout: true, AttachStderr: true })
        const output = await exec.start({ Detach: false, Tty: false })
        const raw = Buffer.isBuffer(output) ? output.toString('utf8') : String(output || '')
        verifiedVersion = raw.replace(/[\x00-\x08]/g, '').replace(/\n/g, ' - ').substring(0, 80)
      } catch {
        verifiedVersion = '就绪'
      }

      creationTasks.set(taskId, {
        phase: 'done',
        containerId: container.id.substring(0, 12),
        sshPort,
        verifiedVersion: verifiedVersion || '就绪',
        done: true
      })
    } catch (err: any) {
      console.error(`[EnvManager] Creation failed:`, err.message)
      if (container) {
        try { await container.remove({ force: true }) } catch { /* ignore */ }
      }
      creationTasks.set(taskId, { phase: `创建失败: ${err.message}`, error: err.message, done: true })
    }
  })

  // ====== 查询创建进度 ======
  app.get('/api/containers/create/:taskId', (req, res) => {
    const task = creationTasks.get(req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  })

  // ====== 更新容器配置（停止 → 重建） ======
  app.put('/api/containers/:id/config', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })

      const { ports: newPorts } = req.body as { ports?: { container: number; host: number }[] }

      // Port changes require stop → recreate
      if (newPorts && newPorts.length > 0) {
        const c = docker.getContainer(found.Id)
        const oldInfo = await c.inspect()
        const wasRunning = oldInfo.State.Running

        // Commit current state as a temporary image
        if (wasRunning) await c.stop()
        const oldConfig = oldInfo.Config
        const oldHostConfig = oldInfo.HostConfig || {}

        // Build new port bindings
        const portBindings: Record<string, Array<{ HostPort: string }>> = {}
        for (const p of newPorts) {
          portBindings[`${p.container}/tcp`] = [{ HostPort: String(p.host) }]
        }

        // Create replacement container with same settings but new ports
        const replacement = await docker.createContainer({
          Image: oldConfig.Image,
          name: oldInfo.Name.replace(/^\//, ''),
          Tty: oldConfig.Tty,
          OpenStdin: oldConfig.OpenStdin,
          WorkingDir: oldConfig.WorkingDir,
          Env: oldConfig.Env,
          Cmd: oldConfig.Cmd,
          HostConfig: {
            ...oldHostConfig,
            PortBindings: portBindings,
            Binds: oldHostConfig.Binds || [],
            RestartPolicy: oldHostConfig.RestartPolicy || { Name: 'unless-stopped' }
          },
          Labels: oldConfig.Labels || {},
          Volumes: oldConfig.Volumes
        })

        // Remove old container
        await c.remove({ force: true })

        // Start new one
        if (wasRunning) await replacement.start()

        res.json({
          success: true,
          newContainerId: replacement.id.substring(0, 12),
          message: '端口配置已更新'
        })
      } else {
        res.json({ success: true, message: '配置已更新' })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 获取容器可编辑配置 ======
  app.get('/api/containers/:id/config', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })
      const detail = await getContainerDetail(found.Id)
      res.json({
        ports: detail.ports,
        mounts: detail.mounts,
        language: detail.language,
        version: detail.version,
        image: detail.image
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 停止 / 启动 / 销毁 ======
  const containerAction = (action: 'stop' | 'start' | 'remove-force') =>
    async (req: express.Request, res: express.Response) => {
      try {
        const containers = await docker.listContainers({ all: true })
        const found = containers.find((c) => c.Id.startsWith(req.params.id))
        if (!found) return res.status(404).json({ error: 'Container not found' })
        const c = docker.getContainer(found.Id)
        if (action === 'stop') await c.stop()
        else if (action === 'start') await c.start()
        else await c.remove({ force: true })
        res.json({ success: true })
      } catch (err: any) {
        res.status(500).json({ error: err.message })
      }
    }

  app.post('/api/containers/:id/stop', containerAction('stop'))
  app.post('/api/containers/:id/start', containerAction('start'))
  app.delete('/api/containers/:id', containerAction('remove-force'))

  // ====== 容器日志 ======
  app.get('/api/containers/:id/logs', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })
      const c = docker.getContainer(found.Id)
      const stream = await c.logs({ stdout: true, stderr: true, tail: 100, timestamps: true })

      res.setHeader('Content-Type', 'text/plain')
      if (Buffer.isBuffer(stream)) {
        res.send(stream.toString('utf8'))
      } else if (typeof stream === 'string') {
        res.send(stream)
      } else {
        let logs = ''
        ;(stream as any).on('data', (chunk: Buffer) => { logs += chunk.toString('utf8') })
        ;(stream as any).on('end', () => res.send(logs.replace(/.{8}/g, '').replace(/[\x00-\x08]/g, '')))
        ;(stream as any).on('error', (err: Error) => res.status(500).json({ error: err.message }))
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 在容器中执行命令 ======
  app.post('/api/containers/:id/exec', async (req, res) => {
    try {
      const { cmd } = req.body as { cmd: string[] }
      if (!cmd || cmd.length === 0) return res.status(400).json({ error: 'Command required' })
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })
      const c = docker.getContainer(found.Id)
      const exec = await c.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true })
      const output = await exec.start({ Detach: false, Tty: false })
      const result = Buffer.isBuffer(output) ? output.toString('utf8') : String(output || '')
      res.json({ output: result.replace(/[\x00-\x08]/g, '') })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 打开终端 ======
  app.post('/api/containers/:id/open-vscode', async (req, res) => {
    try {
      const containers = await docker.listContainers({ all: true })
      const found = containers.find((c) => c.Id.startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Container not found' })
      const detail = await getContainerDetail(found.Id)
      res.json({
        containerName: detail.name,
        command: `docker exec -it ${detail.name} /bin/bash || docker exec -it ${detail.name} /bin/sh`
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 镜像列表 ======
  app.get('/api/images', async (_req, res) => {
    try {
      const images = await docker.listImages({ all: true })
      const containers = await docker.listContainers({ all: true })
      const containerMap = new Map<string, number>()
      for (const c of containers) {
        containerMap.set(c.Image, (containerMap.get(c.Image) || 0) + 1)
        const shortId = c.ImageID?.replace('sha256:', '').substring(0, 12) || ''
        containerMap.set(shortId, (containerMap.get(shortId) || 0) + 1)
      }
      const mapped = images.map((img) => {
        const tags = img.RepoTags || ['<none>:<none>']
        return {
          id: img.Id.replace('sha256:', '').substring(0, 12),
          repoTags: tags,
          size: img.Size,
          created: img.Created,
          containers: tags.reduce((sum, tag) => sum + (containerMap.get(tag) || 0), 0),
          isDangling: tags.length === 1 && tags[0] === '<none>:<none>'
        }
      })
      res.json(mapped)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 镜像拉取（异步 + 进度） ======
  const pullTasks = new Map<string, { progress: string; done: boolean; layers: { id: string; status: string; progress: string }[]; error?: string }>()

  app.post('/api/images/pull', async (req, res) => {
    const { image } = req.body as { image: string }
    if (!image) return res.status(400).json({ error: 'Image name required' })

    const taskId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6)
    pullTasks.set(taskId, { progress: '正在连接...', done: false, layers: [] })
    res.json({ taskId })

    try {
      const stream = await docker.pull(image)
      const layerMap = new Map<string, { status: string; progress: string }>()

      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err: Error | null, result: any[]) => {
            if (err) return reject(err)
            resolve()
          },
          (event: any) => {
            if (!pullTasks.has(taskId)) return
            const id = event.id || ''
            const status = event.status || ''
            const progress = event.progress || ''
            const layerDetail = event.progressDetail || {}

            if (id) {
              layerMap.set(id, { status, progress })
              const layersArr = Array.from(layerMap.entries()).map(([k, v]) => ({ id: k, status: v.status, progress: v.progress }))
              pullTasks.set(taskId, {
                progress: `${status} ${id}: ${progress}`,
                done: false,
                layers: layersArr
              })
            } else {
              pullTasks.set(taskId, { progress: status, done: false, layers: Array.from(layerMap.entries()).map(([k, v]) => ({ id: k, status: v.status, progress: v.progress })) })
            }
          }
        )
      })

      pullTasks.set(taskId, { progress: '拉取完成', done: true, layers: Array.from(layerMap.entries()).map(([k, v]) => ({ id: k, status: v.status, progress: v.progress })) })
    } catch (err: any) {
      pullTasks.set(taskId, { progress: `拉取失败: ${err.message}`, done: true, layers: [], error: err.message })
    }

    // Cleanup after 2 min
    setTimeout(() => { pullTasks.delete(taskId) }, 120000)
  })

  app.get('/api/images/pull/:taskId', (req, res) => {
    const task = pullTasks.get(req.params.taskId)
    if (!task) return res.status(404).json({ error: 'Task not found' })
    res.json(task)
  })

  app.delete('/api/images/:id', async (req, res) => {
    try {
      const images = await docker.listImages({ all: true })
      const found = images.find((i) => i.Id.replace('sha256:', '').startsWith(req.params.id))
      if (!found) return res.status(404).json({ error: 'Image not found' })
      await docker.getImage(found.Id).remove({ force: false })
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/images/cleanup', async (_req, res) => {
    try {
      const result = await docker.pruneImages({ filters: { dangling: { '1': true } } })
      res.json({ success: true, removedCount: result.ImagesDeleted?.length || 0 })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/images/check/:image(*)', async (req, res) => {
    try {
      const imageName = decodeURIComponent(req.params.image)
      const existing = await docker.listImages({ filters: { reference: [imageName] } })
      res.json({ cached: existing.length > 0, image: imageName })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 连接信息 ======
  app.get('/api/connection-info', (_req, res) => {
    res.json({
      platform: process.platform,
      dockerHost: process.env['DOCKER_HOST'] || null
    })
  })

  // ====== 磁盘空间使用 ======
  // dockerode does not export df() in its type definitions, but the method exists on the modem
  app.get('/api/system/disk-usage', async (_req, res) => {
    try {
      const result = await (docker as unknown as { df: () => Promise<any> }).df()
      res.json({
        images: {
          total: result.Images?.length || 0,
          active: result.Images?.filter((i: any) => i.Containers > 0).length || 0,
          size: result.LayersSize || 0
        },
        containers: {
          total: result.Containers?.length || 0,
          size: result.Containers?.reduce((sum: number, c: any) => sum + (c.SizeRw || 0), 0) || 0
        },
        volumes: {
          total: result.Volumes?.length || 0,
          active: result.Volumes?.filter((v: any) => v.UsageData?.Size > 0).length || 0,
          size: result.Volumes?.reduce((sum: number, v: any) => sum + (v.UsageData?.Size || 0), 0) || 0
        },
        buildCache: {
          items: result.BuildCache?.length || 0,
          size: result.BuildCache?.reduce((sum: number, b: any) => sum + (b.Size || 0), 0) || 0
        },
        reclaimable: result.BuildCache?.reduce((sum: number, b: any) => sum + (b.Size || 0), 0)
          + result.Images?.filter((i: any) => i.Containers === 0).reduce((sum: number, i: any) => sum + (i.SharedSize || 0), 0) || 0
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ====== 系统状态 ======
  app.get('/api/status', async (_req, res) => {
    try {
      const info = await docker.info()
      const containers = await docker.listContainers({ all: true })
      const envContainers = containers.filter((c) => c.Labels?.['envmanager.language'])
      const images = await docker.listImages({ all: true })

      let usedMemory = 0
      try {
        const allStats = await Promise.all(envContainers.map((c) =>
          docker.getContainer(c.Id).stats({ stream: false }).catch(() => null)
        ))
        usedMemory = allStats.reduce((sum, s) => sum + (s?.memory_stats?.usage || 0), 0)
      } catch { /* stats unavailable */ }

      res.json({
        docker: true,
        version: info.ServerVersion,
        containersRunning: envContainers.filter((c) => c.State === 'running').length,
        containersStopped: envContainers.filter((c) => c.State !== 'running').length,
        imagesCount: images.length,
        totalMemory: info.MemTotal || 0,
        usedMemory
      })
    } catch (err: any) {
      res.status(200).json({
        docker: false,
        error: err.message,
        connectionInfo: {
          platform: process.platform,
          dockerHost: process.env['DOCKER_HOST'] || null
        }
      })
    }
  })
}
