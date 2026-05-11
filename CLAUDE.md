# 环境管理平台 (EnvManager)

基于 Electron 的容器化开发环境管理桌面应用。可视化创建、管理 Docker 开发容器，支持 VS Code 远程开发和内置终端。

## 版本

当前版本 **v0.2.0**

### v0.2.0 新增
- **首次使用向导**：4 步引导（Docker 检测 → 选择语言镜像 → 一键下载 → 进入）
- **异步容器创建**：轮询进度反馈，5 个真实阶段，失败自动回滚
- **内置终端**：`docker exec -it` 打开系统终端，VS Code 降级方案
- **数据库模板**：MySQL 8.0/8.4、PostgreSQL 16/17、Redis 7、MongoDB 7
- **资源监控**：CPU/内存进度条，Header 内存显示
- **克隆环境**：基于现有容器快速创建同语言版本的新环境

### v0.1.0 基础
- 环境市场（6 种语言 × 多个版本）
- 容器生命周期管理（创建/启停/销毁/日志）
- 镜像管理（下载/删除/批量清理）
- VS Code Remote SSH 集成
- 系统设置（端口/路径/清理策略持久化）

## 技术栈

- **桌面框架**: Electron + electron-vite
- **前端**: React 18 + TypeScript + Tailwind CSS v4
- **UI 图标**: lucide-react
- **状态管理**: Zustand
- **路由**: react-router v7 (HashRouter)
- **后端**: Express (Electron main process 内嵌)
- **Docker 交互**: dockerode
- **打包**: electron-builder（免安装绿色版 + NSIS 安装包）

## 项目结构

```
src/
├── main/                 # Electron 主进程
│   ├── index.ts          # 窗口管理（1280×800，1024×768 最小）
│   ├── server.ts         # Express API Server（端口 20920）+ Docker 操作
│   └── ipc-handlers.ts   # IPC 通道（选目录/VS Code/终端）
├── preload/
│   └── index.ts          # contextBridge 暴露 electronAPI
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx      # React 入口
        ├── App.tsx       # 路由 + 首次使用向导集成
        ├── index.css     # Tailwind v4 @theme（配色 + 字号）
        ├── layouts/
        │   └── AppLayout.tsx      # Sidebar + Header + Outlet
        ├── pages/
        │   ├── Marketplace.tsx    # 环境市场（搜索/卡片/版本抽屉/创建）
        │   ├── Workspace.tsx      # 我的工作台（统计/卡片表格双视图/操作）
        │   ├── ImageManager.tsx   # 镜像管理（常用下载/列表/清理）
        │   └── Settings.tsx       # 系统设置（端口/路径/镜像源/清理策略）
        ├── components/
        │   ├── Sidebar.tsx        # 侧边栏导航
        │   ├── Header.tsx         # 顶部栏（Docker 状态）
        │   └── SetupWizard.tsx    # 首次使用向导（4 步）
        ├── stores/
        │   ├── marketplace-store.ts  # 环境市场状态
        │   ├── container-store.ts    # 容器列表 + 系统状态
        │   ├── image-store.ts        # 镜像列表
        │   └── settings-store.ts     # 设置（localStorage 持久化）
        ├── lib/
        │   ├── api.ts    # HTTP API 封装（fetch 127.0.0.1:20920）
        │   └── utils.ts  # cn()、formatBytes()、formatUptime()
        └── types/
            └── index.ts  # TypeScript 类型 + Window.electronAPI 声明
```

## 常用命令

```bash
npm run dev      # 开发模式（热更新，renderer 端口 5173）
npm run build    # electron-vite 构建（检查用）
npm run pack     # 免安装绿色版 → dist/win-unpacked/
npm run dist     # NSIS 安装包 → dist/环境管理平台 Setup x.x.x.exe
```

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/environments` | 环境模板列表（支持 `?category=` 过滤） |
| GET | `/api/containers` | 运行中容器列表（仅 envmanager 标签的） |
| GET | `/api/containers/:id` | 容器详情（含实时 stats） |
| POST | `/api/containers` | 创建容器（返回 taskId，轮询进度） |
| GET | `/api/containers/create/:taskId` | 查询创建进度 |
| POST | `/api/containers/:id/stop` | 停止容器 |
| POST | `/api/containers/:id/start` | 启动容器 |
| DELETE | `/api/containers/:id` | 强制销毁容器 |
| GET | `/api/containers/:id/logs` | 获取容器日志 |
| POST | `/api/containers/:id/open-vscode` | 生成 VS Code SSH 配置 |
| GET | `/api/images` | 本地镜像列表 |
| POST | `/api/images/pull` | 拉取镜像 |
| DELETE | `/api/images/:id` | 删除镜像 |
| POST | `/api/images/cleanup` | 批量清理悬空镜像 |
| GET | `/api/images/check/:image` | 检查镜像是否已缓存 |
| GET | `/api/status` | Docker 系统状态 |

## 设计规范

- **配色**: 低饱和度暖白 + 柔和中性色系
  - 主背景 `#F7F5F2` / 卡片 `#FFFFFF` / 强调色 `#B97C57`（暖棕） / 边框 `#E8E4DF`
  - 状态色：运行 `#7BA87F` / 停止 `#D4A853` / 异常 `#C4665A`
- **字号**: 桌面基准 13px（覆盖了 Tailwind 默认的 16px 基准）
  - `text-xs`: 11px / `text-sm`: 13px / `text-base`: 14px / `text-lg`: 15px / `text-xl`: 17px / `text-2xl`: 20px
- 所有自定义主题色和字号在 `src/renderer/src/index.css` 的 `@theme` 块中定义

## 关键设计决策

- **镜像不自动拉取**：创建容器时先检查本地缓存，未找到返回 IMAGE_NOT_FOUND + 引导去镜像页
- **异步创建 + 轮询**：POST /api/containers 立即返回 taskId，前端每 500ms 轮询进度
- **失败自动回滚**：创建过程中任何步骤失败，自动 force remove 容器
- **数据库模板**：独立于语言模板，无 SSH 无工作目录挂载，有环境变量 + 数据端口
- **克隆环境**：工作台 → 点击克隆 → 跳转市场页预填语言/版本 → 选择新目录 → 创建
- **终端降级方案**：开系统终端窗口执行 `docker exec -it`，不依赖 xterm.js
- Electron 窗口 1280×800，最小 1024×768
- 首次启动弹出 SetupWizard，完成后 `localStorage` 标记不再显示
