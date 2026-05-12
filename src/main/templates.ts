export interface TemplateVersion {
  version: string
  image: string
  size: string
  tools: string[]
  isLTS: boolean
}

export interface Template {
  id: string
  name: string
  icon: string
  color: string
  description: string
  category: 'backend' | 'frontend' | 'data' | 'systems'
  versions: TemplateVersion[]
  isDatabase?: boolean
  defaultPorts?: { container: number; host: number; type: 'web' }[]
  env?: Record<string, string>
}

export const templates: Template[] = [
  {
    id: 'python', name: 'Python', icon: 'python', color: '#3776AB',
    description: 'Python 开发环境，支持数据科学与 Web 开发', category: 'backend',
    versions: [
      { version: '3.10', image: 'python:3.10-slim', size: '~150 MB', tools: ['pip'], isLTS: true },
      { version: '3.11', image: 'python:3.11-slim', size: '~160 MB', tools: ['pip'], isLTS: true },
      { version: '3.12', image: 'python:3.12-slim', size: '~160 MB', tools: ['pip'], isLTS: true },
      { version: '3.13', image: 'python:3.13-slim', size: '~170 MB', tools: ['pip'], isLTS: false }
    ]
  },
  {
    id: 'node', name: 'Node.js', icon: 'nodejs', color: '#339933',
    description: 'Node.js 开发环境，支持前端与后端开发', category: 'backend',
    versions: [
      { version: '18', image: 'node:18-slim', size: '~250 MB', tools: ['npm', 'yarn'], isLTS: true },
      { version: '20', image: 'node:20-slim', size: '~260 MB', tools: ['npm', 'yarn'], isLTS: true },
      { version: '22', image: 'node:22-slim', size: '~270 MB', tools: ['npm', 'yarn', 'pnpm'], isLTS: true },
      { version: '23', image: 'node:23-slim', size: '~270 MB', tools: ['npm', 'yarn', 'pnpm'], isLTS: false }
    ]
  },
  {
    id: 'java', name: 'Java', icon: 'java', color: '#ED8B00',
    description: 'Java 开发环境，支持 Maven/Gradle 构建', category: 'backend',
    versions: [
      { version: '17', image: 'eclipse-temurin:17-jdk', size: '~450 MB', tools: ['Maven'], isLTS: true },
      { version: '21', image: 'eclipse-temurin:21-jdk', size: '~460 MB', tools: ['Maven', 'Gradle'], isLTS: true }
    ]
  },
  {
    id: 'go', name: 'Go', icon: 'go', color: '#00ADD8',
    description: 'Go 开发环境，支持模块管理与调试', category: 'backend',
    versions: [
      { version: '1.22', image: 'golang:1.22-bookworm', size: '~850 MB', tools: ['Go Modules'], isLTS: true },
      { version: '1.23', image: 'golang:1.23-bookworm', size: '~880 MB', tools: ['Go Modules'], isLTS: false }
    ]
  },
  {
    id: 'rust', name: 'Rust', icon: 'rust', color: '#DEA584',
    description: 'Rust 开发环境，包含 Cargo 与常用工具链', category: 'systems',
    versions: [
      { version: '1.78', image: 'rust:1.78-slim-bookworm', size: '~800 MB', tools: ['Cargo', 'rustup'], isLTS: true },
      { version: 'latest', image: 'rust:latest', size: '~850 MB', tools: ['Cargo', 'rustup', 'Clippy'], isLTS: false }
    ]
  },
  {
    id: 'cpp', name: 'C/C++', icon: 'cpp', color: '#00599C',
    description: 'C/C++ 开发环境，包含 GCC + CMake 工具链', category: 'systems',
    versions: [
      { version: '12', image: 'gcc:12-bookworm', size: '~1.2 GB', tools: ['CMake', 'GDB'], isLTS: true },
      { version: '14', image: 'gcc:14-bookworm', size: '~1.3 GB', tools: ['CMake', 'GDB'], isLTS: false }
    ]
  }
]

export const databaseTemplates: Template[] = [
  {
    id: 'mysql', name: 'MySQL', icon: 'mysql', color: '#4479A1',
    description: 'MySQL 数据库服务，企业级关系型数据库', category: 'data',
    versions: [
      { version: '8.0', image: 'mysql:8.0', size: '~580 MB', tools: ['mysqlsh'], isLTS: true },
      { version: '8.4', image: 'mysql:8.4', size: '~600 MB', tools: ['mysqlsh'], isLTS: true }
    ],
    defaultPorts: [{ container: 3306, host: 3306, type: 'web' }],
    env: { MYSQL_ROOT_PASSWORD: 'envmanager' }
  },
  {
    id: 'postgres', name: 'PostgreSQL', icon: 'postgres', color: '#336791',
    description: 'PostgreSQL 数据库服务，功能强大的开源关系型数据库', category: 'data',
    versions: [
      { version: '16', image: 'postgres:16-alpine', size: '~270 MB', tools: ['psql'], isLTS: true },
      { version: '17', image: 'postgres:17-alpine', size: '~280 MB', tools: ['psql'], isLTS: false }
    ],
    defaultPorts: [{ container: 5432, host: 5432, type: 'web' }],
    env: { POSTGRES_PASSWORD: 'envmanager' }
  },
  {
    id: 'redis', name: 'Redis', icon: 'redis', color: '#DC382D',
    description: 'Redis 缓存服务，高性能内存键值存储', category: 'data',
    versions: [
      { version: '7', image: 'redis:7-alpine', size: '~40 MB', tools: ['redis-cli'], isLTS: true }
    ],
    defaultPorts: [{ container: 6379, host: 6379, type: 'web' }],
    env: {}
  },
  {
    id: 'mongo', name: 'MongoDB', icon: 'mongo', color: '#47A248',
    description: 'MongoDB 数据库服务，高性能 NoSQL 文档数据库', category: 'data',
    versions: [
      { version: '7', image: 'mongo:7', size: '~760 MB', tools: ['mongosh'], isLTS: true }
    ],
    defaultPorts: [{ container: 27017, host: 27017, type: 'web' }],
    env: {}
  }
]

export const allTemplates: Template[] = [...templates, ...databaseTemplates]
