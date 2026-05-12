import express from 'express'
import Docker from 'dockerode'
import path from 'path'
import os from 'os'
import { docker, mapContainer, getContainerDetail, findFreePort, VERSION_COMMANDS, normalizeProjectPath } from './docker'
import { allTemplates, databaseTemplates } from './templates'

export function registerRoutes(app: express.Express): void {
  // ====== 创建任务状态缓存 ======
  const creationTasks = new Map<string, { phase: string; containerId?: string; sshPort?: number; verifiedVersion?: string; error?: string; done: boolean }>()

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

  // ====== 镜像操作 ======
  app.post('/api/images/pull', async (req, res) => {
    try {
      const { image } = req.body
      if (!image) return res.status(400).json({ error: 'Image name required' })
      await docker.pull(image)
      res.json({ success: true, message: 'Image pulled successfully' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
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
