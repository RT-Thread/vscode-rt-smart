import * as vscode from 'vscode';

let kconfigViewPanel: vscode.WebviewPanel | null = null;

export function openKconfigWebView(title: string, url: string, context: vscode.ExtensionContext) {
    if (kconfigViewPanel) {
        kconfigViewPanel.reveal(vscode.ViewColumn.One);
    } else {
        kconfigViewPanel = vscode.window.createWebviewPanel(
            'RT-Thread Settings', // Identifier for the type of the webview
            title, // Webview panel title
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            {} // Webview options
        );

        kconfigViewPanel.webview.options = {
            enableScripts: true
        };
        kconfigViewPanel.webview.html = getWebviewContent(url);
        kconfigViewPanel.onDidDispose(() => {
            kconfigViewPanel = null;
        }, null, context.subscriptions);
    }
}

function getWebviewContent(url: string) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
        <style>
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
        }

        .responsive-iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        </style>
        </head>
        <body>

        <div style="position: relative; height: 100%; width: 100%;">
        <iframe class="responsive-iframe" src="${url}" frameborder="0"></iframe>
        </div>

        </body>
        </html>
    `;
}
