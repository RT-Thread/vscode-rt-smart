import path from 'path';
import * as vscode from 'vscode';
import os from 'os';
import fs from 'fs';
import { isRTThreadProject, getExtensionContext, getWorkspaceFolder } from './extension';
import { buildProjectTree, buildEmptyProjectTree, ProjectTreeItem, listFolderTreeItem } from './project/tree';

class CmdTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (isRTThreadProject() != true) {
            let noProject = new vscode.TreeItem("Not a RT-Thread Project");
            noProject.iconPath = new vscode.ThemeIcon("warning");
            noProject.label = "Not a RT-Thread Project";

            return [noProject];
        }

        if (!element) {
            let home = new vscode.TreeItem("Home", vscode.TreeItemCollapsibleState.None);
            home.iconPath = new vscode.ThemeIcon("home");
            home.label = "Home";
            home.command = {
                command: "extension.showHome",
                title: "show home page",
                arguments: [],
            };

            let build = new vscode.TreeItem("Build", vscode.TreeItemCollapsibleState.Expanded);
            build.iconPath = new vscode.ThemeIcon("github-action");
            build.label = "build";

            let setting = new vscode.TreeItem("Settings", vscode.TreeItemCollapsibleState.Expanded);
            setting.iconPath = new vscode.ThemeIcon("gear");
            setting.label = "settings";

            let packages = new vscode.TreeItem("Packages", vscode.TreeItemCollapsibleState.Collapsed);
            packages.iconPath = new vscode.ThemeIcon("extensions");
            packages.label = "packages";

            let about = new vscode.TreeItem("About", vscode.TreeItemCollapsibleState.None);
            about.iconPath = new vscode.ThemeIcon("info");
            about.label = "About";
            about.command = {
                command: "extension.showAbout",
                title: "show about page",
                arguments: [],
            }

            return [home, build, setting, packages, about];
        } else {
            if (element.label === 'build') {
                let cleanItem = new vscode.TreeItem("clean");
                cleanItem.iconPath = new vscode.ThemeIcon("clear-all");
                cleanItem.command = {
                    command: "extension.executeCommand",
                    title: "clean",
                    arguments: ["scons -c"],
                };

                const cpus = os.cpus().length;
                const sconsCmd = `scons -j${cpus}`;

                let cleanBuildItem = new vscode.TreeItem("clean & build");
                cleanBuildItem.iconPath = new vscode.ThemeIcon("sync");
                cleanBuildItem.command = {
                    command: "extension.executeCommand",
                    title: "clean & build",
                    arguments: ["scons -c", sconsCmd],
                };

                const buildItemLable = `build -cpu=${cpus}`;
                let buildItem = new vscode.TreeItem(buildItemLable);
                buildItem.iconPath = new vscode.ThemeIcon("zap");
                buildItem.command = {
                    command: "extension.executeCommand",
                    title: "build",
                    arguments: [sconsCmd],
                };

                return [cleanItem, cleanBuildItem, buildItem];
            }
            else if (element.label === "settings") {
                let menuconfigItem = new vscode.TreeItem("menuconfig");
                menuconfigItem.iconPath = new vscode.ThemeIcon("checklist");
                menuconfigItem.command = {
                    command: "extension.executeCommand",
                    title: "menuconfig",
                    arguments: ["scons --menuconfig"],
                };

                let vscodeItem = new vscode.TreeItem("vscode settings");
                vscodeItem.iconPath = new vscode.ThemeIcon("compare-changes");
                vscodeItem.command = {
                    command: "extension.executeCommand",
                    title: "vscode",
                    arguments: ["scons --cdb", "scons --target=vsc"],
                };

                let sdkSettingsItem = new vscode.TreeItem("sdk settings");
                sdkSettingsItem.iconPath = new vscode.ThemeIcon("settings");
                sdkSettingsItem.command = {
                    command: "extension.executeCommand",
                    title: "sdk-setting",
                    arguments: ["sdk"],
                }

                return [menuconfigItem, vscodeItem, sdkSettingsItem];
            }
            else if (element.label === "packages") {
                let pkgsListItem = new vscode.TreeItem("list");
                pkgsListItem.iconPath = new vscode.ThemeIcon("list-unordered");
                pkgsListItem.command = {
                    command: "extension.executeCommand",
                    title: "packages-list",
                    arguments: ["pkgs --list"],
                };

                let pkgsUpdateItem = new vscode.TreeItem("update");
                pkgsUpdateItem.iconPath = new vscode.ThemeIcon("sync");
                pkgsUpdateItem.command = {
                    command: "extension.executeCommand",
                    title: "packages-update",
                    arguments: ["pkgs --update"],
                }

                return [pkgsListItem, pkgsUpdateItem];
            }

            return Promise.resolve([]);
        }
    }
}

class ProjectFilesDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private projectRoot: ProjectTreeItem[] = [];

    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined> = new vscode.EventEmitter<ProjectTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ProjectTreeItem): vscode.ProviderResult<ProjectTreeItem[]> {
        let children: ProjectTreeItem[];

        if (element) {
            const treeElement = element.children;

            if (treeElement) {
                if (treeElement.length > 0) {
                }
                else if (element.contextType == "project_folder") {
                    listFolderTreeItem(element);
                }
            }
            else if (element.contextType == "project_folder") {
                listFolderTreeItem(element);
            }
            children = element.children;
        } else {
            const projectTree = this.createTreeItems();
            this.projectRoot = projectTree;
            children = projectTree;
        }

        return children;
    }

    private createTreeItems(): ProjectTreeItem[] {
        let jsonPath = getWorkspaceFolder() + "/.vscode/project.json";
        if (fs.existsSync(jsonPath)) {
            try {
                const json = fs.readFileSync(jsonPath, 'utf8');
                const jsonNode = JSON.parse(json);

                if (jsonNode.hasOwnProperty("RT-Thread") && jsonNode.hasOwnProperty("Groups")) {
                    return buildProjectTree(jsonNode);
                }
            }
            catch (err) {
                return buildEmptyProjectTree();
            }
        }

        /* build empty project tree */
        return buildEmptyProjectTree();
    }

    refresh(): void {
        // clear all node and rebuilt tree
        this.projectRoot = [];
        this._onDidChangeTreeData.fire(undefined);

        this.createTreeItems();
        this._onDidChangeTreeData.fire(undefined);
    }
}

export function initDockView(context: vscode.ExtensionContext) {
    const projectFilesDataprovider = new ProjectFilesDataProvider();
    const view = vscode.window.createTreeView('projectFilesId', {
        treeDataProvider: projectFilesDataprovider, showCollapseAll: true
    });
    context.subscriptions.push(view);
    vscode.commands.registerCommand('extension.refreshRTThread', () => projectFilesDataprovider.refresh());

    const treeDataprovider = new CmdTreeDataProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider("treeId", treeDataprovider));
}
