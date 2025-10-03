import * as vscode from 'vscode';
import * as path from 'path';
import { postMessageExtensionData } from '../extension';
import { handleElf } from '../utils/elf/handleElf';

let analyzeViewPanel: vscode.WebviewPanel | null = null;
const name = "analyze";
const title = "Analyze RT-Thread";

export function openAnalyzeWebview(context: vscode.ExtensionContext) {
    if (analyzeViewPanel) {
        analyzeViewPanel.reveal(vscode.ViewColumn.One);
    }
    else {
        const rootDir = path.join(context.extensionPath, 'out');
        const panel = vscode.window.createWebviewPanel('webview', title, vscode.ViewColumn.One, {
            enableScripts: true, // Enable javascript in the webview
            retainContextWhenHidden: true, // Keep the webview's context when it is hidden
            localResourceRoots: [vscode.Uri.file(rootDir)] // Only allow resources from vue view
        });
        const iconPath = path.join(context.extensionPath, 'resources', 'images', 'rt-thread.png');
        panel.iconPath = vscode.Uri.file(iconPath);

        // handle close webview event
        panel.onDidDispose(() => {
            analyzeViewPanel = null;
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

        analyzeViewPanel = panel;
    }

    postMessageExtensionData(context, analyzeViewPanel);
    handleElf(context, analyzeViewPanel);

    return analyzeViewPanel;
}
