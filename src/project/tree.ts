import path from 'path';
import * as vscode from 'vscode';
import os, { getPriority } from 'os';
import fs from 'fs';
import { getWorkspaceFolder, getExtensionPath } from '../extension';

/*
 * contexType -> contextValue as following value:
 * project_root,
 * project_group,
 * project_file
 */

export class ProjectTreeItem extends vscode.TreeItem {
    children: ProjectTreeItem[];
    fn: string = '';
    name: string = '';

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public contextType: string, 
        fn?: string,
        children?: ProjectTreeItem[]
    ) {
        super(label, collapsibleState);

        if (children) {
            this.children = children;
        }
        else {
            this.children = [];
        }

        this.contextValue = contextType;
        this.name = label;
        if (fn) {
            if (path.isAbsolute(fn)) {
                this.fn = fn;
            }
            else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    this.fn = path.join(workspaceFolders[0].uri.fsPath, fn);
                }
            }

            if (contextType == 'project_file') {
                this.command = {
                    title: this.name,
                    command: 'extension.clickProject',
                    tooltip: this.name,
                    arguments: [
                        this
                    ]
                };                    
            }
        }
    }

    getChildren(): ProjectTreeItem[] | Thenable<ProjectTreeItem[]> {
        if (this.children) {
            return this.children;
        }

        return Promise.resolve([]);
    }
}

/**
 * Get the icon on the item left
 * @param isDir 
 * @param value 
 * @returns 
 */
export function getTreeIcon(isDir: boolean, value: string): string {
    var icon = 'default_file.svg';
    if (isDir) {
        icon = "default_folder.svg";
    } else {
        if (value.endsWith(".c")) {
            icon = "file_type_c.svg";
        } else if (value.endsWith(".cpp") || value.endsWith(".cc") || value.endsWith(".cxx")) {
            icon = "file_type_cpp.svg";
        } else if (value.endsWith(".h")) {
            icon = "file_type_cheader.svg";
        } else if (value.endsWith(".s") || value.endsWith(".S")) {
            icon = "file_type_assembly.svg"
        } else if (value.endsWith(".py") || value.endsWith("SConscript") || value.endsWith("SConstruct")) {
            icon = "file_type_python.svg";
        } else if (value.endsWith(".txt")) {
            icon = "file_type_text.svg";
        } else if (value.endsWith("Kconfig")) {
            icon = "file_type_config.svg";
        } else if (value.endsWith(".md")) {
            icon = "file_type_markdown.svg";
        } else if (value.endsWith(".cmake")) {
            icon = "file_type_cmake.svg";
        } else if (value.endsWith(".xmake")) {
            icon = "file_type_xmake.svg";
        } else if (value.endsWith(".js")) {
            icon = "file_type_js.svg";
        } else if (value.endsWith(".json")) {
            icon = "file_type_json.svg";
        } else if (value.endsWith(".patch")) {
            icon = "file_type_patch.svg";
        } else if (value.endsWith(".yaml")) {
            icon = "file_type_yaml.svg";
        } else if (value.endsWith(".bin")) {
            icon = "file_type_binary.svg";
        } else if (value.endsWith(".elf") || value.endsWith(".axf")) {
            icon = "rt-project-elffile.svg";
        } else if (value.endsWith(".jpg") || value.endsWith(".png") || value.endsWith(".ico") || value.endsWith(".jpeg")) {
            icon = "file_type_image.svg";
        } else if (value.endsWith(".lds") || value.endsWith(".icf") || value.endsWith(".sct")) {
            icon = "rt-project-linkfile.svg";
        }
    }
    return icon;
}

