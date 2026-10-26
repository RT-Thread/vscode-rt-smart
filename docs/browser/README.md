# 在编辑器中打开网页

## 命令面板

执行 `RT-Thread: Open Web URL in Editor`，输入完整的 HTTP 或 HTTPS 地址。

扩展命令为 `extension.openWebUrl`，也可以由其他扩展调用并传入地址字符串：

```ts
await vscode.commands.executeCommand('extension.openWebUrl', 'http://localhost:3000/');
```

## code 命令行

安装并启用本扩展后，可以直接使用 VS Code 的 URI 打开入口，无需打开 RT-Thread 工程：

```bash
code --open-url "vscode://rt-thread.rt-thread-smart/open-web?url=https%3A%2F%2Fwww.rt-thread.org"
```

仅支持一个 `url` 参数。其值必须是完整目标地址经过一次 URL 编码的结果；不要在扩展 URI 上附加其他参数。

含查询参数、片段或中文时，推荐程序生成 URI。Linux 示例：

```bash
code --open-url "$(node -e 'console.log("vscode://rt-thread.rt-thread-smart/open-web?url=" + encodeURIComponent(process.argv[1]))' 'http://localhost:3000/docs?a=1&b=2#intro')"
```

Windows PowerShell 示例：

```powershell
$url = 'http://localhost:3000/docs?a=1&b=2#intro'
$encodedUrl = [Uri]::EscapeDataString($url)
code --open-url "vscode://rt-thread.rt-thread-smart/open-web?url=$encodedUrl"
```

VS Code Insiders 应使用 `code-insiders` 命令和 `vscode-insiders://` 协议。

## 兼容性与限制

- 优先使用可用的集成浏览器命令 `workbench.action.browser.open`，旧版本使用 `simpleBrowser.show`。
- Simple Browser 无法显示通过 `X-Frame-Options` 或 CSP 禁止嵌入的站点；这不是链接参数错误。
- 内置浏览器不可用时明确报错，不会自动转到系统浏览器。
- 只允许 HTTP/HTTPS，拒绝 `command:`、`file:`、`javascript:` 等协议及包含用户名或密码的地址。
- `/auth-callback` 仍由原认证模块处理，网页入口不会覆盖登录回调。
- VS Code 的 URI 打开确认提示由编辑器自身控制。
