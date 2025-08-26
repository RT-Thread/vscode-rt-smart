# RT-Thread Smart Extension 配置文件说明

本文档详细说明了 RT-Thread Smart Extension 中使用的各种 JSON 配置文件的结构和字段含义。

## 目录

1. [工作区相关配置文件](#工作区相关配置文件)
2. [环境配置文件](#环境配置文件)
3. [资源配置文件](#资源配置文件)

---

## 工作区相关配置文件

这些配置文件位于项目工作区的 `.vscode` 目录下，用于管理项目结构和工作区设置。

### 1. project.json

**文件路径**: `{workspace}/.vscode/project.json`

**用途**: 存储单个 RT-Thread 项目的结构信息，包括分组和文件组织。

**结构说明**:

```json
{
  "RT-Thread": "项目根目录路径",
  "Groups": [
    {
      "name": "分组名称",
      "files": [
        "文件路径1",
        "文件路径2"
      ]
    }
  ]
}
```

**字段详解**:

- **RT-Thread** (string): RT-Thread 项目的根目录路径
  - 用于指定项目的主要源码目录
  - 可以是绝对路径或相对于工作区的相对路径

- **Groups** (array): 项目文件分组数组
  - **name** (string): 分组名称，在项目树中显示
  - **files** (array): 该分组包含的文件路径列表
    - 支持相对路径（相对于工作区根目录）
    - 支持以 `..` 开头的相对路径
    - 文件路径将自动解析为绝对路径

**使用场景**:
- 由 scons 构建工具生成，用于在 VS Code 中显示项目文件结构
- 支持文件分组管理，方便代码组织和浏览
- 在项目树视图中按分组显示源文件

### 2. workspace.json

**文件路径**: `{workspace}/.vscode/workspace.json`

**用途**: 管理多个 BSP（Board Support Package）项目的工作区配置。

**结构说明**:

```json
{
  "currentProject": "当前激活的项目路径",
  "bsps": {
    "folder": "BSP目录相对路径",
    "stars": [
      "bsp项目路径1",
      "bsp项目路径2"
    ]
  }
}
```

**字段详解**:

- **currentProject** (string): 当前激活的 BSP 项目路径
  - 指定当前工作的 BSP 项目
  - 用于在多个 BSP 项目之间切换
  - 路径相对于 bsps.folder 指定的目录

- **bsps** (object): BSP 项目配置
  - **folder** (string): BSP 项目的根目录，相对于工作区根目录
  - **stars** (array): 收藏的/可用的 BSP 项目列表
    - 每个项目路径相对于 `bsps.folder`
    - 支持嵌套目录结构（如 `stm32/stm32f407-rt-spark`）

**使用场景**:
- 工作区模式下管理多个 BSP 项目
- 在项目树中显示可用的 BSP 项目列表
- 支持项目切换和状态保存

### 3. rtthread.json

**文件路径**: `{workspace}/.vscode/rtthread.json`

**用途**: 存储 RT-Thread BSP 项目的板级信息和配置。

**结构说明**:

```json
{
  "board_info": {
    "name": "开发板名称",
    "description": "开发板描述",
    "manufacturer": "制造商",
    "board": "板型标识",
    "path": "BSP路径"
  }
}
```

**字段详解**:

- **board_info** (object): 开发板信息
  - **name** (string): 开发板的显示名称
  - **description** (string): 开发板的详细描述
  - **manufacturer** (string): 开发板制造商
  - **board** (string): 开发板的标识符，通常与目录名对应
  - **path** (string): BSP 在 RT-Thread 源码中的相对路径

**使用场景**:
- 在创建项目界面显示开发板信息
- 为特定 BSP 项目提供元数据
- 与 `resources/bi.json` 中的板级信息对应

---

## 环境配置文件

这些配置文件位于用户主目录的 `.env` 文件夹下，用于管理 RT-Thread 开发环境。

### 1. cfg.json

**文件路径**: `~/.env/cfg.json`

**用途**: 存储 RT-Thread 主干路径配置。

**结构说明**:

```json
[
  {
    "name": "配置项名称",
    "path": "RT-Thread主干路径",
    "description": "配置项描述"
  }
]
```

**字段详解**:

- **name** (string): 配置项的名称，通常为 "RT-Thread"
- **path** (string): RT-Thread 主干代码的本地路径
  - 指向 RT-Thread 源码仓库的根目录
  - 用于访问 BSP 和系统源码
- **description** (string): 配置项的描述信息

**使用场景**:
- 在设置界面配置 RT-Thread 源码路径
- 创建项目时定位 BSP 目录
- 提供系统源码访问路径

### 2. sdk_cfg.json

**文件路径**: `~/.env/tools/scripts/sdk_cfg.json`

**用途**: 存储工具链（SDK）配置信息。

**结构说明**:

```json
[
  {
    "name": "工具链名称",
    "path": "工具链路径",
    "description": "工具链描述"
  }
]
```

**字段详解**:

- **name** (string): 工具链的名称
  - 例如: "arm-none-eabi-gcc", "armcc", "iar" 等
- **path** (string): 工具链的安装路径
  - 指向编译器的 bin 目录或根目录
  - 用于构建时定位编译工具
- **description** (string): 工具链的描述信息
  - 例如: "ARM GNU GCC", "Keil MDK-ARM" 等

**使用场景**:
- 在设置界面管理多个工具链
- 为不同项目选择合适的编译工具链
- 自动配置构建环境

### 3. env.json

**文件路径**: `~/.env/tools/scripts/env.json`

**用途**: 存储环境脚本的版本信息。这个文件在env脚本git仓库中就默认携带。

**结构说明**:

```json
{
  "version": "环境脚本版本号"
}
```

**字段详解**:

- **version** (string): 环境脚本的版本号
  - 格式通常为语义化版本，如 "v2.0.1"
  - 用于显示和检查环境脚本更新

**使用场景**:
- 在设置界面显示当前环境版本
- 检查环境更新状态
- 版本兼容性检查

---

## 资源配置文件

### 1. bi.json (Board Information)

**文件路径**: `resources/bi.json`

**用途**: 创建工程时支持的开发板信息数据库。

**结构说明**:

```json
[
  {
    "manufacturer": "制造商名称",
    "boards": [
      {
        "name": "开发板名称",
        "description": "开发板描述",
        "board": "板型标识",
        "path": "BSP相对路径"
      }
    ]
  }
]
```

**字段详解**:

- **manufacturer** (string): 开发板制造商名称
  - 例如: "ST", "QEMU", "Raspberry Pi" 等
  - 用于在创建项目界面按制造商分类

- **boards** (array): 该制造商的开发板列表
  - **name** (string): 开发板的显示名称
  - **description** (string): 开发板的详细描述和特性
  - **board** (string): 开发板的唯一标识符
  - **path** (string): 在 RT-Thread 源码中的 BSP 相对路径

**使用场景**:
- 在创建项目向导中显示可用开发板
- 按制造商分类显示开发板选项
- 提供开发板详细信息和 BSP 路径映射

---

## 配置文件生命周期

1. **安装阶段**: 创建 `~/.env/` 目录和基础配置文件
2. **配置阶段**: 用户通过设置界面配置 `cfg.json` 和 `sdk_cfg.json`
3. **项目创建**: 生成 `.vscode/rtthread.json` 和相关配置
4. **构建阶段**: scons 生成 `.vscode/project.json` 或 `.vscode/workspace.json`
5. **运行阶段**: 扩展读取所有配置文件以提供功能

## 注意事项

1. **路径处理**: 所有相对路径都会被解析为绝对路径
2. **文件权限**: 确保配置文件具有适当的读写权限
3. **版本兼容**: 不同版本的扩展可能使用不同的配置格式
4. **备份建议**: 重要配置文件建议定期备份
5. **错误处理**: 配置文件损坏时，扩展会使用默认配置或显示错误提示

---

*此文档基于 RT-Thread Smart Extension v0.4.12 版本编写*
