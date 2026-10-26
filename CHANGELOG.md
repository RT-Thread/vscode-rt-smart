# Change Log

**v0.4.14**
- 移除 Kconfig webview、SDK 管理器、工具链设置及 Symbolic Analysis。
- 设置页聚焦 Env 管理，保留工程根目录配置和终端 menuconfig。
- 新增编辑器内网页命令及命令行 URI 入口，兼容原有登录回调。
- 修正运行时依赖打包，精简高亮库并排除测试文件。

**v0.4.10**
- 加入Project Files功能，可以显示RT-Thread目录以及Groups
  - 需要RT-Thread升级到最新版本，在生成vscode的配置时，也同时生成project.json文件，用于显示目录结构
- Home命令移到Commands中显示

**v0.4.9**
- 加入python扩展的依赖；
- 修正当不是rt-thread工程目录时，侧边栏错误的问题；

**v0.4.8**
- 初始版本
