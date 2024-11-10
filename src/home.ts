import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as marked from 'marked';

let homeViewPanel: vscode.WebviewPanel | null = null;

export function openWebView(title: string, url: string, context: vscode.ExtensionContext) {
    if (homeViewPanel) {
        homeViewPanel.reveal(vscode.ViewColumn.One);
    } else {
        homeViewPanel = vscode.window.createWebviewPanel(
            'RT-Thread Home', // Identifier for the type of the webview
            title,
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            {
                enableScripts: true, // Enable javascript in the webview
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'resources'))]
            }
        );

        const iconPath = path.join(context.extensionPath, 'resources', 'images', 'rt-thread.png');
        homeViewPanel.iconPath = vscode.Uri.file(iconPath);

        homeViewPanel.webview.html = initialHomeviewContent(context, homeViewPanel.webview);
        homeViewPanel.onDidDispose(() => {
            homeViewPanel = null;
        }, null, context.subscriptions);
    }
}

function initialHomeviewContent(context: vscode.ExtensionContext, webview: vscode.Webview) {
    let homeDir = os.homedir();
    const venvPath = path.join(homeDir, ".env", ".venv");

    const extensionId = 'rt-thread.rt-thread-smart';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension ? extension.packageJSON.version : 'Not installed';

    let status = "";

    if (fs.existsSync(venvPath) && fs.lstatSync(venvPath).isDirectory()) {
        status = "🆗";
    }
    else {
        status = "🆖";
    }

    let logoPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'images', 'rt-thread-logo.png'));
    const logoUrl = webview.asWebviewUri(logoPath);

    const readmeMarkdownPath = path.join(context.extensionPath, 'README.md');
    let markdownText = fs.readFileSync(readmeMarkdownPath, 'utf8');
    markdownText = markdownText.replace(/\$\{status\}/g, status);
    let htmlContent = marked.parse(markdownText);

    return `
        <!DOCTYPE html>
        <html>

        <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Home</title>
        </head>

        <body>
            ${htmlContent}
        </body>
        </html>
    `;
}
