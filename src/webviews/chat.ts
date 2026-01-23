import * as vscode from 'vscode';

let chatViewPanel: vscode.WebviewPanel | null = null;

const title = 'RT-Thread AI Chat';
const defaultApiBaseUrl = 'https://ai.rt-thread.org';

type RpcResponseError = {
    message: string;
    status?: number;
    requestId?: string;
};

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = (baseUrl || '').trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/\/+$/, '');
}

function getAiChatBaseUrl(): string {
    const cfg = vscode.workspace.getConfiguration('smart');
    const url = cfg.get<string>('aiChatBaseUrl');
    return normalizeBaseUrl(url || defaultApiBaseUrl);
}

function getAiChatTimeoutMs(): number {
    const cfg = vscode.workspace.getConfiguration('smart');
    const timeout = cfg.get<number>('aiChatRequestTimeoutMs');
    const value = typeof timeout === 'number' && Number.isFinite(timeout) ? timeout : 30000;
    return Math.max(1000, Math.floor(value));
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

async function getRTThreadSession(createIfNone: boolean): Promise<vscode.AuthenticationSession | undefined> {
    try {
        return await vscode.authentication.getSession('rt-thread', [], { createIfNone });
    } catch {
        return undefined;
    }
}

function buildHeaders(sid: string, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(extra ?? {}),
    };
    if (sid) {
        headers['Cookie'] = `sid=${sid}`;
        headers['Authorization'] = `Bearer ${sid}`;
    }
    return headers;
}

function isAllowedApiPath(pathname: string): boolean {
    const p = String(pathname || '').trim();
    if (!p.startsWith('/')) {
        return false;
    }
    return p.startsWith('/api/');
}

function joinBackendUrl(baseUrl: string, maybePath: string): string {
    const raw = String(maybePath || '').trim();
    if (!raw) {
        return '';
    }
    if (/^https?:\/\//i.test(raw)) {
        const b = normalizeBaseUrl(baseUrl);
        return raw.startsWith(`${b}/`) || raw === b ? raw : '';
    }
    if (!isAllowedApiPath(raw)) {
        return '';
    }
    return `${normalizeBaseUrl(baseUrl)}${raw}`;
}

async function proxyJson(
    baseUrl: string,
    sid: string,
    url: string,
    options: any,
): Promise<{ ok: true; data: any } | { ok: false; error: RpcResponseError }> {
    const fullUrl = joinBackendUrl(baseUrl, url);
    if (!fullUrl) {
        return { ok: false, error: { message: 'Forbidden request path.' } };
    }

    const method = typeof options?.method === 'string' ? options.method.toUpperCase() : 'GET';
    const rawBody = options?.body;
    const hasBody = rawBody !== undefined && rawBody !== null && method !== 'GET' && method !== 'HEAD';
    const body =
        hasBody && typeof rawBody === 'string'
            ? rawBody
            : hasBody
                ? JSON.stringify(rawBody)
                : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getAiChatTimeoutMs());

    try {
        const res = await fetch(fullUrl, {
            method,
            headers: buildHeaders(sid, typeof options?.headers === 'object' ? options.headers : undefined),
            body,
            signal: controller.signal,
        });
        const requestId = res.headers.get('x-request-id') || undefined;
        const text = await res.text();
        let parsed: any = undefined;
        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = undefined;
            }
        }

        if (!res.ok) {
            const message =
                typeof parsed?.message === 'string'
                    ? parsed.message
                    : typeof parsed?.error === 'string'
                        ? parsed.error
                        : res.statusText || `Request failed (${res.status})`;
            return { ok: false, error: { message, status: res.status, requestId } };
        }

        if (parsed === undefined) {
            return { ok: false, error: { message: 'Invalid JSON response.', requestId } };
        }

        return { ok: true, data: parsed };
    } catch (e: any) {
        const msg = e?.name === 'AbortError' ? 'Request timeout.' : e?.message ? String(e.message) : String(e);
        return { ok: false, error: { message: msg } };
    } finally {
        clearTimeout(timeout);
    }
}

type StreamEntry = { controller: AbortController; requestId?: string };

