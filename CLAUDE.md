# CLAUDE.md

此文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

这是一个用于 RT-Thread 和 RT-Thread Smart 开发的 VS Code 扩展。该扩展遵循最小化干预 VS Code 的原则，同时允许用户使用 RT-Thread 的脚本功能进行个性化定制。

## 常用命令

### 开发相关
```bash
# Install dependencies
npm install

# Build Vue frontend (required before extension build)
npm run build:vue

# Compile TypeScript extension
npm run compile

# Watch mode for development
npm run watch

# Lint the code
npm run lint

# Run tests
npm run test

# Build extension package
npm run vscode:prepublish
```

### Vue 前端开发（在 src/vue 工作区中）
```bash
cd src/vue
npm install
npm run dev     # Development server
npm run build   # Production build
```

## 架构说明

### 扩展结构
- **主入口**: `src/extension.ts` - 基于 `rtconfig.h` 或 `.vscode/workspace.json` 的存在来激活
- **两种运行模式**:
  - **项目模式** (`isRTThread`): 包含 `rtconfig.h` 的单个 RT-Thread 项目
  - **工作区模式** (`isRTThreadWorksapce`): 通过 `.vscode/workspace.json` 管理的多个 BSP 项目

### 核心组件
1. **Webviews** (`src/webviews/`): 管理基于 Vue 的 UI 面板
   - 设置、关于、创建项目、项目视图
   - 每个 webview 在 `src/vue/` 中都有对应的 Vue 应用

2. **项目管理** (`src/project/`):
   - 文件资源管理器的树形提供器
   - 用于视觉指示的文件装饰提供器
   - BSP 项目的命令执行

3. **终端集成** (`src/terminal.ts`):
   - 管理 RT-Thread 终端会话
   - 执行构建命令和自定义菜单命令

4. **虚拟环境** (`src/venv.ts`):
   - Windows 特定的 Python 虚拟环境设置
   - 管理 env 脚本安装

### 配置文件
- **`.vscode/workspace.json`**: 多 BSP 工作区配置
- **`.vscode/project.json`**: 单个项目文件结构（由 scons 生成）
- **`~/.env/cfg.json`**: RT-Thread 源码路径配置
- **`~/.env/tools/scripts/sdk_cfg.json`**: 工具链配置

### 构建系统
- TypeScript 编译为 CommonJS 用于 VS Code 扩展
- Vue 3 + Element Plus 前端使用 Vite 构建
- 多页面 Vue 应用构建到 `out/` 目录
- 通过 `smart.parallelBuidNumber` 设置支持并行构建

### 关键设置
- `smart.menuCommands`: 自定义终端命令数组
- `smart.parallelBuidNumber`: 并行构建的 CPU 核心数

## 重要说明

1. 扩展仅在 RT-Thread 项目中激活（包含 `rtconfig.h` 或工作区配置）
2. Windows 系统在首次运行时需要设置 Python 虚拟环境
3. 必须先构建 Vue 前端再编译扩展
4. 扩展集成了 Python 扩展（`ms-python.python`）
5. 文件装饰器在工作区模式下标记当前活动的 BSP