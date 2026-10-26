import * as vscode from 'vscode';

interface BrowserCommands {
    getCommands(filterInternal?: boolean): Thenable<string[]>;
    executeCommand(command: string, url: string): Thenable<unknown>;
}

export function validateWebUrl(value: string): string {
    if (typeof value !== 'string') {
        throw new Error('请输入有效的 HTTP 或 HTTPS 地址。');
    }
    const input = value.trim();
    if (!/^https?:\/\//i.test(input) || /[\s\u0000-\u001f\u007f]/.test(input)) {
        throw new Error('请输入完整的 HTTP 或 HTTPS 地址。');
    }

    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new Error('网页地址无效。');
    }
    if (!url.hostname || url.username || url.password) {
        throw new Error('网页地址必须包含主机名，且不能包含用户名或密码。');
    }
    return url.toString();
}

export async function openWebUrl(value: string, commands: BrowserCommands = vscode.commands): Promise<void> {
    const url = validateWebUrl(value);
    const availableCommands = await commands.getCommands(true);
    const command = availableCommands.includes('workbench.action.browser.open')
        ? 'workbench.action.browser.open'
        : 'simpleBrowser.show';
    await commands.executeCommand(command, url);
}

export class ExtensionUriHandler implements vscode.UriHandler {
    constructor(
        private readonly authHandler: vscode.UriHandler,
        private readonly openBrowser: (url: string) => Promise<void> = openWebUrl,
    ) { }

    async handleUri(uri: vscode.Uri): Promise<void> {
        if (uri.path !== '/open-web') {
            await this.authHandler.handleUri(uri);
            return;
        }
        if (!uri.query.startsWith('url=')) {
            throw new Error('网页 URI 必须包含 url 参数。');
        }
        // VS Code already decodes the query; parsing it again would split the target URL.
        await this.openBrowser(validateWebUrl(uri.query.slice('url='.length)));
    }
}

async function reportErrors(action: () => Promise<void>): Promise<void> {
    try {
        await action();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await vscode.window.showErrorMessage(`RT-Thread: ${message}`);
    }
}

export function registerWebBrowser(context: vscode.ExtensionContext, authHandler: vscode.UriHandler): void {
    const uriHandler = new ExtensionUriHandler(authHandler);
    context.subscriptions.push(
        vscode.window.registerUriHandler({
            handleUri: uri => reportErrors(() => uriHandler.handleUri(uri)),
        }),
        vscode.commands.registerCommand('extension.openWebUrl', (value?: string) => reportErrors(async () => {
            const url = value ?? await vscode.window.showInputBox({
                title: '在编辑器中打开网页',
                prompt: 'HTTP 或 HTTPS 地址',
                placeHolder: 'https://www.rt-thread.org',
                ignoreFocusOut: true,
                validateInput: input => {
                    try {
                        validateWebUrl(input);
                        return undefined;
                    } catch (error) {
                        return error instanceof Error ? error.message : String(error);
                    }
                },
            });
            if (url !== undefined) {
                await openWebUrl(url);
            }
        })),
    );
}
