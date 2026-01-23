const IS_VSCODE_WEBVIEW = typeof acquireVsCodeApi === "function";

function buildErrorMessage(error) {
  if (!error) {
    return "Request failed";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return String(error);
}

function createWebTransport() {
  async function json(url, options) {
    const init = options && typeof options === "object" ? options : {};
    const headers = {
      "Content-Type": "application/json",
      ...(init.headers && typeof init.headers === "object" ? init.headers : {})
    };
    const hasBody = init.body !== undefined && init.body !== null;
    const body =
      hasBody && typeof init.body === "string"
        ? init.body
        : hasBody
          ? JSON.stringify(init.body)
          : undefined;

    const response = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers,
      body
    });

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }
      const message =
        payload && payload.message ? payload.message : response.statusText;
      throw new Error(message || "Request failed");
    }
    return response.json();
  }

  function stream(url, options) {
    const init = options && typeof options === "object" ? options : {};
    const headers = {
      "Content-Type": "application/json",
      ...(init.headers && typeof init.headers === "object" ? init.headers : {})
    };
    const hasBody = init.body !== undefined && init.body !== null;
    const body =
      hasBody && typeof init.body === "string"
        ? init.body
        : hasBody
          ? JSON.stringify(init.body)
          : undefined;
    const onEvent = typeof init.onEvent === "function" ? init.onEvent : null;

    const controller = new AbortController();
    const finished = (async () => {
      const response = await fetch(url, {
        method: init.method || "POST",
        credentials: "same-origin",
        headers,
        body,
        signal: controller.signal
      });

      if (!response.ok) {
        const raw = await response.text();
        let message = response.statusText || "Request failed";
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.message) {
              message = parsed.message;
            } else {
              message = raw;
            }
          } catch (error) {
            message = raw;
          }
        }
        throw new Error(message);
      }

      if (!response.body) {
        throw new Error("浏览器不支持流式响应。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) {
            continue;
          }
          if (dataStr === "[DONE]") {
            return;
          }
          let payload = null;
          try {
            payload = JSON.parse(dataStr);
          } catch (error) {
            payload = null;
          }
          if (!payload) {
            continue;
          }
          if (onEvent) {
            onEvent(payload);
          }
          if (payload.type === "error") {
            throw new Error(payload.message || "Stream error");
          }
        }
      }
    })();

    return {
      cancel() {
        controller.abort();
      },
      finished
    };
  }

  async function signIn() {
    window.location.href = "/auth/login";
  }

  async function signOut() {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch (error) {
      // ignore
    }
    window.location.href = "/";
  }

  async function openExternal(url) {
    const target = String(url || "").trim();
    if (!target) {
      return;
    }
    window.open(target, "_blank", "noreferrer");
  }

  async function confirm(message) {
    return window.confirm(String(message || ""));
  }

  async function prompt(message, value) {
    const result = window.prompt(String(message || ""), value === undefined ? "" : String(value));
    return result === null ? null : String(result);
  }

  async function notify(_kind, message) {
    window.alert(String(message || ""));
  }

  return {
    kind: "web",
    json,
    stream,
    signIn,
    signOut,
    openExternal,
    confirm,
    prompt,
    notify
  };
}

function createVscodeTransport() {
  const vscode = acquireVsCodeApi();
  let seq = 0;
  const pending = new Map();
  const streams = new Map();

  function nextId(prefix) {
    seq += 1;
    return `${prefix || "req"}_${Date.now()}_${seq}`;
  }

  function post(message) {
    vscode.postMessage(message);
  }

  window.addEventListener("message", (event) => {
    const msg = event && event.data ? event.data : null;
    if (!msg || typeof msg !== "object") {
      return;
    }

    if (msg.type === "rt.chat.rpc.response") {
      const entry = pending.get(msg.id);
      if (!entry) {
        return;
      }
      pending.delete(msg.id);
      if (msg.ok) {
        entry.resolve(msg.data);
        return;
      }
      const requestId = msg.error && msg.error.requestId ? msg.error.requestId : null;
      const message = msg.error && msg.error.message ? msg.error.message : "Request failed";
      entry.reject(new Error(requestId ? `${message}（requestId=${requestId}）` : message));
      return;
    }

    if (msg.type === "rt.chat.stream.event") {
      const entry = streams.get(msg.id);
      if (!entry) {
        return;
      }
      if (entry.onEvent && msg.event) {
        try {
          entry.onEvent(msg.event);
        } catch (error) {
          // ignore UI callback errors
        }
      }
      return;
    }

    if (msg.type === "rt.chat.stream.end") {
      const entry = streams.get(msg.id);
      if (!entry) {
        return;
      }
      streams.delete(msg.id);
      entry.resolve();
      return;
    }

    if (msg.type === "rt.chat.stream.error") {
      const entry = streams.get(msg.id);
      if (!entry) {
        return;
      }
      streams.delete(msg.id);
      const requestId = msg.error && msg.error.requestId ? msg.error.requestId : null;
      const message = msg.error && msg.error.message ? msg.error.message : "Stream error";
      entry.reject(new Error(requestId ? `${message}（requestId=${requestId}）` : message));
      return;
    }

    if (msg.type === "rt.chat.auth.sessionsChanged") {
      bootstrap().catch(() => {});
      return;
    }
  });

  function rpc(op, payload) {
    const id = nextId("rpc");
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    post({ type: "rt.chat.rpc.request", id, op, payload });
    return promise;
  }

  async function json(url, options) {
    return rpc("json", { url, options });
  }

  function stream(url, options) {
    const init = options && typeof options === "object" ? options : {};
    const id = nextId("stream");
    const finished = new Promise((resolve, reject) => {
      streams.set(id, {
        resolve,
        reject,
        onEvent: typeof init.onEvent === "function" ? init.onEvent : null
      });
    });
    post({
      type: "rt.chat.stream.start",
      id,
      url,
      method: init.method || "POST",
      headers: init.headers || null,
      body: init.body
    });
    return {
      cancel() {
        post({ type: "rt.chat.stream.cancel", id });
      },
      finished
    };
  }

  async function signIn() {
    await rpc("auth.signIn", {});
  }

  async function signOut() {
    await rpc("auth.signOut", {});
  }

  async function openExternal(url) {
    await rpc("openExternal", { url });
  }

  async function confirm(message) {
    const resp = await rpc("ui.confirm", { message: String(message || "") });
    return !!resp;
  }

  async function prompt(message, value) {
    const resp = await rpc("ui.prompt", {
      message: String(message || ""),
      value: value === undefined ? "" : String(value)
    });
    if (resp === null || resp === undefined) {
      return null;
    }
    return String(resp);
  }

  async function notify(kind, message) {
    await rpc("ui.notify", { kind: String(kind || "info"), message: String(message || "") });
  }

  return {
    kind: "vscode",
    json,
    stream,
    signIn,
    signOut,
    openExternal,
    confirm,
    prompt,
    notify
  };
}

