import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import { getMe, postChat, type ChatApiError } from '../ai/chatApi';

let chatViewPanel: vscode.WebviewPanel | null = null;
const title = 'RT-Thread AI Chat';
const apiBaseUrl = 'https://ai.rt-thread.org';

const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: true,
});

md.validateLink = (url: string): boolean => {
    const u = String(url || '').trim().toLowerCase();
    return u.startsWith('https://') || u.startsWith('http://');
};

const defaultLinkOpenRenderer =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => {
        return self.renderToken(tokens, idx, options);
    });

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noreferrer noopener');
    return defaultLinkOpenRenderer(tokens, idx, options, env, self);
};

function renderMarkdownToHtml(source: string): string {
    try {
        return md.render(String(source ?? ''));
    } catch {
        return `<pre><code>${escapeHtml(String(source ?? ''))}</code></pre>`;
    }
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getApiBaseUrl(): string {
    return apiBaseUrl;
}

function formatApiError(error: ChatApiError): string {
    switch (error.kind) {
        case 'network':
            return `网络错误：${error.message}`;
        case 'parse':
            return `响应解析失败：${error.message}${error.requestId ? `（requestId=${error.requestId}）` : ''}`;
        case 'http': {
            const hint = error.error ? `${error.error}: ` : '';
            const rid = error.requestId ? `（requestId=${error.requestId}）` : '';
            return `后端错误(${error.status})${rid}：${hint}${error.message}`;
        }
    }
}

async function getRTThreadSession(createIfNone: boolean): Promise<vscode.AuthenticationSession | undefined> {
    try {
        return await vscode.authentication.getSession('rt-thread', [], { createIfNone });
    } catch {
        return undefined;
    }
}

function getWebviewHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = [
        `default-src 'none';`,
        `img-src ${webview.cspSource} https: data:;`,
        `style-src ${webview.cspSource} 'unsafe-inline';`,
        `script-src 'nonce-${nonce}';`,
    ].join(' ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: var(--vscode-editor-background);
        --fg: var(--vscode-editor-foreground);
        --border: var(--vscode-editorWidget-border);
        --input-bg: var(--vscode-input-background);
        --input-fg: var(--vscode-input-foreground);
        --input-border: var(--vscode-input-border);
        --button-bg: var(--vscode-button-background);
        --button-fg: var(--vscode-button-foreground);
        --button-bg-hover: var(--vscode-button-hoverBackground);
        --muted: var(--vscode-descriptionForeground);
        --user-bg: color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
        --assistant-bg: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent);
      }

      body {
        margin: 0;
        padding: 0;
        height: 100vh;
        background: var(--bg);
        color: var(--fg);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .app {
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: 10px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .header .title {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .header .status {
        color: var(--muted);
        font-size: 12px;
        white-space: nowrap;
      }

      .header .right {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .header .right .status {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chat {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .messages {
        flex: 1;
        overflow: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .msg {
        max-width: min(820px, 92%);
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        line-height: 1.45;
        word-break: break-word;
      }

      .msg.user {
        align-self: flex-end;
        background: var(--user-bg);
      }

      .msg.assistant {
        align-self: flex-start;
        background: var(--assistant-bg);
      }

      .msg.system {
        align-self: flex-start;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 80%, transparent);
        color: var(--muted);
      }

      .msg a {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
      }

      .msg a:hover {
        color: var(--vscode-textLink-activeForeground);
        text-decoration: underline;
      }

      .msg p {
        margin: 0;
      }

      .msg p + p {
        margin-top: 0.6em;
      }

      .msg h1, .msg h2, .msg h3 {
        margin: 0.8em 0 0.35em;
        line-height: 1.25;
      }

      .msg ul, .msg ol {
        margin: 0.4em 0 0.4em 1.2em;
        padding: 0;
      }

      .msg li + li {
        margin-top: 0.2em;
      }

      .msg blockquote {
        margin: 0.6em 0;
        padding: 0 0 0 10px;
        border-left: 3px solid color-mix(in srgb, var(--vscode-textLink-foreground) 45%, transparent);
        color: color-mix(in srgb, var(--fg) 85%, transparent);
      }

      .msg pre {
        margin: 0.6em 0 0;
        padding: 10px;
        border-radius: 8px;
        overflow: auto;
        word-break: normal;
        overflow-wrap: normal;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, transparent);
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
      }

      .msg code {
        font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
        font-size: 0.95em;
      }

      .msg :not(pre) > code {
        padding: 0 0.3em;
        border-radius: 6px;
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
        border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
      }

      .msg pre code {
        display: block;
        padding: 0;
        background: transparent;
        border: none;
        white-space: pre;
        word-break: normal;
        overflow-wrap: normal;
      }

      .msg table {
        border-collapse: collapse;
        margin: 0.6em 0;
        width: 100%;
      }

      .msg th, .msg td {
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        padding: 6px 8px;
        vertical-align: top;
      }

      .msg th {
        background: color-mix(in srgb, var(--vscode-editorWidget-background) 85%, transparent);
      }

      .composer {
        border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        padding: 10px 12px;
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }

      textarea {
        flex: 1;
        resize: none;
        min-height: 38px;
        max-height: 160px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--input-bg);
        color: var(--input-fg);
        border: 1px solid color-mix(in srgb, var(--input-border) 70%, transparent);
        outline: none;
        font-family: inherit;
      }

      textarea:focus {
        border-color: var(--vscode-focusBorder);
      }

      button {
        height: 38px;
        padding: 0 14px;
        border: none;
        border-radius: 8px;
        background: var(--button-bg);
        color: var(--button-fg);
        cursor: pointer;
        font-weight: 600;
      }

      button:hover {
        background: var(--button-bg-hover);
      }

      button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .link {
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
        cursor: pointer;
        font-size: 12px;
      }

      .link:hover {
        color: var(--vscode-textLink-activeForeground);
        text-decoration: underline;
      }

      .footer {
        padding: 8px 12px 12px;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="header">
        <div id="chatTitle" class="title">RT-Thread AI Chat</div>
        <div class="right">
          <div id="status" class="status">未登录</div>
          <a id="signin" class="link">登录</a>
          <a id="signout" class="link" style="display:none">退出</a>
        </div>
      </div>

      <div class="chat">
        <div id="messages" class="messages" role="log" aria-live="polite"></div>

        <div class="composer">
          <textarea id="input" rows="1" placeholder="输入消息，Enter 发送，Shift+Enter 换行"></textarea>
          <button id="send" type="button">发送</button>
        </div>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const messagesEl = document.getElementById('messages');
      const inputEl = document.getElementById('input');
      const sendBtn = document.getElementById('send');
      const statusEl = document.getElementById('status');
      const signinEl = document.getElementById('signin');
      const signoutEl = document.getElementById('signout');

      const state = {
        signedIn: false,
        backendOk: false,
        busy: false,
        userLabel: '',
      };

      function appendMessage(role, payload) {
        const div = document.createElement('div');
        div.className = 'msg ' + role;
        if (payload && typeof payload === 'object') {
          if (typeof payload.html === 'string') {
            div.innerHTML = payload.html;
          } else if (typeof payload.text === 'string') {
            div.textContent = payload.text;
          } else {
            div.textContent = String(payload.text ?? '');
          }
        } else {
          div.textContent = String(payload ?? '');
        }
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function setStatus(partial) {
        Object.assign(state, partial || {});

        let label = '未登录';
        if (state.signedIn && state.backendOk) {
          label = state.userLabel || 'RT-Thread';
        }
        if (state.busy) {
          label += ' · 处理中...';
        }
        statusEl.textContent = label;

        signinEl.style.display = state.signedIn ? 'none' : '';
        signoutEl.style.display = state.signedIn ? '' : 'none';

        const canSend = state.signedIn && state.backendOk && !state.busy;
        sendBtn.disabled = !canSend;
        inputEl.disabled = !canSend;
      }

      function send() {
        const text = (inputEl.value || '').trimEnd();
        if (!text.trim()) return;
        inputEl.value = '';
        inputEl.style.height = '';
        vscode.postMessage({ command: 'chat.send', text });
      }

      function autosize() {
        inputEl.style.height = '';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
      }

      sendBtn.addEventListener('click', send);
      inputEl.addEventListener('input', autosize);
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      });

      signinEl.addEventListener('click', () => {
        vscode.postMessage({ command: 'auth.signIn' });
      });

      signoutEl.addEventListener('click', () => {
        vscode.postMessage({ command: 'auth.signOut' });
      });

      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || !msg.command) return;
        switch (msg.command) {
          case 'chat.append':
            appendMessage(msg.role || 'assistant', msg);
            break;
          case 'auth.status':
            setStatus(msg);
            break;
          case 'chat.busy':
            setStatus({ busy: !!msg.busy });
            break;
          case 'chat.reply':
            appendMessage('assistant', msg);
            break;
          case 'chat.system':
            appendMessage('system', msg);
            break;
          case 'chat.error':
            appendMessage('system', msg);
            break;
          case 'chat.reset':
            messagesEl.innerHTML = '';
            break;
        }
      });

      vscode.postMessage({ command: 'chat.ready' });
      appendMessage('system', '你好！请先登录 RT-Thread 账号，然后开始对话。');
      setStatus({ signedIn: false, backendOk: false, busy: false, userLabel: '' });
    </script>
  </body>
</html>`;
}

type ResolvedBackendSession =
    | { ok: true; baseUrl: string; sid: string; userId: string; userLabel: string }
    | { ok: false; baseUrl: string };

export function openChatWebview(context: vscode.ExtensionContext) {
    if (chatViewPanel) {
        chatViewPanel.reveal(vscode.ViewColumn.Beside);
        return chatViewPanel;
    }

    const panel = vscode.window.createWebviewPanel('rt-thread-chat', title, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
    });

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'images', 'rt-thread.png');
    panel.iconPath = iconPath;
    panel.webview.html = getWebviewHtml(panel.webview);

    let activeConversationId: string | null = null;
    let busy = false;

    const postChatMessage = (role: 'user' | 'assistant' | 'system', markdownText: string) => {
        void panel.webview.postMessage({
            command: 'chat.append',
            role,
            html: renderMarkdownToHtml(markdownText),
        });
    };

    const postBusy = (b: boolean) => {
        busy = b;
        void panel.webview.postMessage({ command: 'chat.busy', busy: b });
    };

    const resolveBackendSession = async (opts?: { silent?: boolean }): Promise<ResolvedBackendSession> => {
        const silent = !!opts?.silent;
        const baseUrl = getApiBaseUrl();
        const session = await getRTThreadSession(false);
        if (!session?.accessToken) {
            void panel.webview.postMessage({
                command: 'auth.status',
                signedIn: false,
                backendOk: false,
                userLabel: '',
            });
            return { ok: false, baseUrl };
        }

        const me = await getMe(baseUrl, session.accessToken);
        if (!me.ok) {
            void panel.webview.postMessage({
                command: 'auth.status',
                signedIn: false,
                backendOk: false,
                userLabel: '',
            });
            if (silent) {
                console.error('[ai-chat] backend check failed', { error: me.error });
            } else {
                postChatMessage('system', `后端检查失败：${formatApiError(me.error)}（${baseUrl}/api/me）`);
            }
            return { ok: false, baseUrl };
        }

        const userLabel = me.data.user?.name || session?.account.label || '';
        void panel.webview.postMessage({
            command: 'auth.status',
            signedIn: true,
            backendOk: true,
            userLabel,
        });
        const userId = me.data.user?.id ? String(me.data.user.id) : '';
        return { ok: true, baseUrl, sid: session.accessToken, userId, userLabel };
    };

    panel.onDidDispose(() => {
        chatViewPanel = null;
    });

    panel.webview.onDidReceiveMessage(async (message) => {
        if (!message || typeof message.command !== 'string') {
            return;
        }

        switch (message.command) {
            case 'chat.ready':
                await resolveBackendSession();
                return;
            case 'auth.signIn': {
                postBusy(true);
                // When backend check fails we may still have a stored (stale) sid.
                // Force a fresh login so users don't get stuck in a "未登录" loop.
                try {
                    await vscode.commands.executeCommand('extension.RTThreadSignOut');
                } catch {
                    // ignore
                }
                const session = await getRTThreadSession(true);
                postBusy(false);
                if (!session) {
                    postChatMessage('system', '登录已取消。');
                }
                activeConversationId = null;
                await resolveBackendSession();
                return;
            }
            case 'auth.signOut': {
                postBusy(true);
                activeConversationId = null;
                await vscode.commands.executeCommand('extension.RTThreadSignOut');
                postBusy(false);
                await resolveBackendSession({ silent: true });
                postChatMessage('system', '已退出登录。');
                return;
            }
            case 'chat.send': {
                if (busy) {
                    return;
                }

                const session = await getRTThreadSession(false);
                if (!session?.accessToken) {
                    postChatMessage('system', '请先登录 RT-Thread 账号。');
                    await resolveBackendSession({ silent: true });
                    return;
                }

                const baseUrl = getApiBaseUrl();
                const text = typeof message.text === 'string' ? message.text : String(message.text ?? '');

                postChatMessage('user', text);
                postBusy(true);
                try {
                    const resp = await postChat(baseUrl, session.accessToken, text, activeConversationId);
                    if (!resp.ok) {
                        let msg = formatApiError(resp.error);
                        if (resp.error.kind === 'http' && resp.error.conversationId) {
                            activeConversationId = resp.error.conversationId;
                        }
                        if (resp.error.kind === 'http') {
                            if (resp.error.status === 401) {
                                msg = `${msg}（请先登录 RT-Thread 账号）`;
                            } else if (resp.error.error === 'ai_not_configured') {
                                msg = `${msg}（AI 未配置，请在后端设置 LLM_API_KEY 或访问 ${baseUrl}/admin/ai）`;
                            } else if (resp.error.error === 'ai_error') {
                                msg = `${msg}（AI 调用失败，请检查后端 LLM 配置与网络，或访问 ${baseUrl}/admin/ai）`;
                            }
                        }
                        if (resp.error.kind === 'network') {
                            msg = `${msg}（请检查网络连接：${baseUrl}）`;
                        }
                        postChatMessage('system', msg);
                        await resolveBackendSession({ silent: true });
                        return;
                    }

                    if (resp.data.conversationId) {
                        activeConversationId = resp.data.conversationId;
                    }
                    postChatMessage('assistant', resp.data.reply ?? '');
                } finally {
                    postBusy(false);
                }
                return;
            }
        }
    });

    chatViewPanel = panel;
    return chatViewPanel;
}