async function proxyStream(
    post: (message: any) => void,
    activeStreams: Map<string, StreamEntry>,
    baseUrl: string,
    sid: string,
    streamId: string,
    url: string,
    method: string,
    body: any,
): Promise<void> {
    const fullUrl = joinBackendUrl(baseUrl, url);
    if (!fullUrl) {
        post({ type: 'rt.chat.stream.error', id: streamId, error: { message: 'Forbidden request path.' } });
        post({ type: 'rt.chat.stream.end', id: streamId });
        return;
    }

    const controller = new AbortController();
    activeStreams.set(streamId, { controller });
    const timeout = setTimeout(() => controller.abort(), getAiChatTimeoutMs());

    try {
        const rawBody =
            body !== undefined && body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
        const res = await fetch(fullUrl, {
            method: method || 'POST',
            headers: buildHeaders(sid),
            body: rawBody,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const requestId = res.headers.get('x-request-id') || undefined;
        const entry = activeStreams.get(streamId);
        if (entry) {
            entry.requestId = requestId;
        }

        if (!res.ok) {
            const text = await res.text();
            let parsed: any = undefined;
            if (text) {
                try {
                    parsed = JSON.parse(text);
                } catch {
                    parsed = undefined;
                }
            }
            const message =
                typeof parsed?.message === 'string'
                    ? parsed.message
                    : typeof parsed?.error === 'string'
                        ? parsed.error
                        : res.statusText || `Request failed (${res.status})`;
            post({ type: 'rt.chat.stream.error', id: streamId, error: { message, status: res.status, requestId } });
            return;
        }

        if (!res.body) {
            post({
                type: 'rt.chat.stream.error',
                id: streamId,
                error: { message: 'Stream not supported.', requestId },
            });
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) {
                    continue;
                }
                const dataStr = trimmed.slice(5).trim();
                if (!dataStr) {
                    continue;
                }
                if (dataStr === '[DONE]') {
                    return;
                }
                let payload: any = undefined;
                try {
                    payload = JSON.parse(dataStr);
                } catch {
                    payload = undefined;
                }
                if (!payload) {
                    continue;
                }
                post({ type: 'rt.chat.stream.event', id: streamId, event: payload });
            }
        }
    } catch (e: any) {
        if (controller.signal.aborted) {
            return;
        }
        const msg = e?.message ? String(e.message) : String(e);
        const requestId = activeStreams.get(streamId)?.requestId;
        post({ type: 'rt.chat.stream.error', id: streamId, error: { message: msg, requestId } });
    } finally {
        clearTimeout(timeout);
        activeStreams.delete(streamId);
        post({ type: 'rt.chat.stream.end', id: streamId });
    }
}

function getWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
    const nonce = getNonce();

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'chat-ui', 'app.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'chat-ui', 'chat-ui.js'));

    const csp = [
        `default-src 'none';`,
        `img-src ${webview.cspSource} https: data:;`,
        `style-src ${webview.cspSource} 'unsafe-inline';`,
        `font-src ${webview.cspSource} data:;`,
        `script-src 'nonce-${nonce}';`,
    ].join(' ');

    return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="${cssUri}" />
  </head>
  <body class="host-vscode">
    <div class="page page-chat">
      <header class="topbar">
        <div class="brand"><span class="brand-dot"></span>RT-Thread AI 智能对话</div>
        <div class="topbar-actions">
          <div class="user-menu" id="user-menu">
            <button
              class="user-menu-button"
              id="user-menu-button"
              type="button"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span class="user-chip" id="user-chip">正在加载资料...</span>
              <span class="user-menu-caret">▾</span>
            </button>
            <div class="user-menu-panel" id="user-menu-panel" hidden>
              <div class="user-menu-header">
                <div class="user-menu-name" id="menu-name">---</div>
                <div class="user-menu-email" id="menu-email">---</div>
              </div>
              <div class="user-menu-list">
                <div class="user-menu-item">
                  <span>公司</span>
                  <span id="menu-company">---</span>
                </div>
                <div class="user-menu-item">
                  <span>擅长领域</span>
                  <span id="menu-domain">---</span>
                </div>
              </div>
              <div class="user-menu-actions">
                <a class="admin-link" id="profile-link" href="/profile">个人信息</a>
                <a class="admin-link" id="admin-link" href="/rt_thread_adzxcdfwrqwafvdsf_admin" hidden>管理员后台</a>
                <button class="logout" id="logout" type="button">退出登录</button>
              </div>
            </div>
          </div>
          <button
            class="conversation-drawer-trigger"
            id="conversation-drawer-trigger"
            type="button"
            aria-label="打开对话列表"
            hidden
          >
            ☰ 对话
          </button>
        </div>
      </header>

      <div class="conversation-drawer-backdrop" id="conversation-drawer-backdrop" hidden></div>

      <main class="chat-shell">
        <aside class="conversation-panel">
          <div class="conversation-header">
            <div class="conversation-header-text">
              <h2>对话</h2>
              <p class="muted">管理与切换会话</p>
            </div>
            <div class="conversation-header-actions">
              <button
                class="button button-small conversation-toggle"
                id="toggle-conversation"
                type="button"
                aria-label="收起对话列表"
              >
                收起
              </button>
              <button class="button button-small" id="new-conversation" type="button">
                新建
              </button>
            </div>
          </div>
          <div class="conversation-list" id="conversation-list"></div>
        </aside>

        <section class="chat-main">
          <div class="chat-panel">
            <div class="chat-log" id="chat-log"></div>
            <div class="chat-suggestions" id="chat-suggestions" hidden></div>

            <form class="chat-form" id="chat-form">
              <input
                class="chat-input"
                id="chat-input"
                type="text"
                placeholder="输入一句话..."
                autocomplete="off"
                required
              />
              <button class="chat-button" type="submit">发送</button>
            </form>
          </div>
        </section>
      </main>
    </div>

    <script nonce="${nonce}" src="${jsUri}"></script>
  </body>
