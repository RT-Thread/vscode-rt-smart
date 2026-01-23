import path from 'path';
import * as vscode from 'vscode';
import os from 'os';
import fs from 'fs';
import { getWorkspaceFolder, isRTThreadProject, isRTThreadWorksapce } from './api';
import { buildGroupsTree, buildProjectTree, buildEmptyProjectTree, ProjectTreeItem, listFolderTreeItem, buildBSPTree, setTreeDataChangeEmitter } from './project/tree';
import { cmds } from './cmds/index';

class CmdTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        const isRTT = isRTThreadProject();
        const isRTTWorksapce = isRTThreadWorksapce();
        if (isRTT !== true && isRTTWorksapce !== true) {
            console.log("not RT-Thread project or workspace, return empty tree item.");
        }

        if (isRTThreadProject() !== true && isRTThreadWorksapce() !== true) {
            // only show Create Project and RT-Thread Setting command when not in RT-Thread project
            let createProject = new vscode.TreeItem("Create Project", vscode.TreeItemCollapsibleState.None);
            createProject.iconPath = new vscode.ThemeIcon("new-folder");
            createProject.label = "Create Project";
            createProject.command = {
                command: "extension.showCreateProject",
                title: "show create project page",
                arguments: [],
            };

            let rtSetting = new vscode.TreeItem("RT-Thread Setting", vscode.TreeItemCollapsibleState.None);
            rtSetting.iconPath = new vscode.ThemeIcon("settings-gear");
            rtSetting.label = "RT-Thread Setting";
            rtSetting.command = {
                command: "extension.showSetting",
                title: "show rt-thread setting page",
                arguments: [],
            };

            let chat = new vscode.TreeItem("AI Chat", vscode.TreeItemCollapsibleState.None);
            chat.iconPath = new vscode.ThemeIcon("comment-discussion");
            chat.label = "AI Chat";
            chat.command = {
                command: "extension.showChat",
                title: "show ai chat page",
                arguments: [],
            };

            let about = new vscode.TreeItem("About", vscode.TreeItemCollapsibleState.None);
            about.iconPath = new vscode.ThemeIcon("info");
            about.label = "About";
            about.command = {
                command: "extension.showAbout",
                title: "show about page",
                arguments: [],
            };

            return [createProject, rtSetting, chat, about];
        }

        if (!element) {
            let children = [];
            
            // 添加创建工程项
            let createProject = new vscode.TreeItem("Create Project", vscode.TreeItemCollapsibleState.None);
            createProject.iconPath = new vscode.ThemeIcon("new-folder");
            createProject.label = "Create Project";
            createProject.command = {
                command: "extension.showCreateProject",
                title: "show create project page",
                arguments: [],
            };
            children.push(createProject);

            let rtSetting = new vscode.TreeItem("RT-Thread Setting", vscode.TreeItemCollapsibleState.None);
            rtSetting.iconPath = new vscode.ThemeIcon("settings-gear");
            rtSetting.label = "RT-Thread Setting";
            rtSetting.command = {
                command: "extension.showSetting",
                title: "show rt-thread setting page",
                arguments: [],
            };
            children.push(rtSetting);

            for (const [key, value] of Object.entries(cmds)) {
                let item = new vscode.TreeItem(value.name, value.isExpanded? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
                item.iconPath = new vscode.ThemeIcon(value.iconId);
                item.label = value.label;

                children.push(item);
            };

            let chat = new vscode.TreeItem("AI Chat", vscode.TreeItemCollapsibleState.None);
            chat.iconPath = new vscode.ThemeIcon("comment-discussion");
            chat.label = "AI Chat";
            chat.command = {
                command: "extension.showChat",
                title: "show ai chat page",
                arguments: [],
            };
            children.push(chat);

            let analyze = new vscode.TreeItem("Symbolic Analysis", vscode.TreeItemCollapsibleState.None);
            analyze.iconPath = new vscode.ThemeIcon("search-fuzzy");
            analyze.label = "Symbolic Analysis";
            analyze.command = {
                command: "extension.showAnalyze",
                title: "show symbolic analysis page",
                arguments: [],
            };
            children.push(analyze);

            let about = new vscode.TreeItem("About", vscode.TreeItemCollapsibleState.None);
            about.iconPath = new vscode.ThemeIcon("info");
            about.label = "About";
            about.command = {
                command: "extension.showAbout",
                title: "show about page",
                arguments: [],
            };
            children.push(about);


            return children;
        } else {
            let children:any = [];

            const kconfig = vscode.extensions.getExtension('rt-thread.rt-thread-kconfig');

            for (const [key, value] of Object.entries(cmds)) {
                if (element.label === value.label) {
                    for (const cmdItem of value.subcmds) {
                        let item = new vscode.TreeItem(cmdItem.name);
                        item.iconPath = new vscode.ThemeIcon(cmdItem.iconId);
                        if (cmdItem.name === 'menuconfig' && kconfig !== undefined) {
                            item.command = {
                                command: "rt-thread-kconfig.menuconfig.windows",
                                title: cmdItem.cmd.title
                            };
                        }
                        else {
                            item.command = {
                                command: "extension.executeCommand",
                                title: cmdItem.cmd.title,
                                arguments: cmdItem.cmd.arguments,
                            };    
                        }

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
        else {
            jsonPath = getWorkspaceFolder() + "/.vscode/workspace.json";
            if (fs.existsSync(jsonPath)) {
                try {
                    const json = fs.readFileSync(jsonPath, 'utf8');
                    const jsonNode = JSON.parse(json);
    
                    if (jsonNode.hasOwnProperty("bsps")) {
                        return buildBSPTree(jsonNode);
                    }
                }
                catch (err) {
                    return buildEmptyProjectTree();
                }
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
                else if (element.contextType === "project_folder") {
                    listFolderTreeItem(element);
                }
            }
            else if (element.contextType === "project_folder") {
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

    getTreeDataChangeEmitter(): vscode.EventEmitter<ProjectTreeItem | undefined> {
        return this._onDidChangeTreeData;
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
                else if (element.contextType === "project_folder") {
                    listFolderTreeItem(element);
                }
            }
            else if (element.contextType === "project_folder") {
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

        let workspacePath = getWorkspaceFolder() + "/.vscode/workspace.json";
        if (fs.existsSync(workspacePath)) {
            try {
                const json = fs.readFileSync(workspacePath, 'utf8');
                const jsonNode = JSON.parse(json);

                if (jsonNode.hasOwnProperty("bsps")) {
                    return buildBSPTree(jsonNode);
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

    setTreeDataChangeEmitter(_projectFilesDataProvider.getTreeDataChangeEmitter());

    context.subscriptions.push(view);
    vscode.commands.registerCommand('extension.refreshRTThread', () => refreshProjectFilesAndGroups());

    // Auto-refresh trees when project/workspace descriptors change
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const projectJsonPattern = new vscode.RelativePattern(workspaceFolder, '.vscode/project.json');
        const workspaceJsonPattern = new vscode.RelativePattern(workspaceFolder, '.vscode/workspace.json');

        const projectWatcher = vscode.workspace.createFileSystemWatcher(projectJsonPattern);
        const workspaceWatcher = vscode.workspace.createFileSystemWatcher(workspaceJsonPattern);

        const triggerRefresh = () => vscode.commands.executeCommand('extension.refreshRTThread');

        projectWatcher.onDidChange(triggerRefresh);
        projectWatcher.onDidCreate(triggerRefresh);
        projectWatcher.onDidDelete(triggerRefresh);

        workspaceWatcher.onDidChange(triggerRefresh);
        workspaceWatcher.onDidCreate(triggerRefresh);
        workspaceWatcher.onDidDelete(triggerRefresh);

        context.subscriptions.push(projectWatcher, workspaceWatcher);
    }

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
