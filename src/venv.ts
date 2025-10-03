import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export async function setupVEnv() {
    const pythonExtensionId = 'ms-python.python';
    const pythonExtension = vscode.extensions.getExtension(pythonExtensionId);
    if (!pythonExtension) {
        vscode.window.showErrorMessage('Python extension not found. Please install it first.');
        return;
    }

    const api = pythonExtension.activate();
    api.then(async (exportApi: any) => {
        if (exportApi) {
            const homeDir = os.homedir();
            const venvPath = path.join(homeDir, '.env', '.venv');

            if (fs.existsSync(venvPath) && fs.lstatSync(venvPath).isDirectory()) {
                let pythonPath = path.join(venvPath, 'bin', 'python');
                if (!fs.existsSync(pythonPath)) {
                    pythonPath = path.join(venvPath, 'Scripts', 'python.exe');
                }

                try {
                    await exportApi.environments.updateActiveEnvironmentPath(pythonPath);
                } catch (error) {
                    vscode.window.showErrorMessage(`Active venv failed: ${error}`);
                }
            }
        }
    });
}
