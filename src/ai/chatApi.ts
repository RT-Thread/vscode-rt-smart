export type ChatApiError =
    | { kind: 'network'; message: string }
    | {
          kind: 'http';
          status: number;
          message: string;
          error?: string;
          body?: string;
          requestId?: string;
          conversationId?: string;
      }
    | { kind: 'parse'; message: string; body?: string; requestId?: string };

export type ChatMeResponse = {
    user: {
        id: string;
        role?: string;
        avatar?: string | null;
        name?: string | null;
        email?: string | null;
    };
    tokens?: {
        accessToken?: string;
        scope?: string;
        expiresIn?: number;
    };
};

export type ChatResponse = {
    reply: string;
    conversationId?: string;
    suggestions?: string[];
};

function normalizeBaseUrl(baseUrl: string): string {
    const trimmed = (baseUrl || '').trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/\/+$/, '');
}

function formatHttpError(status: number, parsed: any, fallbackBody?: string, requestId?: string): ChatApiError {
    const error = typeof parsed?.error === 'string' ? parsed.error : undefined;
    const conversationId = typeof parsed?.conversationId === 'string' ? parsed.conversationId : undefined;
    const message =
        typeof parsed?.message === 'string'
            ? parsed.message
            : typeof parsed?.error === 'string'
                ? parsed.error
                : `Request failed (${status})`;
    const body = typeof fallbackBody === 'string' && fallbackBody.length ? fallbackBody : undefined;
    return { kind: 'http', status, message, error, body, requestId, conversationId };
}

async function requestJson<T>(
    url: string,
    init: RequestInit & { timeoutMs?: number },
): Promise<{ ok: true; data: T } | { ok: false; error: ChatApiError }> {
    const controller = new AbortController();
    const timeoutMs = typeof init.timeoutMs === 'number' ? init.timeoutMs : 15_000;
    const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

    try {
        const { timeoutMs: _timeoutMs, ...fetchInit } = init;
        const res = await fetch(url, { ...fetchInit, signal: controller.signal });
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
            return { ok: false, error: formatHttpError(res.status, parsed, text, requestId) };
        }

        if (parsed === undefined) {
            return {
                ok: false,
                error: { kind: 'parse', message: 'Invalid JSON response.', body: text, requestId },
            };
        }

        return { ok: true, data: parsed as T };
    } catch (e: any) {
        const msg = e?.name === 'AbortError' ? 'Request timeout.' : (e?.message ? String(e.message) : String(e));
        return { ok: false, error: { kind: 'network', message: msg } };
    } finally {
        clearTimeout(timeout);
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

export async function getMe(
    baseUrl: string,
    sid: string,
): Promise<{ ok: true; data: ChatMeResponse } | { ok: false; error: ChatApiError }> {
    const b = normalizeBaseUrl(baseUrl);
    return requestJson<ChatMeResponse>(`${b}/api/me`, {
        method: 'GET',
        headers: buildHeaders(sid),
        timeoutMs: 10_000,
    });
}

export async function postChat(
    baseUrl: string,
    sid: string,
    message: string,
    conversationId: string | null,
): Promise<{ ok: true; data: ChatResponse } | { ok: false; error: ChatApiError }> {
    const b = normalizeBaseUrl(baseUrl);
    return requestJson<ChatResponse>(`${b}/api/chat`, {
        method: 'POST',
        headers: buildHeaders(sid),
        body: JSON.stringify({ message, conversationId }),
        timeoutMs: 60_000,
    });
}
