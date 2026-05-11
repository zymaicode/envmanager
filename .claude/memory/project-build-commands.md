---
name: project-build-commands
description: 项目打包命令和方式记录
type: project
---

## 打包命令

| 命令 | 产物 | 说明 |
|------|------|------|
| `npm run pack` | `dist/win-unpacked/` | 免安装绿色版，直接运行 |
| `npm run dist` | `dist/*.exe` | NSIS 安装包 |

**Why:** 开发预览用 pack（快速），交付用户用 dist（安装包）。

**How to apply:** 每次需要构建成品时使用这两个命令。pack 体积更小、速度更快适合调试。
