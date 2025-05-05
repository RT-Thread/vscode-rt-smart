import * as vscode from 'vscode';

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { executeCommand } from './terminal';

let _context: vscode.ExtensionContext;
let _bi: any[] = [];

export function isRTThreadProject() {
    let status = _context.workspaceState.get<boolean>('isRTThread') || false;
    return status;
}

export function isRTThreadWorksapce() {
    let status = _context.workspaceState.get<boolean>('isRTThreadWorksapce') || false;
    return status;
}

export function initAPI(context:vscode.ExtensionContext) {
    _context = context;

    // read resources/bi.json for boards information
    _bi = readJsonObject(path.join(getExtensionPath(), "resources", "bi.json"));
}

export function getBoardInfo(): any {
    let bi = [];

    for (const item of _bi) {
        let vendor = { manufacturer : item.manufacturer, boards : [] as string[]};

        for (const board of item.boards) {
            let name:string = board.board;

            vendor.boards.push(name);
        }
        bi.push(vendor);
    }

    return bi;
}

export function getBoardPath(name:string):string {
    for (const item of _bi) {
        for (const board of item.boards) {
            if (board.board === name) {
                return board.path;
            }
        }
    }

    return "";
}

export function getEnvROOT() {
    // return vscode.workspace.getConfiguration('smart').get('envROOT');
    return path.join(os.homedir(), '.env');
}

export function getRTTRoot() {
    const cfgFn = path.join(os.homedir(), '.env/cfg.json');
    let cfg = readJsonObject(cfgFn);
    if (cfg.length > 0) {
        for (const item of cfg) {
            if (item.name === "RT-Thread") {
                return item.path;
            }
        }
    }

    return undefined;
}

/*
 projectInfo {
    name,
    folder,
    cpu,
    bsp, 
    linkRTT,
    linkDriver
 }
*/
export function createProject(folder: string, projectInfo: any) {
    let project_path = path.join(folder, projectInfo.name);

    if (fs.existsSync(project_path)) {
        vscode.window.showWarningMessage('Project folder already exists.');
        return ;
    }
    else {
        let RTTRoot = getRTTRoot();
        if (RTTRoot) {
            // try to create project
            let bsp_path = path.join(RTTRoot, getBoardPath(projectInfo.board));
            let cmd:string = `scons --dist --project-name=${projectInfo.name} --project-path=${project_path} -C ${bsp_path}`;

            executeCommand(cmd);
        }
        else {
            vscode.window.showErrorMessage("No RT-Thread Root found. Please set it.");
        }
    }

    return ;
}

export function getExtensionVersion() {
    return _context.extension.packageJSON.version;
}

export function getExtensionPath() {
    return _context.extensionPath;
}

export function getWorkspaceFolder() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function installEnv(folder: string) {
    if (fs.existsSync(folder)) {
        vscode.window.showWarningMessage('env already exists.');
        return ;
    }

    return ;
}

export function readJsonObject(fn: string) {
    if (fs.existsSync(fn)) {
        let data = fs.readFileSync(fn, 'utf-8');
        return JSON.parse(data);
    }

    return [];
}

export function writeJsonObject(jsonObject: any, fn:string) {
    const jsonContent = JSON.stringify(jsonObject, null, 4);
    fs.writeFileSync(fn, jsonContent, 'utf-8');

    return ;
}

export async function openFolder(uri?: string) {
    let selectedFolder:vscode.Uri[] | undefined;

    if (uri != undefined) {
        selectedFolder = await vscode.window.showOpenDialog({
            defaultUri: vscode.Uri.file(uri),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
          });
    }
    else {
        selectedFolder = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
          });      
    }

    if (selectedFolder && selectedFolder.length > 0) {
      return selectedFolder[0].fsPath;
    }
}
