import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWorkspaceFolder } from '../api';

let workspaceViewPanel: vscode.WebviewPanel | null = null;
const name = "projects";
const title = "RT-Thread Workspace";

interface TreeNode {
    id: string,
    name: string;
    path: string;
    children: TreeNode[];
}

/**
 * Enumerates all subdirectories containing rtconfig.h file under the specified BSP directory.
 * @param bspDir The root BSP directory to search.
 * @returns An array of subdirectory paths containing rtconfig.h.
 */
async function findRtconfigDirectories(bspDir: string): Promise<TreeNode[]> {
    const root:TreeNode[] = [];

    async function searchDir(dir: string): Promise<void> {
        let parent:any = undefined
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name.includes('template'))
                continue; // Skip directories containing 'template'

            if (entry.isDirectory()) {
                const fullPath = path.join(dir, entry.name);

                if (fs.existsSync(path.join(fullPath, 'rtconfig.h'))) {
                    const node : TreeNode = {
                        id: "" + Math.random().toString(36).substring(2, 15),
                        name: path.basename(fullPath),
                        path: path.relative(bspDir, fullPath),
                        children: []
                    };

                    let items = node.path.split(path.sep);
                    if (items.length >= 2) {
                        // rename the node name
                        node.name = items.slice(1, items.length).join(path.sep);

                        if (parent == undefined) {
                            // search for the parent node in the root array
                            for (let i = 0; i < root.length; i++) {
                                if (root[i].name == items[0]) {
                                    parent = root[i];
                                    break;
                                }
                            }

                            // not found, create a new parent node
                            if (parent == undefined) {
                                const parent_node : TreeNode = {
                                    id: "" + Math.random().toString(36).substring(2, 15),
                                    name: items[0],
                                    path: items[0],
                                    children: []
                                };
                                root.push(parent_node);

                                parent = parent_node;
                            }

                            parent.children.push(node);
                        }
                        else {
                            parent.children.push(node);
                        }
                    }
                    else {
                        root.push(node);
                    }
                } else {
                    // If rtconfig.h is not found, continue searching in subdirectories
                    await searchDir(fullPath);
                }
            }
        }
    }

    await searchDir(bspDir);
    return root;
}

export function openWorkspaceProjectsWebview(context: vscode.ExtensionContext) {
    if (workspaceViewPanel) {
        workspaceViewPanel.reveal(vscode.ViewColumn.One);
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
            workspaceViewPanel = null;
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
                case 'searchBSPProjects':
                    let workspaceJson = path.join(getWorkspaceFolder() + '/' + '.vscode', 'workspace.json');
                    if (fs.existsSync(workspaceJson)) {
                        let j = JSON.parse(fs.readFileSync(workspaceJson, 'utf8'));
                        if (j.hasOwnProperty("bsps")) {
                            let bsps = j["bsps"];
                            if (bsps.hasOwnProperty("folder")) {
                                let bspFolder = getWorkspaceFolder() + '/' + bsps.folder;

                                findRtconfigDirectories(bspFolder).then((dirs) => {
                                    let stars:string[] = [];
                                    if (bsps.hasOwnProperty("stars")) {
                                        stars = bsps.stars;
                                    }

                                    panel.webview.postMessage({command: 'updateProjects', data: {dirs: dirs, stars: stars}});
                                });
                            }
                        }
                    }

                    break;
                
                case 'saveBSPProjects':
                    let stars = message.args[0];
                    // save the stars to the workspace.json file
                    let workspaceFile = path.join(getWorkspaceFolder() + '/' + '.vscode', 'workspace.json');
                    if (fs.existsSync(workspaceFile)) {
                        let j = JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
                        if (j.hasOwnProperty("bsps")) {
                            let bsps = j["bsps"];
                            bsps.stars = stars;
                            fs.writeFileSync(workspaceFile, JSON.stringify(j, null, 4), 'utf8');
                        }
                    }
                    break;
            }},
            undefined
        );

        workspaceViewPanel = panel;
    }

    return workspaceViewPanel;
}
