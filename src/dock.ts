import path from 'path';
import * as vscode from 'vscode';
import os from 'os';
import fs from 'fs';
import { getWorkspaceFolder, isRTThreadProject } from './api';
import { buildGroupsTree, buildProjectTree, buildEmptyProjectTree, ProjectTreeItem, listFolderTreeItem } from './project/tree';
import { cmds } from './cmds/index';

class CmdTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (isRTThreadProject() != true) {
            // only show Home command
            let home = new vscode.TreeItem("Home", vscode.TreeItemCollapsibleState.None);
            home.iconPath = new vscode.ThemeIcon("home");
            home.label = "Home";
            home.command = {
                command: "extension.showHome",
                title: "show home page",
                arguments: [],
            };

            return [home];
        }

        if (!element) {
            let children = [];
            let home = new vscode.TreeItem("Home", vscode.TreeItemCollapsibleState.None);
            home.iconPath = new vscode.ThemeIcon("home");
            home.label = "Home";
            home.command = {
                command: "extension.showHome",
                title: "show home page",
                arguments: [],
            };
            children.push(home);

            for (const [key, value] of Object.entries(cmds)) {
                let item = new vscode.TreeItem(value.name, value.isExpanded? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
                item.iconPath = new vscode.ThemeIcon(value.iconId);
                item.label = value.label;

                children.push(item);
            };

            let about = new vscode.TreeItem("About", vscode.TreeItemCollapsibleState.None);
            about.iconPath = new vscode.ThemeIcon("info");
            about.label = "About";
            about.command = {
                command: "extension.showAbout",
                title: "show about page",
                arguments: [],
            }
            children.push(about);

            return children;
        } else {
            let children:any = [];

            for (const [key, value] of Object.entries(cmds)) {
                if (element.label == value.label) {
                    for (const cmdItem of value.subcmds) {
                        let item = new vscode.TreeItem(cmdItem.name);
                        item.iconPath = new vscode.ThemeIcon(cmdItem.iconId);
                        item.command = {
                            command: "extension.executeCommand",
                            title: cmdItem.cmd.title,
                            arguments: cmdItem.cmd.arguments,
                        };

                        children.push(item);
                    };

                    return children;
                }
            }

            return Promise.resolve([]);
        }
    }
}

class GroupsDataProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private groupsRoot: ProjectTreeItem[] = [];

    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined> = new vscode.EventEmitter<ProjectTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined> = this._onDidChangeTreeData.event;

    private createTreeItems(): ProjectTreeItem[] {
        let jsonPath = getWorkspaceFolder() + "/.vscode/project.json";
        if (fs.existsSync(jsonPath)) {
            try {
                const json = fs.readFileSync(jsonPath, 'utf8');
                const jsonNode = JSON.parse(json);

                if (jsonNode.hasOwnProperty("Groups")) {
                    return buildGroupsTree(jsonNode);
                }
            }
            catch (err) {
                return buildEmptyProjectTree();
            }
        }

        /* build empty project tree */
        return buildEmptyProjectTree();
    }

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
            const tree = this.createTreeItems();
            this.groupsRoot = tree;
            children = tree;
        }

        return children;
    }

    refresh(): void {
        // clear all node and rebuilt tree
        this.groupsRoot = [];
        this._onDidChangeTreeData.fire(undefined);

        // re-create Project Tree
        this.createTreeItems();
        this._onDidChangeTreeData.fire(undefined);
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

        // re-create Project Tree
        this.createTreeItems();
        this._onDidChangeTreeData.fire(undefined);
    }
}

let _groupsDataProvider: GroupsDataProvider | undefined;
let _projectFilesDataProvider: ProjectFilesDataProvider | undefined;

function refreshProjectFilesAndGroups() {
    if (_groupsDataProvider) {
        _groupsDataProvider.refresh();
    }

    if (_projectFilesDataProvider) {
        _projectFilesDataProvider.refresh();
    }
}

export function initDockView(context: vscode.ExtensionContext) {
    if (isRTThreadProject()) {
        _groupsDataProvider = new GroupsDataProvider();
        const groupView = vscode.window.createTreeView('groupsId', {
            treeDataProvider: _groupsDataProvider, showCollapseAll: true
        });
        context.subscriptions.push(groupView);
    }

    _projectFilesDataProvider = new ProjectFilesDataProvider();
    const view = vscode.window.createTreeView('projectFilesId', {
        treeDataProvider: _projectFilesDataProvider, showCollapseAll: true
    });
    context.subscriptions.push(view);
    vscode.commands.registerCommand('extension.refreshRTThread', () => refreshProjectFilesAndGroups());

    // update$(cpus)
    const cpus = os.cpus().length;
    for (const [key, value] of Object.entries(cmds)) {
        for (let i = 0; i < value.subcmds.length; i ++) {
            if (value.subcmds[i].name.includes('$(cpus)')) {
                value.subcmds[i].name = value.subcmds[i].name.replace('$(cpus)', cpus.toString());
            }

            for (let j = 0; j < value.subcmds[i].cmd.arguments.length; j ++) {
                if (value.subcmds[i].cmd.arguments[j].includes('$(cpus)')) {
                    value.subcmds[i].cmd.arguments[j] = value.subcmds[i].cmd.arguments[j].replace('$(cpus)', cpus.toString());
                }
            }
        }
    }

    const treeDataprovider = new CmdTreeDataProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider("treeId", treeDataprovider));
}
