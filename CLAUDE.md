# 环境管理平台 (EnvManager)

可视化创建、管理 Docker 容器化开发环境。支持两种部署形态，共用 90% 代码。

## 部署形态

| 形态 | 入口 | 用户场景 | 启动方式 |
|------|------|---------|---------|
| **Electron 桌面版** | `src/main/index.ts` | 个人开发者双击打开 | `npm run dev` → Electron 窗口 |
| **Docker 自托管版** | `server/index.ts` | 团队/服务器部署，浏览器访问 | `docker compose up -d` → `http://localhost:20920` |

两种形态共用 Express 路由（`src/main/routes.ts`）+ React 前端（`src/renderer/`）+ dockerode 逻辑（`src/main/docker.ts`）。

## 版本

当前版本 **v0.2.2**

### v0.2.2 新增
- 容器配置热编辑（端口映射在线修改）
- 磁盘空间可视化（docker system df + 一键清理）
- 容器自动休眠（闲置 N 分钟后自动暂停）
- 应用自动更新（GitHub Releases）
- 镜像拉取进度实时展示（图层级下载状态）
- Docker 连接实探（API 探针替代文件检测）
- 打包产物按版本归档

### 历史版本
- v0.2.1: 容器交互修复 + 环境就绪验证 + 代码审查优化 + 模块化拆分
- v0.2.0: 首次使用向导 + 异步创建 + 内置终端 + 数据库模板 + 克隆环境 + 资源监控

## 技术栈

- **桌面框架**: Electron + electron-vite
- **前端**: React 18 + TypeScript + Tailwind CSS v4
- **UI 图标**: lucide-react
- **状态管理**: Zustand
- **路由**: react-router v7 (HashRouter)
- **后端**: Express（桌面版内嵌 Electron main process，Docker 版独立启动）
- **Docker 交互**: dockerode
- **打包**: electron-builder（桌面版） + Docker 镜像（自托管版）
- **测试**: vitest（12 测试）

## 项目结构

```
src/
├── main/                      # 后端核心（两种形态共用）
│   ├── index.ts               # Electron 桌面版入口（窗口管理 + 调用 server）
│   ├── server.ts              # Express 启动入口
│   ├── routes.ts              # 所有 API 路由（~260 行）
│   ├── docker.ts              # Docker 连接 + 辅助函数（~165 行）
│   ├── templates.ts           # 环境模板配置数据（~115 行）
│   ├── ipc-handlers.ts        # Electron IPC 通道
│   └── __tests__/             # 后端测试
├── preload/
│   └── index.ts               # contextBridge（仅桌面版使用）
├── renderer/                  # React 前端（两种形态共用）
│   └── src/
│       ├── main.tsx / App.tsx / index.css
│       ├── layouts/           # AppLayout
│       ├── pages/             # Marketplace / Workspace / ImageManager / Settings
│       ├── components/        # Sidebar / Header / SetupWizard
│       ├── stores/            # marketplace / container / image / settings
│       └── lib/               # api.ts / utils.ts / types/
├── server/                    # Docker 自托管版入口（新增）
│   └── index.ts               # 纯 Express 启动（不依赖 Electron）
├── docker/                    # Docker 部署文件（新增）
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── entrypoint.sh
└── scripts/                   # 构建脚本
    └── archive-build.js       # 打包产物版本归档
```

## 常用命令

```bash
# 开发
npm run dev           # Electron 桌面版开发模式
npm run test          # 运行测试

# 桌面版打包
npm run dist          # 安装包 + 绿色版（一步产出两种）
npm run dist:installer  # 仅 NSIS 安装包
npm run dist:portable   # 仅绿色版

# Docker 版
docker compose up -d  # 启动 Docker 自托管版
docker compose down   # 停止
```

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/environments` | 环境模板列表（支持 `?category=` 过滤） |
| GET | `/api/containers` | 运行中容器列表（仅 envmanager 标签的） |
| GET | `/api/containers/:id` | 容器详情（含实时 stats） |
| POST | `/api/containers` | 创建容器（返回 taskId，轮询进度） |
| GET | `/api/containers/create/:taskId` | 查询创建进度 |
| PUT | `/api/containers/:id/config` | 更新容器配置（端口映射） |
| GET | `/api/containers/:id/config` | 获取容器可编辑配置 |
| POST | `/api/containers/:id/stop` | 停止容器 |
| POST | `/api/containers/:id/start` | 启动容器 |
| DELETE | `/api/containers/:id` | 强制销毁容器 |
| GET | `/api/containers/:id/logs` | 获取容器日志 |
| POST | `/api/containers/:id/exec` | 在容器中执行命令 |
| POST | `/api/containers/:id/open-vscode` | 打开终端 |
| GET | `/api/images` | 本地镜像列表 |
| POST | `/api/images/pull` | 拉取镜像（异步 + 进度） |
| GET | `/api/images/pull/:taskId` | 查询拉取进度 |
| DELETE | `/api/images/:id` | 删除镜像 |
| POST | `/api/images/cleanup` | 批量清理悬空镜像 |
| GET | `/api/images/check/:image` | 检查镜像是否已缓存 |
| GET | `/api/system/disk-usage` | 磁盘空间使用详情 |
| POST | `/api/system/auto-sleep/config` | 配置容器自动休眠 |
| GET | `/api/status` | Docker 系统状态 |

## 设计规范

- **配色**: 低饱和度暖白 + 柔和中性色系
  - 主背景 `#F7F5F2` / 卡片 `#FFFFFF` / 强调色 `#B97C57`（暖棕） / 边框 `#E8E4DF`
  - 状态色：运行 `#7BA87F` / 停止 `#D4A853` / 异常 `#C4665A`
- **字号**: 桌面基准 13px（覆盖 Tailwind 默认 16px 基准）
- 所有自定义主题色和字号在 `src/renderer/src/index.css` 的 `@theme` 块中定义

## 关键设计决策

- 两种部署形态共用 Express + React + dockerode，不互相替代
- 镜像不自动拉取，创建容器时检查本地缓存
- 异步创建 + 轮询，失败自动回滚
- Docker 连接用 API 实探而非文件系统检测
- 数据库模板独立于语言模板，无 SSH/工作目录挂载
- 打包产物按版本归档，保留最近 5 个版本
- GitHub 公开文档使用英文