export function buildProjectTree(node: any): ProjectTreeItem[] {
    const projectItems: ProjectTreeItem[] = [];
    let extensionPath:string = getExtensionPath() || ".";

    const rtthreadItem = new ProjectTreeItem('RT-Thread', vscode.TreeItemCollapsibleState.Expanded, 'project_root', node['RT-Thread']);
    rtthreadItem.iconPath = new vscode.ThemeIcon('folder');
    rtthreadItem.iconPath = {
        light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "default_folder.svg")),
        dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "default_folder.svg"))
    };
    rtthreadItem.tooltip = rtthreadItem.fn;
    listFolderTreeItem(rtthreadItem);
    projectItems.push(rtthreadItem);

    const projectItem = new ProjectTreeItem('Groups', vscode.TreeItemCollapsibleState.Expanded, 'project_root');
    projectItem.iconPath = {
        light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "folder_type_component.svg")),
        dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "folder_type_component.svg"))
    };
    projectItems.push(projectItem);

    let groups : Array<any> = node['Groups'];
    groups.forEach((item, index) => {
        let name = item['name'];
        const treeItem = new ProjectTreeItem(name, vscode.TreeItemCollapsibleState.Collapsed, "project_group");
        treeItem.iconPath = {
            light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "file_type_package.svg")),
            dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', "file_type_package.svg"))
        };

        let files: Array<any> = item['files'];
        files.forEach((fn, index) => {
            if (fn.startsWith('..')) {
                let workspacePath = getWorkspaceFolder() || "";
                fn = path.resolve(workspacePath, fn);
            }
    
            const fileItem = new ProjectTreeItem(path.basename(fn), vscode.TreeItemCollapsibleState.None, "project_file", fn);
            let icon = getTreeIcon(false, fn);
            fileItem.iconPath = {
                light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon)),
                dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon))
            };
            fileItem.tooltip = fn;
            treeItem.children.push(fileItem);
        });
        projectItem.children.push(treeItem);
    });

    return projectItems;
}

export function buildEmptyProjectTree() {
    const projectItems: ProjectTreeItem[] = [];

    const treeItem = new ProjectTreeItem("No projects found", vscode.TreeItemCollapsibleState.None, "project_root");
    treeItem.iconPath = new vscode.ThemeIcon("warning");
    treeItem.tooltip = "Please update vscode settings to use project tree";

    projectItems.push(treeItem);

    return projectItems;
}

export function listFolderTreeItem(treeItem: ProjectTreeItem) {
	let children: ProjectTreeItem[] = [];
    let parentPath = treeItem.fn;
	const childFiles = fs.readdirSync(parentPath);
	let items: any[] = [];
	let dirs: any[] = [];
	let files: any[] = [];
	childFiles.forEach(function (item, index) {
		let value = String(item);

        if (parentPath.endsWith("rt-thread") && (value.startsWith("bsp") || value.startsWith("libcpu"))){
            ;
        }
        else {
            const sufix = value.substring(value.lastIndexOf('.') + 1);

            // filter files and dirs
            let sufixs = ["__pycache__", "pyc", "ewp", "eww", "ewd", "uvopt", "uvoptx", "uvproj", "uvprojx", "bat", "sh", "targets"];
            if (!(value.startsWith(".") || sufixs.indexOf(sufix) > -1)) {
                let fPath = path.join(parentPath, item);
                let stat = fs.statSync(fPath);
                if (stat.isDirectory()) {
                    dirs.push(item);
                } else {
                    files.push(item);
                }
            }    
        }
	});

	// push folders first
	dirs.forEach(function (item, index) {
		    items.push(item);
	    }
	);

	// push files next
	files.forEach(function (item, index) {
            items.push(item);
        }
	);

	items.forEach(function (item, index) {
		let value = String(item);
		let fPath = path.join(parentPath, item);
		let stat = fs.statSync(fPath);
		let icon = getTreeIcon(stat.isDirectory(), value);
        let extensionPath:string = getExtensionPath() || ".";

        if (fPath.startsWith('..')) {
            fPath = path.resolve(fPath);
        }

        if (stat.isDirectory() === true)
        {
            let childItem = new ProjectTreeItem(value, vscode.TreeItemCollapsibleState.Collapsed, "project_folder", fPath);
            childItem.iconPath = {
                light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon)),
                dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon))
            };
            childItem.tooltip = fPath;
            children.push(childItem);
        }
        else {
            let childItem = new ProjectTreeItem(value, vscode.TreeItemCollapsibleState.None, "project_file", fPath);
            childItem.iconPath = {
                light: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon)),
                dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'images', icon))
            };
            childItem.tooltip = fPath;
            children.push(childItem);
        }    
	});

	treeItem.children = children;
}
