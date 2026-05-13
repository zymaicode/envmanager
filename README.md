# EnvManager

Visual Docker containerized dev environment manager. Create isolated development environments with one click — no host pollution, disposable when done.

## Features

- **Environment Marketplace**: Python / Node.js / Java / Go / Rust / C++ (multiple versions), plus MySQL / PostgreSQL / Redis / MongoDB databases
- **One-Click Launch**: Select project directory → container auto-created with code mounted inside
- **Built-in Terminal**: `docker exec` straight into the container via system terminal
- **Image Management**: One-click download for common images, batch cleanup, cache detection
- **Resource Monitoring**: Real-time CPU / memory progress bars
- **Setup Wizard**: Guided Docker detection → language image pre-download on first launch
- **Container Config Editing**: Hot-edit port mappings on running containers
- **Auto Sleep**: Idle containers auto-pause after configurable idle threshold
- **Disk Visualization**: `docker system df` integration with one-click reclaim
- **Auto Update**: GitHub Releases-based update delivery

## Installation

Download the installer from [Releases](../../releases), or use the portable build.

**Prerequisite**: Docker Desktop (or any Docker runtime).

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run pack     # Portable build → dist/win-unpacked/
npm run dist     # NSIS installer → dist/EnvManager Setup x.x.x.exe
```

## License

MIT
