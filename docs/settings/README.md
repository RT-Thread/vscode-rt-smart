# RT-Thread Setting

## Env 环境

从侧边栏 `RT-Thread Setting` 或命令面板 `Show RT-Thread Setting` 打开。

- 未安装时显示安装按钮；安装路径为当前用户的 `~/.env`。
- 已安装时显示版本、Git 修订、更新及删除按钮。
- 安装和更新在页面中显示执行日志，长时间运行时提供强制关闭入口。
- 删除需要确认，取消不会触发删除。
- 更新只涉及 `~/.env/tools/scripts` 和 `~/.env/packages/packages`，不再更新独立 SDK 索引。

Windows、Linux 的安装继续使用现有 Env 安装脚本。安装前需准备系统已有的网络下载、Git 和脚本运行环境。删除操作不可恢复，应先备份用户自行保存到 `~/.env` 的内容。

## RT-Thread 根目录

Env 操作区域下方保留 RT-Thread 根目录配置，供 `Create Project` 使用。

- 配置保存于 `~/.env/cfg.json`。
- 保存前需要先安装 Env，不会因保存配置而创建一个不完整的 `.env` 目录。
- 配置仍采用数组结构；只更新名称为 `RT-Thread` 的条目，保留其他条目。
- 工具链路径、SDK 安装及管理不再由本页面负责。

## 移除的功能

扩展不再提供 Kconfig webview、SDK 管理器、工具链设置或 Symbolic Analysis。终端 menuconfig、已有 Kconfig 扩展集成、构建、软件包命令和工程创建功能保留。

现有 `sdk_cfg.json`、SDK 安装目录和工具链文件不会被迁移或删除；扩展不再读取或写入 SDK 配置。