const transport = IS_VSCODE_WEBVIEW ? createVscodeTransport() : createWebTransport();

const userChip = document.getElementById("user-chip");
const userMenu = document.getElementById("user-menu");
const userMenuButton = document.getElementById("user-menu-button");
const userMenuPanel = document.getElementById("user-menu-panel");
const menuName = document.getElementById("menu-name");
const menuEmail = document.getElementById("menu-email");
const menuCompany = document.getElementById("menu-company");
const menuDomain = document.getElementById("menu-domain");
const chatLog = document.getElementById("chat-log");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const suggestionBar = document.getElementById("chat-suggestions");
const logoutButton = document.getElementById("logout");
const adminLink = document.getElementById("admin-link");
const conversationList = document.getElementById("conversation-list");
const newConversationButton = document.getElementById("new-conversation");
const toggleConversationButton = document.getElementById("toggle-conversation");
const drawerTriggerButton = document.getElementById("conversation-drawer-trigger");
const drawerBackdrop = document.getElementById("conversation-drawer-backdrop");

const ACTIVE_KEY_PREFIX = "rt_chat_active_id_v2:";
const SIDEBAR_COLLAPSED_KEY = "rt_chat_sidebar_collapsed_v1";
const PROFILE_PROMPT_LEGACY_KEY = "rt_profile_card_seen_v1";
const PROFILE_PROMPT_KEY_PREFIX = "rt_profile_prompt_seen_v1:";
const PROFILE_PROMPT_MESSAGE =
  "为了更准确回答，请先完善个人信息：姓名、邮箱、公司、擅长领域。点击个人信息填写。";
const MESSAGE_COLLAPSE_LINE_LIMIT = 12;
const MESSAGE_COLLAPSE_TOLERANCE_PX = 6;
const messageCollapsePreference = new Map();

let conversations = [];
let activeConversationId = null;
let loadToken = 0;
const conversationCache = new Map();
let profilePromptShown = false;
let currentUser = null;
let pollTimer = null;
let pollInFlight = false;
const messageElementById = new Map();
let sidebarCollapsed = false;
let drawerOpen = false;

function escapeHtml(input) {
  const div = document.createElement("div");
  div.textContent = input === null || input === undefined ? "" : String(input);
  return div.innerHTML;
}

