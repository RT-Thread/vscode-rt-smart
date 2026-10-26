import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Declares URI activation and the browser command', () => {
        const root = path.resolve(__dirname, '../..');
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        assert.ok(manifest.activationEvents.includes('onUri'));
        assert.ok(manifest.contributes.commands.some((item: { command: string }) => item.command === 'extension.openWebUrl'));
        assert.strictEqual(manifest.dependencies['vue-router'], undefined);
        assert.strictEqual(manifest.scripts['package:vs'].includes('--no-dependencies'), false);
        assert.strictEqual(fs.readFileSync(path.join(root, 'src/vue/components.d.ts'), 'utf8').includes('vue-router'), false);
    });

    test('Does not build or ship removed feature modules', () => {
        const out = path.resolve(__dirname, '..');
        for (const file of ['analyze', 'utils/elf', 'webviews/analyze.js', 'webviews/settings_sdk.js', 'webviews/kconfigwebview.js']) {
            assert.strictEqual(fs.existsSync(path.join(out, file)), false, file);
        }
    });

    test('Activates outside RT-Thread projects with a browser command and no analysis command', async () => {
        const extension = vscode.extensions.getExtension('rt-thread.rt-thread-smart');
        assert.ok(extension);
        await extension.activate();
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('extension.openWebUrl'));
        assert.ok(commands.includes('extension.showSetting'));
        assert.strictEqual(commands.includes('extension.showAnalyze'), false);
    });
});
