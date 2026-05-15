---
name: project-dual-deploy
description: 项目双部署形态：桌面版 + Docker 自托管版，共用 90% 代码
type: project
---

EnvManager 同时走两个部署方向，不互相替代：

| 形态 | 入口 | 用户场景 |
|------|------|---------|
| Electron 桌面版 | `src/main/index.ts` | 个人开发者双击打开 |
| Docker 自托管版 | `server/index.ts` | 团队/服务器部署，浏览器访问 |

**Why:** 桌面版体验最直接，Docker 版支持团队共享、远程访问、API 编程调用。两者共用 Express 路由 + React 前端 + dockerode 逻辑。

**How to apply:** 新增功能同时考虑两种部署形态。桌面版入口负责窗口管理/IPC，Docker 版入口只启动 Express。业务代码不区分部署形态。