function hasStorage() {
  try {
    const testKey = "__rt_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

function readStoredSidebarCollapsed() {
  if (!hasStorage()) {
    return false;
  }
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function storeSidebarCollapsed(collapsed) {
  if (!hasStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (error) {
    // ignore
  }
}

function applySidebarCollapsed(collapsed) {
  sidebarCollapsed = !!collapsed;
  const page = document.querySelector(".page.page-chat");
  if (page) {
    page.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  }
  applyDrawerOpen(false);
  if (toggleConversationButton) {
    toggleConversationButton.textContent = sidebarCollapsed ? "展开" : "收起";
    toggleConversationButton.setAttribute(
      "aria-label",
      sidebarCollapsed ? "展开对话列表" : "收起对话列表"
    );
    toggleConversationButton.title = sidebarCollapsed ? "展开对话列表" : "收起对话列表";
  }
  if (newConversationButton) {
    newConversationButton.textContent = "新建";
    newConversationButton.removeAttribute("title");
    newConversationButton.setAttribute("aria-label", "新建");
  }
}

function applyDrawerOpen(open) {
  drawerOpen = !!open;
  const hasUser = !!currentUser;
  const page = document.querySelector(".page.page-chat");
  if (page) {
    page.classList.toggle("drawer-open", drawerOpen);
  }
  if (drawerBackdrop) {
    drawerBackdrop.hidden = !drawerOpen;
  }
  if (drawerTriggerButton) {
    drawerTriggerButton.hidden = !hasUser || !sidebarCollapsed || drawerOpen;
    drawerTriggerButton.setAttribute("aria-expanded", drawerOpen ? "true" : "false");
  }
}

function getProfilePromptKey(user) {
  const userId = user && user.id ? String(user.id) : "unknown";
  return `${PROFILE_PROMPT_KEY_PREFIX}${userId}`;
}

function getActiveConversationKey(user) {
  const userId = user && user.id ? String(user.id) : "unknown";
  return `${ACTIVE_KEY_PREFIX}${userId}`;
}

function readStoredActiveConversationId(user) {
  if (!hasStorage()) {
    return null;
  }
  try {
    const value = window.localStorage.getItem(getActiveConversationKey(user));
    return value ? String(value).trim() : null;
  } catch (error) {
    return null;
  }
}

function storeActiveConversationId(user, conversationId) {
  if (!hasStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(getActiveConversationKey(user), conversationId);
  } catch (error) {
    // ignore
  }
}

function hasSeenProfilePrompt(user) {
  if (!hasStorage()) {
    return true;
  }
  if (window.localStorage.getItem(PROFILE_PROMPT_LEGACY_KEY) === "1") {
    return true;
  }
  return window.localStorage.getItem(getProfilePromptKey(user)) === "1";
}

function markProfilePromptSeen(user) {
  if (!hasStorage()) {
    return;
  }
  window.localStorage.setItem(getProfilePromptKey(user), "1");
}

function isProfileIncomplete(user) {
  const requiredFields = ["name", "email", "company", "domain"];
  return requiredFields.some((field) => {
    const value = user && user[field] ? String(user[field]).trim() : "";
    return !value;
  });
}

function sanitizeUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) {
    return null;
  }
  if (
    /^https?:/i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^#/.test(trimmed) ||
    /^\//.test(trimmed) ||
    /^\.\//.test(trimmed) ||
    /^\.\.\//.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

function escapeHtmlAttribute(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMarkdown(text) {
  const codeSpans = [];
  let result = "";
  let cursor = 0;

  while (cursor < text.length) {
    if (text[cursor] !== "`") {
      result += text[cursor];
      cursor += 1;
      continue;
    }

    let fenceEnd = cursor;
    while (fenceEnd < text.length && text[fenceEnd] === "`") {
      fenceEnd += 1;
    }

    const fence = text.slice(cursor, fenceEnd);
    const closeIndex = text.indexOf(fence, fenceEnd);
    if (closeIndex === -1) {
      result += fence;
      cursor = fenceEnd;
      continue;
    }

    const code = text.slice(fenceEnd, closeIndex);
    const index = codeSpans.length;
    codeSpans.push(code);
    result += `\u0000RTCODE${index}\u0000`;
    cursor = closeIndex + fence.length;
  }

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
      return label;
    }
    const external = /^https?:/i.test(safeUrl);
    const attrs = external
      ? ' target="_blank" rel="noopener noreferrer"'
      : ' rel="noopener noreferrer"';
    return `<a href="${escapeHtmlAttribute(safeUrl)}"${attrs}>${label}</a>`;
  });

  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  result = result.replace(/_([^_]+)_/g, "<em>$1</em>");
  result = result.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  result = result.replace(/\u0000RTCODE(\d+)\u0000/g, (_match, index) => {
    const code = codeSpans[Number(index)] || "";
    return `<code>${code}</code>`;
  });

  return result;
}

function renderMarkdown(text) {
  const escaped = escapeHtml(text || "");
  const lines = escaped.split(/\r?\n/);
  const output = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeFenceLen = 0;
  let codeLines = [];
  let paragraphLines = [];
  let quoteLines = [];
  let listType = null;
  let listItems = [];

  function flushParagraph() {
    if (!paragraphLines.length) {
      return;
    }
    const paragraph = renderInlineMarkdown(paragraphLines.join("<br>"));
    output.push(`<p>${paragraph}</p>`);
    paragraphLines = [];
  }

  function flushQuote() {
    if (!quoteLines.length) {
      return;
    }
    const quote = renderInlineMarkdown(quoteLines.join("<br>"));
    output.push(`<blockquote>${quote}</blockquote>`);
    quoteLines = [];
  }

  function flushList() {
    if (!listType || !listItems.length) {
      listType = null;
      listItems = [];
      return;
    }
    const items = listItems
      .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
      .join("");
    output.push(`<${listType}>${items}</${listType}>`);
    listType = null;
    listItems = [];
  }

  function flushCodeBlock() {
    const code = codeLines.join("\n");
    const language = String(codeLang || "")
      .trim()
      .split(/\s+/)[0]
      .toLowerCase();
    const mapped =
      language === "c++"
        ? "cpp"
        : language === "c#"
          ? "csharp"
          : language === "f#"
            ? "fsharp"
            : language;
    const safeLang = mapped.replace(/[^a-z0-9_-]+/g, "");
    const className = safeLang ? ` class="language-${safeLang}"` : "";
    output.push(`<pre><code${className}>${code}</code></pre>`);
    codeLines = [];
    codeLang = "";
    codeFenceLen = 0;
  }

  lines.forEach((line) => {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,})(.*)$/);
    if (fenceMatch) {
      const fenceLen = fenceMatch[1].length;
      const rest = (fenceMatch[2] || "").trim();

      if (inCodeBlock) {
        const closeMatch = trimmed.match(/^`{3,}\s*$/);
        if (closeMatch && fenceLen >= codeFenceLen) {
          flushCodeBlock();
          inCodeBlock = false;
          return;
        }
      } else {
        flushParagraph();
        flushList();
        flushQuote();
        inCodeBlock = true;
        codeFenceLen = fenceLen;
        codeLang = rest;
        return;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quoteLines.push(quoteMatch[1]);
      return;
    }

    if (quoteLines.length) {
      flushQuote();
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2]);
      output.push(`<h${level}>${content}</h${level}>`);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const nextType = unorderedMatch ? "ul" : "ol";
      if (listType && listType !== nextType) {
        flushList();
      }
      listType = nextType;
      listItems.push((unorderedMatch || orderedMatch)[1]);
      return;
    }

    if (listType) {
      flushList();
    }

    paragraphLines.push(line);
  });

  if (inCodeBlock) {
    flushCodeBlock();
  }

  flushParagraph();
  flushList();
  flushQuote();

  return output.join("");
}

async function requestJson(url, options) {
  return transport.json(url, options);
}

function setUserMenuOpen(open) {
  if (!userMenuButton || !userMenuPanel) {
    return;
  }
  userMenuPanel.hidden = !open;
  userMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
}

function initializeUserMenu() {
  if (!userMenuButton || !userMenuPanel || !userMenu) {
    return;
  }
  userMenuButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (transport.kind === "vscode" && !currentUser) {
      setUserMenuOpen(false);
      setChatDisabled(true, "正在跳转登录...");
      try {
        await transport.signIn();
      } catch (error) {
        void transport
          .notify("error", `登录失败：${buildErrorMessage(error)}`)
          .catch(() => {});
      } finally {
        await bootstrap();
      }
      return;
    }
    setUserMenuOpen(userMenuPanel.hidden);
  });

  userMenuPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    setUserMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setUserMenuOpen(false);
    }
  });
}

function setChatDisabled(disabled, placeholder) {
  chatInput.disabled = disabled;
  if (placeholder !== undefined) {
    chatInput.placeholder = placeholder;
    return;
  }
  chatInput.placeholder = disabled ? "加载中..." : "输入一句话...";
}

function renderSuggestions(items) {
  if (!suggestionBar) {
    return;
  }
  suggestionBar.innerHTML = "";
  if (!items || !items.length) {
    suggestionBar.hidden = true;
    return;
  }
  const label = document.createElement("div");
  label.className = "suggestions-label";
  label.textContent = "建议补充";
  const list = document.createElement("div");
  list.className = "suggestions-list";
  items.forEach((text) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = text;
    button.addEventListener("click", () => {
      const current = chatInput.value.trim();
      chatInput.value = current ? `${current} ${text}` : text;
      chatInput.focus();
    });
    list.appendChild(button);
  });
  suggestionBar.appendChild(label);
  suggestionBar.appendChild(list);
  suggestionBar.hidden = false;
}

function buildProfilePromptCardElement({ messageText, onDismiss }) {
  const card = document.createElement("div");
  card.className = "profile-card-message";

  const title = document.createElement("div");
  title.className = "profile-card-title";
  title.textContent = "完善个人信息";
  title.id = "profile-prompt-title";

  const body = document.createElement("div");
  body.className = "profile-card-body";
  body.textContent = messageText;

  const list = document.createElement("ul");
  list.className = "profile-card-list";
  ["姓名", "邮箱", "公司", "擅长领域"].forEach((label) => {
    const item = document.createElement("li");
    item.textContent = label;
    list.appendChild(item);
  });

  const actions = document.createElement("div");
  actions.className = "profile-card-actions";

  const link = document.createElement("a");
  link.className = "button button-small";
  link.href = "/profile";
  link.textContent = "去填写";
  link.addEventListener("click", () => {
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  });
  actions.appendChild(link);

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "profile-modal-dismiss";
  dismiss.textContent = "稍后再说";
  dismiss.addEventListener("click", () => {
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  });
  actions.appendChild(dismiss);

  const hint = document.createElement("div");
  hint.className = "profile-card-hint";
  hint.textContent = "也可在右上角菜单随时修改。";

  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(list);
  card.appendChild(actions);
  card.appendChild(hint);

  return card;
}

function showProfilePromptModal(user) {
  if (profilePromptShown) {
    return;
  }
  if (!isProfileIncomplete(user)) {
    return;
  }
  if (hasSeenProfilePrompt(user)) {
    return;
  }

  profilePromptShown = true;
  markProfilePromptSeen(user);

  if (document.getElementById("profile-prompt-modal")) {
    return;
  }

  const previousFocus =
    document.activeElement && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const overlay = document.createElement("div");
  overlay.className = "modal-backdrop";
  overlay.id = "profile-prompt-modal";

  const dialog = document.createElement("div");
  dialog.className = "modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "profile-prompt-title");

  function close() {
    document.removeEventListener("keydown", handleKeydown);
    document.body.classList.remove("modal-open");
    overlay.remove();
    if (previousFocus) {
      previousFocus.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      close();
    }
  }

  document.addEventListener("keydown", handleKeydown);

  overlay.addEventListener("click", () => close());
  dialog.addEventListener("click", (event) => event.stopPropagation());

  const card = buildProfilePromptCardElement({
    messageText: PROFILE_PROMPT_MESSAGE,
    onDismiss: close
  });

  dialog.appendChild(card);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.body.classList.add("modal-open");

  const primaryAction = card.querySelector("a.button");
  if (primaryAction && primaryAction.focus) {
    requestAnimationFrame(() => primaryAction.focus());
  }
}

function setMessageElementId(element, messageId) {
  if (!element || !messageId) {
    return;
  }
  const id = String(messageId).trim();
  if (!id) {
    return;
  }
  element.dataset.messageId = id;
  messageElementById.set(id, element);
}

function getMessageElementById(messageId) {
  if (!messageId) {
    return null;
  }
  const id = String(messageId).trim();
  return id ? messageElementById.get(id) || null : null;
}

function resolveLineHeightPx(element) {
  if (!element) {
    return 24;
  }
  const computed = window.getComputedStyle(element);
  const lineHeight = computed.lineHeight;
  if (lineHeight && lineHeight !== "normal") {
    const parsed = Number.parseFloat(lineHeight);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const fontSize = Number.parseFloat(computed.fontSize);
  if (Number.isFinite(fontSize) && fontSize > 0) {
    return fontSize * 1.5;
  }
  return 24;
}

function getMessageCollapseKey(messageElement) {
  if (!messageElement) {
    return null;
  }
  const messageId = messageElement.dataset.messageId;
  if (!messageId) {
    return null;
  }
  const conversationId = activeConversationId ? String(activeConversationId) : "unknown";
  return `${conversationId}:${messageId}`;
}

function readMessageCollapsePreference(messageElement) {
  const key = getMessageCollapseKey(messageElement);
  if (!key) {
    return null;
  }
  return messageCollapsePreference.has(key) ? messageCollapsePreference.get(key) : null;
}

function writeMessageCollapsePreference(messageElement, preference) {
  const key = getMessageCollapseKey(messageElement);
  if (!key) {
    return;
  }
  if (preference === "expanded" || preference === "collapsed") {
    messageCollapsePreference.set(key, preference);
  }
}

function clearMessageCollapsePreference(messageElement) {
  const key = getMessageCollapseKey(messageElement);
  if (!key) {
    return;
  }
  messageCollapsePreference.delete(key);
}

function cleanupMessageCollapse(messageElement) {
  if (!messageElement) {
    return;
  }
  messageElement.classList.remove("collapsible", "is-collapsed");
  messageElement.style.removeProperty("--message-collapse-height");
  delete messageElement.dataset.collapseState;
  const toggle = messageElement.querySelector(".message-toggle");
  if (toggle) {
    toggle.remove();
  }
}

function updateMessageToggle(toggle, expanded) {
  if (!toggle) {
    return;
  }
  toggle.textContent = expanded ? "收起" : "展开";
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function getOrCreateMessageToggle(messageElement) {
  const existing = messageElement.querySelector(".message-toggle");
  if (existing) {
    return existing;
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "message-toggle";
  toggle.addEventListener("click", () => {
    const currentlyCollapsed = messageElement.classList.contains("is-collapsed");
    const nextCollapsed = !currentlyCollapsed;
    const nextPreference = nextCollapsed ? "collapsed" : "expanded";
    messageElement.dataset.collapseState = nextPreference;
    writeMessageCollapsePreference(messageElement, nextPreference);
    messageElement.classList.toggle("is-collapsed", nextCollapsed);
    updateMessageToggle(toggle, !nextCollapsed);
  });
  messageElement.appendChild(toggle);
  return toggle;
}

function applyAutoCollapse(messageElement) {
  if (!messageElement) {
    return;
  }
  if (
    !messageElement.classList.contains("user") &&
    !messageElement.classList.contains("bot")
  ) {
    cleanupMessageCollapse(messageElement);
    return;
  }
  if (messageElement.classList.contains("streaming")) {
    cleanupMessageCollapse(messageElement);
    return;
  }

  const content = messageElement.querySelector(".message-content");
  if (!content) {
    cleanupMessageCollapse(messageElement);
    return;
  }

  const maxHeightPx = Math.round(resolveLineHeightPx(content) * MESSAGE_COLLAPSE_LINE_LIMIT);
  messageElement.style.setProperty("--message-collapse-height", `${maxHeightPx}px`);

  const storedPreference = readMessageCollapsePreference(messageElement);
  if (storedPreference) {
    messageElement.dataset.collapseState = storedPreference;
  } else if (messageElement.dataset.collapseState) {
    writeMessageCollapsePreference(messageElement, messageElement.dataset.collapseState);
  }

  messageElement.classList.remove("is-collapsed");
  const fullHeight = content.scrollHeight;
  const needsCollapse = fullHeight > maxHeightPx + MESSAGE_COLLAPSE_TOLERANCE_PX;

  if (!needsCollapse) {
    clearMessageCollapsePreference(messageElement);
    cleanupMessageCollapse(messageElement);
    return;
  }

  messageElement.classList.add("collapsible");
  const toggle = getOrCreateMessageToggle(messageElement);
  const preference = messageElement.dataset.collapseState;
  const shouldCollapse = preference !== "expanded";
  messageElement.classList.toggle("is-collapsed", shouldCollapse);
  updateMessageToggle(toggle, !shouldCollapse);
}

function createMessageElement(role, text, options = {}) {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  if (options.messageId) {
    setMessageElementId(message, options.messageId);
  }
  message.dataset.messageText = text || "";
  if (options.pending) {
    message.classList.add("pending");
  }
  if (options.streaming) {
    message.classList.add("streaming");
  }
  const content = document.createElement("div");
  content.className = "message-content";
  if (options.streaming) {
    content.textContent = text || "";
  } else {
    content.innerHTML = renderMarkdown(text);
  }
  message.appendChild(content);
  return message;
}

function renderMessages(messages) {
  chatLog.innerHTML = "";
  messageElementById.clear();
  if (!messages || !messages.length) {
    renderSuggestions([]);
    return;
  }
  messages.forEach((message) => {
    const messageId = message && message.id ? message.id : null;
    const element = createMessageElement(message.role, message.text, { messageId });
    chatLog.appendChild(element);
    applyAutoCollapse(element);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
  renderSuggestions([]);
}

function appendMessage(role, text, options = {}) {
  const element = createMessageElement(role, text, options);
  chatLog.appendChild(element);
  applyAutoCollapse(element);
  chatLog.scrollTop = chatLog.scrollHeight;
  return element;
}

function appendMessages(messages) {
  messages.forEach((message) => {
    const messageId = message && message.id ? message.id : null;
    const element = createMessageElement(message.role, message.text, { messageId });
    chatLog.appendChild(element);
    applyAutoCollapse(element);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateMessageElement(element, role, text, options = {}) {
  if (!element) {
    return;
  }
  const preservedCollapseState = element.dataset.collapseState;
  element.className = `message ${role}`;
  if (options.messageId) {
    setMessageElementId(element, options.messageId);
  }
  element.dataset.messageText = text || "";
  if (preservedCollapseState) {
    element.dataset.collapseState = preservedCollapseState;
  }
  if (options.pending) {
    element.classList.add("pending");
  }
  if (options.streaming) {
    element.classList.add("streaming");
  }
  const content = element.querySelector(".message-content");
  if (content) {
    if (options.streaming) {
      content.textContent = text || "";
    } else {
      content.innerHTML = renderMarkdown(text);
    }
  } else {
    element.innerHTML = options.streaming ? "" : renderMarkdown(text);
  }
  applyAutoCollapse(element);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function sortConversations() {
  conversations.sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || 0);
    const bTime = Date.parse(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });
}

function updateConversationSummary(summary) {
  const existing = conversations.find((item) => item.id === summary.id);
  if (existing) {
    Object.assign(existing, summary);
  } else {
    conversations.push(summary);
  }
  sortConversations();
}

function removeConversationSummary(id) {
  conversations = conversations.filter((item) => item.id !== id);
}

function renderConversationList() {
  if (!conversationList) {
    return;
  }
  conversationList.innerHTML = "";
  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "暂无对话，点击新建开始。";
    conversationList.appendChild(empty);
    return;
  }

  conversations.forEach((conversation) => {
    const item = document.createElement("div");
    item.className = "conversation-item";
    if (conversation.id === activeConversationId) {
      item.classList.add("active");
    }

    const main = document.createElement("button");
    main.type = "button";
    main.className = "conversation-main";

    const title = document.createElement("div");
    title.className = "conversation-title";
    title.textContent = conversation.title || "未命名对话";

    const meta = document.createElement("div");
    meta.className = "conversation-meta";
    const count = conversation.messageCount || 0;
    meta.textContent = `${count} 条消息`;

    main.appendChild(title);
    main.appendChild(meta);
    main.addEventListener("click", () => setActiveConversation(conversation.id));

    const actions = document.createElement("div");
    actions.className = "conversation-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "conversation-rename";
    renameBtn.textContent = "重命名";
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      void renameConversation(conversation).catch((error) => {
        void transport
          .notify("error", `重命名失败：${buildErrorMessage(error)}`)
          .catch(() => {});
      });
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "conversation-delete";
    deleteBtn.textContent = "删除";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      void deleteConversation(conversation).catch((error) => {
        void transport
          .notify("error", `删除失败：${buildErrorMessage(error)}`)
          .catch(() => {});
      });
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(main);
    item.appendChild(actions);
    conversationList.appendChild(item);
  });
}

async function loadConversationDetail(conversationId) {
  const token = ++loadToken;
  setChatDisabled(true);
  chatLog.innerHTML = "";
  chatLog.appendChild(createMessageElement("system", "加载会话中..."));

  try {
    const data = await requestJson(`/api/conversations/${conversationId}`);
    if (token !== loadToken) {
      return;
    }
    const conversation = data.conversation;
    updateConversationSummary({
      id: conversation.id,
      title: conversation.title,
      autoTitle: conversation.autoTitle,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      messageCount: conversation.messages ? conversation.messages.length : 0
    });
    conversationCache.set(conversation.id, conversation);
    activeConversationId = conversation.id;
    storeActiveConversationId(currentUser, activeConversationId);
    renderConversationList();
    renderMessages(conversation.messages || []);
  } catch (error) {
    if (token !== loadToken) {
      return;
    }
    renderMessages([{ role: "system", text: `加载失败：${error.message}` }]);
  } finally {
    if (token === loadToken) {
      setChatDisabled(false);
    }
  }
}

function setActiveConversation(conversationId) {
  if (!conversationId) {
    return;
  }
  if (conversationId === activeConversationId) {
    return;
  }
  if (sidebarCollapsed && drawerOpen) {
    applyDrawerOpen(false);
  }
  loadConversationDetail(conversationId);
}

async function refreshConversationList() {
  const data = await requestJson("/api/conversations");
  conversations = data.conversations || [];
  sortConversations();
  renderConversationList();
  return conversations;
}

async function createConversation() {
  const data = await requestJson("/api/conversations", {
    method: "POST",
    body: JSON.stringify({})
  });
  const conversation = data.conversation;
  updateConversationSummary({
    id: conversation.id,
    title: conversation.title,
    autoTitle: conversation.autoTitle,
    updatedAt: conversation.updatedAt,
    lastMessageAt: conversation.lastMessageAt,
    messageCount: conversation.messages ? conversation.messages.length : 0
  });
  conversationCache.set(conversation.id, conversation);
  activeConversationId = conversation.id;
  storeActiveConversationId(currentUser, activeConversationId);
  renderConversationList();
  renderMessages(conversation.messages || []);
  if (sidebarCollapsed && drawerOpen) {
    applyDrawerOpen(false);
  }
}

async function deleteConversation(conversation) {
  const ok = await transport.confirm(`确定删除 "${conversation.title}" 吗？`);
  if (!ok) {
    return;
  }
  await requestJson(`/api/conversations/${conversation.id}`, { method: "DELETE" });
  removeConversationSummary(conversation.id);
  conversationCache.delete(conversation.id);

  if (activeConversationId === conversation.id) {
    const next = conversations[0];
    if (next) {
      await loadConversationDetail(next.id);
    } else {
      await createConversation();
    }
  } else {
    renderConversationList();
  }
}

async function renameConversation(conversation) {
  const nextTitle = await transport.prompt(
    "请输入新的对话标题",
    conversation.title || ""
  );
  if (nextTitle === null) {
    return;
  }
  const trimmed = nextTitle.trim();
  if (!trimmed) {
    await transport.notify("error", "标题不能为空");
    return;
  }
  const data = await requestJson(`/api/conversations/${conversation.id}`, {
    method: "PUT",
    body: JSON.stringify({ title: trimmed })
  });
  updateConversationSummary(data.conversation);
  const cached = conversationCache.get(conversation.id);
  if (cached) {
    cached.title = data.conversation.title;
  }
  renderConversationList();
}

async function sendMessage(text, pendingElement, userElement) {
  const payload = {
    message: text,
    conversationId: activeConversationId
  };
  let streamedText = "";
  let donePayload = null;
  if (pendingElement) {
    updateMessageElement(pendingElement, "bot", "AI 正在回答...", {
      pending: true,
      streaming: true
    });
  }

  const stream = transport.stream("/api/chat/stream", {
    method: "POST",
    body: payload,
    onEvent: (eventPayload) => {
      if (!eventPayload) {
        return;
      }
      if (eventPayload.type === "start") {
        const nextConversationId = eventPayload.conversationId;
        if (nextConversationId && nextConversationId !== activeConversationId) {
          activeConversationId = nextConversationId;
          storeActiveConversationId(currentUser, activeConversationId);
        }
        if (eventPayload.userMessageId && userElement) {
          updateMessageElement(userElement, "user", text, {
            messageId: eventPayload.userMessageId
          });
        }
        if (eventPayload.assistantMessageId && pendingElement) {
          setMessageElementId(pendingElement, eventPayload.assistantMessageId);
        }
        return;
      }
      if (eventPayload.type === "delta") {
        const delta = eventPayload.delta ? String(eventPayload.delta) : "";
        if (!delta) {
          return;
        }
        streamedText += delta;
        if (pendingElement) {
          updateMessageElement(pendingElement, "bot", streamedText, {
            pending: true,
            streaming: true
          });
        }
        return;
      }
      if (eventPayload.type === "done") {
        donePayload = eventPayload.data || null;
      }
    }
  });

  await stream.finished;

  const data = donePayload || {
    reply: streamedText,
    suggestions: [],
    conversationId: activeConversationId,
    messages: []
  };
  const summary = data.conversation;
  if (summary) {
    updateConversationSummary(summary);
  }
  const conversationId = data.conversationId || activeConversationId;
  if (conversationId !== activeConversationId) {
    activeConversationId = conversationId;
  }
  storeActiveConversationId(currentUser, activeConversationId);

  const messages = (data.messages || []).filter(Boolean);
  const botMessage = messages.find((message) => message.role === "bot") || null;
  let cached = conversationCache.get(conversationId);
  if (!cached) {
    cached = { id: conversationId, messages: [] };
    conversationCache.set(conversationId, cached);
  }
  cached.messages = cached.messages || [];
  cached.messages.push(...messages);
  cached.updatedAt = summary ? summary.updatedAt : cached.updatedAt;
  cached.lastMessageAt = summary ? summary.lastMessageAt : cached.lastMessageAt;
  if (summary && summary.title) {
    cached.title = summary.title;
  }
  if (conversationId === activeConversationId) {
    if (botMessage) {
      if (pendingElement) {
        updateMessageElement(pendingElement, "bot", botMessage.text || data.reply || streamedText);
      } else {
        appendMessage("bot", botMessage.text || data.reply || streamedText);
      }
      renderSuggestions(data.suggestions || []);
    } else if (pendingElement) {
      updateMessageElement(pendingElement, "system", "AI 返回为空。");
      renderSuggestions([]);
    }
  }
  renderConversationList();
}

async function loadProfile() {
  let data = null;
  try {
    data = await requestJson("/api/me");
  } catch (error) {
    if (transport.kind !== "vscode") {
      window.location.href = "/";
      return null;
    }
    throw error;
  }
  const user = data.user || {};

  const displayName = user.name || user.email || "Signed in";
  userChip.textContent = displayName;
  if (menuName) {
    menuName.textContent = displayName;
  }
  if (menuEmail) {
    menuEmail.textContent = user.email || "-";
  }
  if (menuCompany) {
    menuCompany.textContent = user.company || "-";
  }
  if (menuDomain) {
    menuDomain.textContent = user.domain || "-";
  }

  if (adminLink) {
    adminLink.hidden = user.role !== "admin";
  }

  showProfilePromptModal(user);
  return user;
}

async function initializeConversations() {
  await refreshConversationList();
  if (!conversations.length) {
    await createConversation();
    setChatDisabled(false);
    return;
  }
  const storedActive = readStoredActiveConversationId(currentUser);
  const initial = conversations.find((item) => item.id === storedActive) || conversations[0];
  await loadConversationDetail(initial.id);
}

function getActiveConversationSummary() {
  if (!activeConversationId) {
    return null;
  }
  return conversations.find((item) => item.id === activeConversationId) || null;
}

function conversationFingerprint(summary) {
  if (!summary) {
    return "";
  }
  const stamp = summary.updatedAt || summary.lastMessageAt || "";
  const count =
    typeof summary.messageCount === "number" ? String(summary.messageCount) : "";
  return `${stamp}|${count}`;
}

async function refreshActiveConversationIncremental() {
  const conversationId = activeConversationId;
  if (!conversationId) {
    return;
  }
  const existing = conversationCache.get(conversationId);
  const existingMessages = existing && Array.isArray(existing.messages) ? existing.messages : [];
  const lastKnown = existingMessages.length ? existingMessages[existingMessages.length - 1] : null;

  const data = await requestJson(`/api/conversations/${conversationId}`);
  const conversation = data.conversation;
  if (!conversation || conversation.id !== conversationId) {
    await loadConversationDetail(conversationId);
    return;
  }

  updateConversationSummary({
    id: conversation.id,
    title: conversation.title,
    autoTitle: conversation.autoTitle,
    updatedAt: conversation.updatedAt,
    lastMessageAt: conversation.lastMessageAt,
    messageCount: conversation.messages ? conversation.messages.length : 0
  });
  conversationCache.set(conversation.id, conversation);
  renderConversationList();

  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  if (messages.length !== existingMessages.length) {
    renderMessages(messages);
    return;
  }
  if (!lastKnown || !lastKnown.id) {
    renderMessages(messages);
    return;
  }
  const index = messages.findIndex((message) => message && message.id === lastKnown.id);
  if (index === -1) {
    renderMessages(messages);
    return;
  }
  const next = messages.slice(index + 1);
  if (next.length) {
    appendMessages(next);
  }

  const last = messages.length ? messages[messages.length - 1] : null;
  if (last && last.id) {
    const element = getMessageElementById(last.id);
    const nextText = last.text || "";
    if (element && element.dataset.messageText !== nextText) {
      updateMessageElement(element, last.role, nextText, { messageId: last.id });
    }
  }
}

async function pollConversationUpdates() {
  if (document.hidden) {
    return;
  }
  if (pollInFlight) {
    return;
  }
  if (chatInput && chatInput.disabled) {
    return;
  }
  if (!activeConversationId) {
    return;
  }

  pollInFlight = true;
  try {
    const before = conversationFingerprint(getActiveConversationSummary());
    await refreshConversationList();
    const afterSummary = getActiveConversationSummary();
    if (!afterSummary) {
      const next = conversations[0];
      if (next) {
        await loadConversationDetail(next.id);
      } else {
        await createConversation();
      }
      return;
    }
    const cached = conversationCache.get(afterSummary.id);
    const cachedMessages = cached && Array.isArray(cached.messages) ? cached.messages : null;
    if (
      cachedMessages &&
      typeof afterSummary.messageCount === "number" &&
      cachedMessages.length !== afterSummary.messageCount
    ) {
      await refreshActiveConversationIncremental();
      return;
    }
    const after = conversationFingerprint(afterSummary);
    if (after && after !== before) {
      await refreshActiveConversationIncremental();
    }
  } catch (error) {
    // ignore polling errors
  } finally {
    pollInFlight = false;
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }
  pollTimer = setInterval(() => {
    pollConversationUpdates();
  }, 3000);
}

function stopPolling() {
  if (!pollTimer) {
    return;
  }
  clearInterval(pollTimer);
  pollTimer = null;
}

let bootstrapToken = 0;

async function bootstrap() {
  const token = ++bootstrapToken;
  stopPolling();
  pollInFlight = false;
  loadToken += 1;

  currentUser = null;
  applyDrawerOpen(false);

  conversations = [];
  activeConversationId = null;
  conversationCache.clear();
  messageElementById.clear();
  profilePromptShown = false;

  if (conversationList) {
    conversationList.innerHTML = "";
  }
  if (chatLog) {
    chatLog.innerHTML = "";
  }
  renderSuggestions([]);
  setChatDisabled(true);
  if (newConversationButton) {
    newConversationButton.disabled = true;
  }

  if (userChip) {
    userChip.textContent = "正在加载资料...";
    userChip.classList.remove("auth-required");
  }
  if (userMenuButton) {
    userMenuButton.classList.remove("auth-required");
    userMenuButton.removeAttribute("title");
    userMenuButton.setAttribute("aria-label", "用户菜单");
  }
  if (menuName) {
    menuName.textContent = "---";
  }
  if (menuEmail) {
    menuEmail.textContent = "---";
  }
  if (menuCompany) {
    menuCompany.textContent = "---";
  }
  if (menuDomain) {
    menuDomain.textContent = "---";
  }
  if (logoutButton && transport.kind === "vscode") {
    logoutButton.textContent = "登录";
  }
  if (adminLink) {
    adminLink.hidden = true;
  }

  try {
    const user = await loadProfile();
    if (token !== bootstrapToken) {
      return;
    }
    currentUser = user || null;
    applyDrawerOpen(false);
    if (newConversationButton) {
      newConversationButton.disabled = false;
    }
    if (logoutButton && transport.kind === "vscode") {
      logoutButton.textContent = "退出登录";
    }
    if (userChip) {
      userChip.classList.remove("auth-required");
    }
    if (userMenuButton) {
      userMenuButton.classList.remove("auth-required");
      userMenuButton.removeAttribute("title");
      userMenuButton.setAttribute("aria-label", "用户菜单");
    }

    await initializeConversations();
    if (token !== bootstrapToken) {
      return;
    }
    startPolling();
  } catch (error) {
    if (token !== bootstrapToken) {
      return;
    }
    const errorMessage = buildErrorMessage(error);
    const isAuthError = /not_authenticated|login required|(^|\\D)401(\\D|$)/i.test(
      String(errorMessage || "")
    );
    const hint =
      !isAuthError && transport.kind === "vscode"
        ? "\n\n可在 VSCode 设置中配置 `smart.aiChatBaseUrl` 指向可访问的 AiChat 后端。"
        : "";
    currentUser = null;
    applyDrawerOpen(false);
    if (userChip) {
      userChip.textContent = transport.kind === "vscode" ? "未登录" : "Signed out";
      if (transport.kind === "vscode") {
        userChip.classList.add("auth-required");
      }
    }
    if (userMenuButton && transport.kind === "vscode") {
      userMenuButton.classList.add("auth-required");
      userMenuButton.title = "点击登录";
      userMenuButton.setAttribute("aria-label", "未登录，点击登录");
    }
    if (logoutButton && transport.kind === "vscode") {
      logoutButton.textContent = "登录";
    }
    if (chatLog) {
      chatLog.innerHTML = "";
      chatLog.appendChild(
        createMessageElement(
          "system",
          isAuthError ? "请先登录 RT-Thread 账号。" : `初始化失败：${errorMessage}${hint}`
        )
      );
    }
    setChatDisabled(true, isAuthError ? "请先登录..." : "加载失败...");
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
      return;
    }
    chatInput.value = "";
    setChatDisabled(true);
    const userElement = appendMessage("user", text);
    const pendingElement = appendMessage("bot", "AI 正在回答...", { pending: true });
    renderSuggestions([]);
    try {
      await sendMessage(text, pendingElement, userElement);
    } catch (error) {
      updateMessageElement(
        pendingElement,
        "system",
        `发送失败：${buildErrorMessage(error)}`
      );
      renderSuggestions([]);
    } finally {
      setChatDisabled(false);
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    if (transport.kind !== "vscode") {
      await transport.signOut();
      return;
    }

    setChatDisabled(true, "处理中...");
    try {
      if (currentUser) {
        await transport.signOut();
      } else {
        await transport.signIn();
      }
    } catch (error) {
      if (chatLog) {
        chatLog.appendChild(
          createMessageElement("system", `操作失败：${buildErrorMessage(error)}`)
        );
      }
    } finally {
      await bootstrap();
    }
  });
}

const profileLink = document.getElementById("profile-link");
if (profileLink && transport.kind === "vscode") {
  profileLink.addEventListener("click", (event) => {
    event.preventDefault();
    transport.openExternal(profileLink.getAttribute("href") || "/profile");
  });
}

if (adminLink && transport.kind === "vscode") {
  adminLink.addEventListener("click", (event) => {
    event.preventDefault();
    transport.openExternal(
      adminLink.getAttribute("href") || "/rt_thread_adzxcdfwrqwafvdsf_admin"
    );
  });
}

if (transport.kind === "vscode") {
  document.addEventListener(
    "click",
    (event) => {
      const target = event && event.target ? event.target : null;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest("a");
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }
      event.preventDefault();
      transport.openExternal(href);
    },
    true
  );
}

if (newConversationButton) {
  newConversationButton.addEventListener("click", async () => {
    if (!currentUser) {
      if (chatLog) {
        chatLog.appendChild(createMessageElement("system", "请先登录 RT-Thread 账号。"));
      }
      return;
    }
    try {
      await createConversation();
    } catch (error) {
      if (chatLog) {
        chatLog.appendChild(
          createMessageElement("system", `操作失败：${buildErrorMessage(error)}`)
        );
      }
    }
  });
}

initializeUserMenu();
applySidebarCollapsed(readStoredSidebarCollapsed());

if (drawerTriggerButton) {
  drawerTriggerButton.addEventListener("click", (event) => {
    event.preventDefault();
    applyDrawerOpen(true);
  });
}

if (drawerBackdrop) {
  drawerBackdrop.addEventListener("click", () => {
    applyDrawerOpen(false);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawerOpen) {
    applyDrawerOpen(false);
  }
});

if (toggleConversationButton) {
  toggleConversationButton.addEventListener("click", (event) => {
    event.preventDefault();
    const next = !sidebarCollapsed;
    applySidebarCollapsed(next);
    storeSidebarCollapsed(next);
  });
}
bootstrap().catch(() => {});
