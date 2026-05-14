---
name: project-build-commands
description: 项目打包命令和方式记录
type: project
---

## 打包命令

| 命令 | 产物 | 说明 |
|------|------|------|
| `npm run dist` | `dist/环境管理平台 Setup x.x.x.exe` + `dist/win-unpacked/环境管理平台.exe` | **一步产出两种**：NSIS 安装包 + 免安装绿色版 |
| `npm run dist:installer` | `dist/环境管理平台 Setup x.x.x.exe` | 仅 NSIS 安装包 |
| `npm run dist:portable` | `dist/win-unpacked/环境管理平台.exe` | 仅免安装绿色版 |

**Why:** `dist` 命令打包两种产物，绿色版方便测试，安装包给用户交付。

**How to apply:** 每次版本迭代后执行 `npm run dist`，确认 `dist/` 下两个产物均正常。