</html>`;
}

export function openChatWebview(context: vscode.ExtensionContext) {
    if (chatViewPanel) {
        chatViewPanel.reveal(vscode.ViewColumn.Beside);
        return chatViewPanel;
    }

    const panel = vscode.window.createWebviewPanel('rt-thread-chat', title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'resources', 'chat-ui')],
    });

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'images', 'rt-thread.png');
    panel.iconPath = iconPath;
    panel.webview.html = getWebviewHtml(context, panel.webview);

    const activeStreams = new Map<string, StreamEntry>();
    let disposed = false;

    const post = (message: any) => {
        if (disposed) {
            return;
        }
        void panel.webview.postMessage(message);
    };

    const authChangeDisposable = vscode.authentication.onDidChangeSessions((event) => {
        if (event.provider.id !== 'rt-thread') {
            return;
        }
        post({ type: 'rt.chat.auth.sessionsChanged' });
    });

    panel.onDidDispose(() => {
        disposed = true;
        authChangeDisposable.dispose();
        for (const entry of activeStreams.values()) {
            try {
                entry.controller.abort();
            } catch {
                // ignore
            }
        }
        activeStreams.clear();
        chatViewPanel = null;
    });

    panel.webview.onDidReceiveMessage(async (message) => {
        if (!message || typeof message.type !== 'string' || typeof message.id !== 'string') {
            return;
        }

        const baseUrl = getAiChatBaseUrl();

        switch (message.type) {
            case 'rt.chat.rpc.request': {
                const op = typeof message.op === 'string' ? message.op : '';
                const payload = message.payload;

                if (op === 'auth.signIn') {
                    try {
                        // When backend check fails we may still have a stored (stale) sid.
                        // Force a fresh login so users don't get stuck in a "未登录" loop.
                        try {
                            await vscode.commands.executeCommand('extension.RTThreadSignOut');
                        } catch {
                            // ignore
                        }

                        const session = await getRTThreadSession(true);
                        if (!session?.accessToken) {
                            post({
                                type: 'rt.chat.rpc.response',
                                id: message.id,
                                ok: false,
                                error: { message: '登录已取消。' } satisfies RpcResponseError,
                            });
                            return;
                        }
                        post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: { ok: true } });
                    } catch (e: any) {
                        post({
                            type: 'rt.chat.rpc.response',
                            id: message.id,
                            ok: false,
                            error: { message: e?.message ? String(e.message) : String(e) } satisfies RpcResponseError,
                        });
                    }
                    return;
                }

                if (op === 'auth.signOut') {
                    try {
                        await vscode.commands.executeCommand('extension.RTThreadSignOut');
                        post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: { ok: true } });
                    } catch (e: any) {
                        post({
                            type: 'rt.chat.rpc.response',
                            id: message.id,
                            ok: false,
                            error: { message: e?.message ? String(e.message) : String(e) } satisfies RpcResponseError,
                        });
                    }
                    return;
                }

                if (op === 'ui.confirm') {
                    const msgText = payload && typeof payload.message === 'string' ? payload.message : '';
                    const confirmLabel = '确定';
                    const picked = await vscode.window.showWarningMessage(msgText || '确认操作？', { modal: true }, confirmLabel);
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: picked === confirmLabel });
                    return;
                }

                if (op === 'ui.prompt') {
                    const msgText = payload && typeof payload.message === 'string' ? payload.message : '';
                    const value = payload && typeof payload.value === 'string' ? payload.value : '';
                    const result = await vscode.window.showInputBox({
                        prompt: msgText || '请输入内容',
                        value,
                        ignoreFocusOut: true,
                    });
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: result ?? null });
                    return;
                }

                if (op === 'ui.notify') {
                    const kind = payload && typeof payload.kind === 'string' ? payload.kind : 'info';
                    const msgText = payload && typeof payload.message === 'string' ? payload.message : '';
                    try {
                        if (kind === 'error') {
                            await vscode.window.showErrorMessage(msgText || '发生错误。');
                        } else if (kind === 'warning') {
                            await vscode.window.showWarningMessage(msgText || '提示。');
                        } else {
                            await vscode.window.showInformationMessage(msgText || '提示。');
                        }
                    } catch {
                        // ignore
                    }
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: { ok: true } });
                    return;
                }

                if (op === 'openExternal') {
                    const rawUrl = payload && typeof payload.url === 'string' ? payload.url : '';
                    const b = baseUrl || defaultApiBaseUrl;
                    const trimmed = String(rawUrl || '').trim();
                    const isAbsolute = /^(https?:|mailto:)/i.test(trimmed);
                    const target = isAbsolute ? trimmed : `${b}${trimmed || '/'}`;
                    try {
                        await vscode.env.openExternal(vscode.Uri.parse(target));
                    } catch {
                        // ignore
                    }
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: { ok: true } });
                    return;
                }

                if (op !== 'json') {
                    post({
                        type: 'rt.chat.rpc.response',
                        id: message.id,
                        ok: false,
                        error: { message: `Unknown op: ${op}` } satisfies RpcResponseError,
                    });
                    return;
                }

                const session = await getRTThreadSession(false);
                if (!session?.accessToken) {
                    post({
                        type: 'rt.chat.rpc.response',
                        id: message.id,
                        ok: false,
                        error: { message: 'Login required.', status: 401 } satisfies RpcResponseError,
                    });
                    return;
                }

                const url = payload && typeof payload.url === 'string' ? payload.url : '';
                const options = payload ? payload.options : undefined;
                const resp = await proxyJson(baseUrl, session.accessToken, url, options);
                if (resp.ok) {
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: true, data: resp.data });
                } else {
                    post({ type: 'rt.chat.rpc.response', id: message.id, ok: false, error: resp.error });
                }
                return;
            }

            case 'rt.chat.stream.start': {
                const url = typeof message.url === 'string' ? message.url : '';
                const method = typeof message.method === 'string' ? message.method : 'POST';
                const body = message.body;

                const session = await getRTThreadSession(false);
                if (!session?.accessToken) {
                    post({
                        type: 'rt.chat.stream.error',
                        id: message.id,
                        error: { message: 'Login required.', status: 401 } satisfies RpcResponseError,
                    });
                    post({ type: 'rt.chat.stream.end', id: message.id });
                    return;
                }

                void proxyStream(post, activeStreams, baseUrl, session.accessToken, message.id, url, method, body);
                return;
            }

            case 'rt.chat.stream.cancel': {
                const entry = activeStreams.get(message.id);
                if (entry) {
                    try {
                        entry.controller.abort();
                    } catch {
                        // ignore
                    }
                }
                return;
            }
        }
    });

    chatViewPanel = panel;
    return chatViewPanel;
}
