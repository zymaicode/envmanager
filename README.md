# 环境管理平台 (EnvManager)

可视化创建、管理 Docker 容器化开发环境。不污染本机，用完即走。

## 功能

- **环境市场**：Python / Node.js / Java / Go / Rust / C++ 多版本选择，支持 MySQL / PostgreSQL / Redis / MongoDB 数据库
- **一键启动**：选择项目目录 → 自动创建容器，代码挂载到容器内运行
- **VS Code 远程开发**：一键打开 VS Code Remote SSH，代码在容器内编译运行
- **内置终端**：未安装 VS Code 时的降级方案，打开系统终端 `docker exec` 进容器
- **镜像管理**：常用镜像一键下载，批量清理，缓存状态检测
- **资源监控**：CPU / 内存实时进度条
- **首次使用向导**：引导检测 Docker → 选择语言镜像 → 预下载

## 安装

从 [Releases](../../releases) 下载安装包，或直接使用绿色版。

**前提**：需要安装 Docker Desktop（或其他 Docker 运行环境）。

## 开发

```bash
npm install
npm run dev
```

## 打包

```bash
npm run pack     # 免安装绿色版 → dist/win-unpacked/
npm run dist     # NSIS 安装包 → dist/环境管理平台 Setup x.x.x.exe
```
