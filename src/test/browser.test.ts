import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';
import { ExtensionUriHandler, openWebUrl, validateWebUrl } from '../browser';

suite('Web Browser', () => {
    test('Accepts HTTP, HTTPS, localhost and IPv6 addresses', () => {
        for (const url of ['https://example.com/', 'http://localhost:8080/', 'http://[::1]:8080/']) {
            assert.strictEqual(validateWebUrl(url), url);
        }
        assert.strictEqual(validateWebUrl('  HTTPS://example.com  '), 'https://example.com/');
    });

    test('Rejects unsupported protocols, incomplete URLs and credentials', () => {
        for (const url of [
            '', 'example.com', 'https:example.com', 'https://', 'https://example.com:invalid',
            'file:///tmp/test', 'javascript:alert(1)', 'command:extension.showSetting',
            'vscode://rt-thread.rt-thread-smart/auth-callback',
            'https://user:password@example.com/', 'https://example.com/\npath',
        ]) {
            assert.throws(() => validateWebUrl(url), Error, url);
        }
        assert.throws(() => validateWebUrl(123 as unknown as string));
    });

    test('Prefers the integrated browser when available', async () => {
        const calls: unknown[][] = [];
        await openWebUrl('https://example.com/', {
            getCommands: async () => ['simpleBrowser.show', 'workbench.action.browser.open'],
            executeCommand: async <T>(...args: unknown[]): Promise<T | undefined> => {
                calls.push(args);
                return undefined;
            },
        });
        assert.deepStrictEqual(calls, [['workbench.action.browser.open', 'https://example.com/']]);
    });

    test('Uses Simple Browser on older VS Code versions', async () => {
        const calls: unknown[][] = [];
        await openWebUrl('http://localhost:8080/', {
            getCommands: async () => [],
            executeCommand: async <T>(...args: unknown[]): Promise<T | undefined> => {
                calls.push(args);
                return undefined;
            },
        });
        assert.deepStrictEqual(calls, [['simpleBrowser.show', 'http://localhost:8080/']]);
    });

    test('Validates URLs before executing commands', async () => {
        let called = false;
        await assert.rejects(openWebUrl('command:unsafe', {
            getCommands: async () => { called = true; return []; },
            executeCommand: async () => { called = true; return undefined; },
        }));
        assert.strictEqual(called, false);
    });

    test('Propagates browser failures without opening an external browser', async () => {
        const error = new Error('Browser unavailable');
        const calls: string[] = [];
        await assert.rejects(openWebUrl('https://example.com/', {
            getCommands: async () => [],
            executeCommand: async command => { calls.push(command); throw error; },
        }), error);
        assert.deepStrictEqual(calls, ['simpleBrowser.show']);
    });

    test('Preserves encoded target queries, fragments, Unicode and percent escapes', async () => {
        const opened: string[] = [];
        const handler = new ExtensionUriHandler({ handleUri: () => assert.fail('Unexpected auth URI') }, async url => {
            opened.push(url);
        });
        const urls = [
            'https://example.com/docs?a=1&b=2#intro',
            'http://localhost:3000/?q=a+b&path=%2Ffoo&literal=%2520',
            'https://example.com/?url=https%3A%2F%2Fother.com&next=1',
            'https://example.com/文档?q=更新#说明',
        ];
        for (const url of urls) {
            await handler.handleUri(vscode.Uri.parse(`vscode://rt-thread.rt-thread-smart/open-web?url=${encodeURIComponent(url)}`));
        }
        assert.deepStrictEqual(opened, urls.map(url => new URL(url).toString()));
    });

    test('Rejects missing or unsafe URI targets', async () => {
        const handler = new ExtensionUriHandler({ handleUri: () => assert.fail('Unexpected auth URI') }, async () => {
            assert.fail('Invalid URI opened a browser');
        });
        for (const query of ['', 'url=', 'other=https://example.com', 'url=javascript:alert(1)', 'url=file:///tmp/test']) {
            await assert.rejects(handler.handleUri(vscode.Uri.parse(`vscode://rt-thread.rt-thread-smart/open-web?${query}`)));
        }
    });

    test('Forwards login callbacks unchanged to the authentication provider', async () => {
        let received: vscode.Uri | undefined;
        const uri = vscode.Uri.parse('vscode://rt-thread.rt-thread-smart/auth-callback?code=abc&state=xyz');
        const handler = new ExtensionUriHandler({ handleUri: value => { received = value; } }, async () => {
            assert.fail('Login callback opened a browser');
        });
        await handler.handleUri(uri);
        assert.strictEqual(received, uri);
    });

    test('Opens a local page in the built-in browser through the extension command', async () => {
        const extension = vscode.extensions.getExtension('rt-thread.rt-thread-smart');
        assert.ok(extension);
        await extension.activate();
        const existingTabs = new Set(vscode.window.tabGroups.all.flatMap(group => group.tabs));
        let receivedUrl: string | undefined;
        const server = http.createServer((request, response) => {
            if (request.url?.startsWith('/?')) {
                receivedUrl = request.url;
            }
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end('<html><head><title>RT-Thread Browser Test</title></head><body>Browser test</body></html>');
        });
        try {
            await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
            const address = server.address();
            assert.ok(address && typeof address !== 'string');
            await vscode.commands.executeCommand('extension.openWebUrl', `http://127.0.0.1:${address.port}/?a=1&b=2#intro`);
            const deadline = Date.now() + 10000;
            while (!receivedUrl && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.ok(receivedUrl);
            const received = new URL(receivedUrl, 'http://127.0.0.1');
            assert.strictEqual(received.pathname, '/');
            assert.strictEqual(received.searchParams.get('a'), '1');
            assert.strictEqual(received.searchParams.get('b'), '2');
            assert.ok(vscode.window.tabGroups.all.some(group => group.tabs.some(tab => !existingTabs.has(tab))));
        } finally {
            const newTabs = vscode.window.tabGroups.all.flatMap(group => group.tabs).filter(tab => !existingTabs.has(tab));
            await vscode.window.tabGroups.close(newTabs);
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });
});
