// Custom authentication provider implementation:
// - No longer starts Python service within extension, relies on externally started local service
// - Login through browser and use vscode:// custom URI callback to carry token
import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

// Session data structure persisted to VS Code Secret Storage
type StoredSession = {
    id: string;
    accessToken: string;
    account: { id: string; label: string };
    scopes: string[];
};

export class RTThreadAuthProvider implements vscode.AuthenticationProvider {
    public static readonly id = 'rt-thread';
    public static readonly label = 'RT-Thread';

    private _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
    public readonly onDidChangeSessions = this._onDidChangeSessions.event;
    private readonly output: vscode.OutputChannel;
    private log(msg: string): void {
        this.output.appendLine(`[${new Date().toISOString()}] ${msg}`);
    }
    private mask(value: string, keyHint?: string): string {
        if (!value) return '';
        const sensitive = ['token', 'access_token', 'code', 'open_id'];
        if (keyHint && sensitive.includes(keyHint)) {
            if (value.length <= 8) return '*'.repeat(Math.max(4, value.length));
            return `${value.slice(0, 4)}...${value.slice(-4)}`;
        }
        if (value.length <= 8) return value; // keep short non-sensitive values
        return `${value.slice(0, 24)}...(${value.length})`; // long params truncated for readability
    }
    private redactBody(body: string): string {
        let b = body || '';
        try {
            b = b.replace(/("(?:open_id|token|access_token)"\s*:\s*")([^"]+)(")/gi, '$1***redacted***$3');
        } catch {
            // ignore
        }
        if (b.length > 1000) {
            return b.slice(0, 1000) + '...(truncated)';
        }
        return b;
    }
    private dumpParams(params: URLSearchParams): string {
        const pairs: string[] = [];
        params.forEach((v, k) => pairs.push(`${k}=${this.mask(v, k)}`));
        return pairs.join('&');
    }

    // Pending login request (completed/failed through this Promise when browser callback arrives)
    private pendingAuth: {
        resolve: (value: vscode.AuthenticationSession | PromiseLike<vscode.AuthenticationSession>) => void;
        reject: (reason?: any) => void;
    } | undefined;

    // State associated with this login flow (for diagnosis/correlating request-callback)
    private currentState: string | undefined;

    // Secret Storage key name for saving/reading sessions
    private readonly secretKey = `${RTThreadAuthProvider.id}.session`;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.output = vscode.window.createOutputChannel('RT-Thread Auth');
        const ts = new Date().toISOString();
        this.output.appendLine(`[${ts}] RT-Thread Auth provider initialized.`);
    }

    /**
     * Return currently existing sessions (if any)
     */
    async getSessions(
        _scopes: readonly string[] | undefined,
        _options: vscode.AuthenticationProviderSessionOptions,
    ): Promise<vscode.AuthenticationSession[]> {
        const stored = await this.context.secrets.get(this.secretKey);
        if (!stored) {
            return [] as vscode.AuthenticationSession[];
        }
        try {
            const s = JSON.parse(stored) as StoredSession;
            return [this.toVsCodeSession(s)];
        } catch (e) {
            console.warn('Failed to parse stored session', e);
            return [] as vscode.AuthenticationSession[];
        }
    }

    /**
     * Create new session: open browser to complete login, persist to Secret Storage after callback
     */
    async createSession(
        scopes: readonly string[],
        _options: vscode.AuthenticationProviderSessionOptions,
    ): Promise<vscode.AuthenticationSession> {
        const existing = await this.getSessions(undefined, {});
        if (existing.length) {
            return existing[0];
        }

        const session = await this.startLogin(Array.from(scopes || []));
        await this.context.secrets.store(this.secretKey, JSON.stringify(this.fromVsCodeSession(session)));
        this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
        vscode.window.setStatusBarMessage('$(check) RT-Thread: Signed in', 3000);
        return session;
    }

    /**
     * Remove session by sessionId (and trigger session change event)
     */
    async removeSession(sessionId: string): Promise<void> {
        const existing = await this.getSessions(undefined, {});
        const session = existing.find(s => s.id === sessionId);
        if (session) {
            await this.context.secrets.delete(this.secretKey);
            this._onDidChangeSessions.fire({ added: [], removed: [session], changed: [] });
        }
    }

