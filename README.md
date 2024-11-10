## RT-Thread VSCode扩展介绍

RT-Thread VSCode扩展是一个用于辅助RT-Thread (>v5.0.0)开发的VSCode扩展，它遵循简化同时灵活扩展的模式，对VSCode尽可能不侵入太多的方式，同时又可以通过RT-Thread本身脚本来定制化功能的方式。

### env脚本状态

虚拟Python环境安装状态: **${status}**

### 版本说明

**v0.4.10**
- 加入Project Files功能，可以显示RT-Thread目录以及Groups
  - 需要RT-Thread升级到最新版本，在生成vscode的配置时，也同时生成project.json文件，用于显示目录结构
- Home命令移到Commands中显示

**v0.4.9**
- 加入python扩展的依赖；
- 修正当不是rt-thread工程目录时，侧边栏错误的问题；

### env安装说明

📢 如未安装，请点击<a href="https://github.com/RT-Thread/env" target="_blank">链接</a>了解如何进行安装。

**💻 Windows用户** 请使用PowerShell运行如下的命令进行安装：

> wget https://gitee.com/RT-Thread-Mirror/env/raw/master/install_windows.ps1 -O install_windows.ps1 <br>
> set-executionpolicy remotesigned <br>
> .\install_windows.ps1 --gitee

### 扩展使用说明

扩展主要在几个入口上：

- 状态栏
  - 默认显示构建按钮，同时可以使用快捷键 `Ctrl+Shift+B` 进行构建。
  - 可设置自定义菜单项，没项对应到终端中的一个命令。可以使用快捷键 `Ctrl+Shift+M` 进行调用。
- 侧边栏
  - 点击后显示RT-Thread相关的侧边栏，包括：
    - 插件状态
    - 命令面板
