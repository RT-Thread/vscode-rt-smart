export interface vscode {
    postMessage(message: object): void;
}
declare function acquireVsCodeApi(): vscode;
const vscode = acquireVsCodeApi();

export function sendCommand(command: string, args: any[] = []) {
    const cmdObject = {
        command,
        args
    };

    vscode.postMessage(cmdObject);
}

export function sendCommandData(command: string, data: any) {
    sendCommand(command, [data]);
}

export function showMessage(message: string) {
    sendCommand('showMessage', [message]);
}