    /**
     * Register URI callback handler: receive callbacks like vscode://<extensionid>/auth-callback?token=...
     */
    registerUriHandler(): vscode.Disposable {
        return vscode.window.registerUriHandler({
            handleUri: async (uri: vscode.Uri) => {
                if (uri.path !== '/auth-callback') {
                    return;
                }
                this.log(`Received auth-callback: ${uri.toString(true)}`);
                const params = new URLSearchParams(uri.query);
                let token = params.get('token') || '';
                // Username displayed in Accounts view. Prefer value from proxy userInfo
                // if available; fall back to callback param; finally to a generic label.
                let username = params.get('username') || 'user';
                const scopes = (params.get('scopes') || 'default').split(',').filter(Boolean);
                const state = params.get('state') || '';
                const code = params.get('code') || '';
                this.log(
                    `Callback params: ${this.dumpParams(params)} | username=${username} | scopes=${scopes.join(',') || '(none)'} | state=${state}`,
                );
                if (this.currentState) {
                    const matched = state && state.includes(this.currentState);
                    this.log(`State check: expected=${this.currentState} | got=${state} | matched=${matched}`);
                } else {
                    this.log(`State check: no expected state recorded (possibly resumed process).`);
                }

                // If no token but code is provided, try calling remote exchange interface to get open_id as token
                if (!token && code) {
                    try {
                        const proxyUrl = `https://api.rt-thread.org/account/client_proxy_rt_agent.php?code=${encodeURIComponent(code)}`;
                        this.log(`Exchanging code via proxy: code=${this.mask(code, 'code')} -> ${proxyUrl}`);
                        const resp = await httpGet(proxyUrl);
                        this.log(`Proxy response: status=${resp.status}, body_len=${(resp.body || '').length}`);
                        this.log(`Proxy body preview: ${this.redactBody(resp.body || '')}`);
                        const json = JSON.parse(resp.body || '{}');
                        const openId: string | undefined = json?.open_id;
                        // Try derive a better display name from userInfo
                        try {
                            const ui = json?.userInfo ?? {};
                            const inferred = ui.username?.toString().trim();
                            if (inferred) {
                                username = inferred;
                                this.log(`Resolved display name from userInfo: ${username}`);
                            }
                        } catch {
                            // ignore userInfo parsing errors
                        }
                        if (openId) {
                            token = openId;
                            this.log(`Obtained open_id from proxy: ${this.mask(openId, 'open_id')}`);
                        }
                    } catch (e) {
                        // Ignore, will still enter no-token error branch later
                        this.log(`Proxy exchange failed: ${String(e)}`);
                    }
                }

                if (!token) {
                    const err = new Error('No token (or exchangeable code) in callback.');
                    this.log(
                        `Sign-in failed: missing token. state=${state}, username=${username}, scopes=${scopes.join(',')}`,
                    );
                    void vscode.window
                        .showErrorMessage('RT-Thread 登录失败：未获取到 token（或 code 交换失败）。点击查看日志。', '查看日志')
                        .then((btn) => {
                            if (btn) {
                                this.output.show(true);
                            }
                        });
                    if (this.pendingAuth) {
                        this.pendingAuth.reject(err);
                        this.pendingAuth = undefined;
                    }
                    vscode.window.setStatusBarMessage('$(error) Sign-in failed: No token in callback.', 3000);
                    return;
                }

                const session: vscode.AuthenticationSession = {
                    id: `${Date.now()}`,
                    accessToken: token,
                    account: { id: username, label: username },
                    scopes,
                };

                // If there is a pending login promise, resolve it.
                if (this.pendingAuth) {
                    this.log(
                        `Resolving pending login for ${username}, scopes=${scopes.join(',')}. token=${this.mask(token, 'token')}`,
                    );
                    this.pendingAuth.resolve(session);
                    this.pendingAuth = undefined;
                    this.currentState = undefined;
                    return;
                }

                // Fallback: no pending login (e.g., user initiated from Accounts view
                // or VS Code reactivated the extension). Persist the session and
                // notify VS Code so the Accounts menu updates.
                this.log(`No pending login. Persisting session for ${username}, scopes=${scopes.join(',')}.`);
                await this.context.secrets.store(this.secretKey, JSON.stringify(this.fromVsCodeSession(session)));
                this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });
                vscode.window.setStatusBarMessage('$(check) RT-Thread: Signed in', 3000);
            },
        });
    }

    /**
     * Sign out all current sessions (this example only supports single session)
     */
    async signOutAll(): Promise<void> {
        const sessions = await this.getSessions(undefined, {});
        if (sessions.length) {
            await this.removeSession(sessions[0].id);
        }
    }

    dispose(): void {
        this._onDidChangeSessions.dispose();
        this.output.dispose();
    }

    // ---- Utility Methods ----

    /** Convert storage structure to VS Code session structure */
    private toVsCodeSession(s: StoredSession): vscode.AuthenticationSession {
        return {
            id: s.id,
            accessToken: s.accessToken,
            account: s.account,
            scopes: s.scopes,
        };
    }

    /** Convert VS Code session to storable structure */
    private fromVsCodeSession(s: vscode.AuthenticationSession): StoredSession {
        return {
            id: s.id,
            accessToken: s.accessToken,
            account: s.account,
            scopes: Array.from(s.scopes || []),
        };
    }

    /**
     * Start browser login:
     * - Construct remote authorization page URL (redirect_uri=vscode://extid/auth-callback)
     * - Open browser and wait for callback (pendingAuth Promise)
     */
    private async startLogin(scopes: string[]): Promise<vscode.AuthenticationSession> {
        const callbackBase = `${vscode.env.uriScheme}://${this.context.extension.id}/auth-callback`;
        // Use vscode custom URI as redirect_uri (consistent with refer/page_guide.md)
        // Generate state to associate callback with this login flow
        const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
        this.currentState = state;

        // Set Id and AuthorizePageURL
        const clientId = '46627107';
        const authorizePage = 'https://www.rt-thread.org/account/user/index.html';

        const scopesStr = scopes.length ? scopes.join(',') : 'basic';
        const authorizeUrl = vscode.Uri.parse(
            `${authorizePage.replace(/\/$/, '')}` +
            `?response_type=code` +
            `&authorized=yes` +
            `&scope=${encodeURIComponent(scopesStr)}` +
            `&state=${encodeURIComponent(state)}` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(callbackBase)}`,
        );
        try {
            const u = new URL(authorizeUrl.toString());
            this.log(`Opening authorize URL: ${authorizeUrl.toString()}`);
            this.log(`Authorize query: ${this.dumpParams(u.searchParams)}`);
        } catch {
            this.log(`Opening authorize URL (raw): ${authorizeUrl.toString()}`);
        }
        await vscode.env.openExternal(authorizeUrl);

        const session = await new Promise<vscode.AuthenticationSession>((resolve, reject) => {
            // Set login timeout: fail if no callback within 1 minutes
            const timeout = setTimeout(() => {
                this.pendingAuth = undefined;
                const err = new Error('Login timed out. Please try again.');
                reject(err);
            }, 1 * 60 * 1000);

            this.pendingAuth = {
                resolve: (s) => {
                    clearTimeout(timeout);
                    resolve(s);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                },
            };
        });

        return session;
    }

    // No ensureServer/stopServer anymore; server is started externally

}

// Minimal GET request (for code -> open_id exchange)
async function httpGet(urlStr: string, headers?: Record<string, string>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    const u = new URL(urlStr);
    const opts: https.RequestOptions = {
        method: 'GET',
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        headers: { ...headers },
    };
    const mod = u.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
        const req = mod.request(opts, (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
            res.on('end', () => {
                const bodyStr = Buffer.concat(chunks).toString('utf-8');
                resolve({ status: res.statusCode || 0, headers: res.headers, body: bodyStr });
            });
        });
        req.on('error', reject);
        req.end();
    });
}


// Provide initialization entry point, register authentication provider, URI handler, commands uniformly here
export function initRTThreadAuth(context: vscode.ExtensionContext): void {
    const provider = new RTThreadAuthProvider(context);
    context.subscriptions.push(provider);

    const authProviderDisposable = vscode.authentication.registerAuthenticationProvider(
        RTThreadAuthProvider.id,
        RTThreadAuthProvider.label,
        provider,
        { supportsMultipleAccounts: false },
    );
    context.subscriptions.push(authProviderDisposable);

    const uriHandlerDisposable = provider.registerUriHandler();
    context.subscriptions.push(uriHandlerDisposable);

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.RTThreadSignIn', async () => {
            try {
                await vscode.authentication.getSession(RTThreadAuthProvider.id, [], { createIfNone: true });
            } catch (e: any) {
                vscode.window.setStatusBarMessage(`$(error) Sign-in failed: ${e?.message ?? e}`.slice(0, 300), 3000);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.RTThreadSignOut', async () => {
            try {
                await provider.signOutAll();
            } catch (e: any) {
                vscode.window.setStatusBarMessage(`$(error) Sign-out failed: ${e?.message ?? e}`.slice(0, 300), 3000);
            }
        }),
    );
}
