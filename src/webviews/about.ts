import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as marked from 'marked';
import * as path from 'path';

let aboutViewPanel: vscode.WebviewPanel | null = null;
const name = "about";
const title = "About RT-Thread";

function renderReadmeMarkdown(context: vscode.ExtensionContext) {
    let homeDir = os.homedir();
    const venvPath = path.join(homeDir, ".env", ".venv");

    let status = "";

    if (fs.existsSync(venvPath) && fs.lstatSync(venvPath).isDirectory()) {
        status = "🆗";
    }
    else {
        status = "🆖";
    }

    const readmeMarkdownPath = path.join(context.extensionPath, 'README.md');
    let markdownText = fs.readFileSync(readmeMarkdownPath, 'utf8');
    markdownText = markdownText.replace(/\$\{status\}/g, status);
    let htmlContent = marked.parse(markdownText);

    return htmlContent;
}

export function openAboutWebview(context: vscode.ExtensionContext) {
    if (aboutViewPanel) {
        aboutViewPanel.reveal(vscode.ViewColumn.One);
    }
    else {
        const rootDir = path.join(context.extensionPath, 'out');
        const panel = vscode.window.createWebviewPanel('webview', title, vscode.ViewColumn.One, {
            enableScripts: true, // Enable javascript in the webview
            localResourceRoots: [vscode.Uri.file(rootDir)] // Only allow resources from vue view
        });
        const iconPath = path.join(context.extensionPath, 'resources', 'images', 'rt-thread.png');
        panel.iconPath = vscode.Uri.file(iconPath);

        // handle close webview event
        panel.onDidDispose(() => {
            aboutViewPanel = null;
        });

        // read out/${name}/index.html
        const indexHtmlPath = vscode.Uri.file(context.asAbsolutePath(`out/${name}/index.html`));
        const htmlFolder = vscode.Uri.file(context.asAbsolutePath(`out`));
        const indexHtmlContent = vscode.workspace.fs.readFile(indexHtmlPath).then(buffer => buffer.toString());

        // set html
        indexHtmlContent.then(content => {
            panel.webview.html = content.replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = htmlFolder.path + '/' + fileName;

                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });
        });
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'renderReadme':
                    let readme = renderReadmeMarkdown(context);
                    if (readme) {
                        panel.webview.postMessage({command: 'setReadme', data: readme});
                    }
                    return;
            }},
            undefined
        );

        aboutViewPanel = panel;
    }

    return aboutViewPanel;
}
