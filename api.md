# RT-Thread AI Chat API 调用文档（当前项目）

本文档基于当前代码实现整理，可直接给其他开发人员使用。

## 基础信息
- Base URL: `https://ai.rt-thread.org`
- 请求/响应为 JSON，设置 `Content-Type: application/json`
- 认证方式：登录后服务端设置 `sid` Cookie，调用 `/api/*` 需携带 Cookie
- 流式对话使用 SSE（`text/event-stream`）

## 鉴权流程（OAuth 登录）
1) 浏览器跳转 `GET /auth/login`
2) OAuth 完成后回调 `GET /auth/callback`，服务端设置 `sid` Cookie 并重定向 `/chat`
3) 前端请求 `/api/*` 时带 Cookie（浏览器 `fetch` 用 `credentials: "include"` 或 `"same-origin"`）

## 错误响应（通用）
- 401: `{"error":"not_authenticated","message":"Login required."}`
- 403: `{"error":"forbidden","message":"Access denied."}` 或 `Admin only.`
- 404: `{"error":"not_found","message":"... not found."}`
- 5xx: `{"error":"ai_error","message":"AI service unavailable."}` 或 `{"error":"ai_not_configured","message":"AI config missing. Set LLM_API_KEY."}`

## 接口说明 - 认证

### `GET /auth/login`
说明：发起 OAuth 登录，302 跳转至 RT-Thread 账号中心。  
认证：无需。

### `GET /auth/callback`
说明：OAuth 回调地址，服务端写入 `sid` Cookie 后重定向 `/chat`。  
认证：无需（由 OAuth 服务调用）。

### `POST /auth/logout`
说明：注销当前会话，清理 Cookie。  
响应：若 `Accept` 为 `text/html` 则重定向 `/`，否则返回 204。

## 接口说明 - 用户

### `GET /api/me`（需登录）
说明：获取当前用户信息与 OAuth token。  
响应示例：
```json
{
  "user": {
    "id": "usr_xxx",
    "role": "user",
    "avatar": null,
    "name": "张三",
    "email": "xx@example.com",
    "phone": "138****",
    "company": "RT-Thread",
    "chip": null,
    "rtthread_version": null,
    "toolchain": null,
    "board": null,
    "component": null,
    "issue_type": null,
    "domain": null,
    "notes": null,
    "summary": null,
    "summaryUpdatedAt": null,
    "extractions": [],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z",
    "lastLoginAt": "2024-01-02T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "xxxx",
    "scope": "openid profile email phone",
    "expiresIn": 3600
  }
}
```

用户字段说明（简要）：
- 基本字段: `id`, `role`, `avatar`, `name`, `email`, `phone`
- 技术资料: `company`, `chip`, `rtthread_version`, `toolchain`, `board`, `component`
- 其他资料: `issue_type`, `domain`, `notes`, `summary`, `summaryUpdatedAt`, `extractions`
- 时间与 OAuth: `createdAt`, `updatedAt`, `lastLoginAt`, `openId`, `sub`（仅管理员可见）

兼容路径：`GET /me`（同 `/api/me`）。

## 接口说明 - 会话/对话管理

### `GET /api/conversations`（需登录）
说明：获取会话列表；管理员可通过 `?userId=<id>` 查询指定用户。  
响应示例：
```json
{
  "conversations": [
    {
      "id": "conv_xxx",
      "title": "对话 1",
      "autoTitle": true,
      "updatedAt": "2024-01-02T00:00:00.000Z",
      "lastMessageAt": "2024-01-02T00:00:00.000Z",
      "messageCount": 3,
      "lastMessage": {
        "role": "bot",
        "text": "你好",
        "timestamp": "2024-01-02T00:00:00.000Z"
      }
    }
  ],
  "userId": "usr_xxx"
}
```

### `POST /api/conversations`（需登录）
请求：`{ "title": "可选标题" }`（不传则自动生成）  
响应：`{ "conversation": { ...详情... } }`

### `GET /api/conversations/:id`（需登录）
说明：获取会话详情；管理员可访问任意用户会话。  
响应：`{ "conversation": { ...详情... } }`

### `PUT /api/conversations/:id`（需登录）
请求：`{ "title": "新标题" }`  
响应：`{ "conversation": { ...摘要... } }`

### `DELETE /api/conversations/:id`（需登录）
响应：`{ "ok": true }`

会话字段说明（简要）：
- 会话摘要字段: `id`, `title`, `autoTitle`, `updatedAt`, `lastMessageAt`
- 会话摘要字段: `messageCount`, `lastMessage(role/text/timestamp)`
- 会话详情字段: `createdAt`, `messages(id/role/text/timestamp)`
- 消息角色: `user` | `bot` | `system`

## 接口说明 - 对话

### `POST /api/chat`（需登录）
请求：
```json
{
  "message": "你好",
  "conversationId": "conv_xxx"
}
```
说明：`message` 必填，`conversationId` 可不传（会自动新建会话）。  
响应示例：
```json
{
  "reply": "你好，有什么可以帮你？",
  "policyVersion": "m7_xxx",
  "policyAction": "allow",
  "policyReason": null,
  "suggestions": [],
  "conversationId": "conv_xxx",
  "messages": [
    { "id": "msg_1", "role": "user", "text": "你好", "timestamp": "..." },
    { "id": "msg_2", "role": "bot", "text": "你好，有什么可以帮你？", "timestamp": "..." }
  ],
  "conversation": { "...会话摘要..." }
}
```
字段说明（简要）：
- `reply`: AI 回复文本
- `policyVersion`/`policyAction`/`policyReason`: 策略版本与处理结果（action 可能为 `allow`/`block`/`clarify`）
- `suggestions`: 字符串数组（问题引导提示）
- `conversation`/`messages`: 会话摘要与本次新增消息

### `POST /api/chat/stream`（需登录，SSE）
请求同上，响应为 `text/event-stream`。

## SSE 流式说明
服务端会按行输出 `data:`：
```text
data: {"type":"start","conversationId":"conv_xxx","policyVersion":"m7_xxx","policyAction":"allow","policyReason":null}

data: {"type":"delta","delta":"你"}
data: {"type":"delta","delta":"好"}

data: {"type":"done","data":{...完整响应...}}
data: [DONE]
```

`type` 说明：`start` 初始化、`delta` 片段增量、`done` 完整响应、`error` 错误提示。

## 接口说明 - 管理员（需 admin）

### `GET /api/users`
说明：用户列表，可选 `?q=关键词`。  
响应：`{ "users": [...], "total": 123 }`

### `GET /api/users/:id`（admin 或本人）
说明：获取用户详情。

### `PUT /api/users/:id/profile`（admin 或本人）
说明：更新用户资料；请求体可直接放字段或 `{ "profile": { ... } }`。

### `PUT /api/users/:id`（admin 或本人）
说明：与上面一致，兼容路径。

## 典型调用示例（浏览器）
```js
// 1) 先打开登录页（浏览器跳转）
window.location.href = `${API_BASE}/auth/login`;

// 2) 登录后调用 API（带 Cookie）
const res = await fetch(`${API_BASE}/api/chat`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "你好", conversationId: null })
});
const data = await res.json();
```

## 典型调用示例（curl，已获取 sid Cookie）
```bash
curl -X POST "https://ai.rt-thread.org/api/chat" \
  -H "Content-Type: application/json" \
  -b "sid=YOUR_SID_COOKIE" \
  -d '{"message":"你好","conversationId":null}'
```

## 注意事项
- `message` 最长 4000 字符；会话标题最长 80 字符，超长会截断。
- 未配置 `LLM_API_KEY` 时 `/api/chat` 会返回 `ai_not_configured` 错误。

## 跨域调用（CORS/CSRF）
当前实现是 **Cookie Session** 鉴权，跨域调用需要后端配合配置：
- 现状：服务未启用 CORS，浏览器跨域请求会被拦截（需同域或加反向代理）。
- CORS 需允许具体来源并启用凭证：
  - `Access-Control-Allow-Origin` 必须是具体域名（不能是 `*`）。
  - `Access-Control-Allow-Credentials: true`。
  - 允许的请求头（如 `Content-Type`）和方法（`GET/POST/PUT/DELETE`）。
  - 处理 `OPTIONS` 预检请求。
- Cookie 需支持跨站：
  - `SameSite=None; Secure`（且必须 HTTPS）。
  - 否则浏览器不会在跨域请求中携带 `sid`。
- CSRF 风险说明：
  - 一旦允许跨站 Cookie，跨域页面可能在用户不知情的情况下发起带 Cookie 的请求。
  - 建议增加 CSRF 防护（CSRF Token / 双重 Cookie 等）或改为 `Authorization: Bearer <token>` 方式。

## OpenAPI / Swagger
- 当前项目未内置 OpenAPI/Swagger 文档或 UI。
- 推荐版本：OpenAPI 3.0.3（兼容性最佳，生态稳定）。
- 若后续需要：
  - 新增 `docs/openapi.yaml` 维护接口定义。
  - 增加 `/docs`（Swagger UI）或 `/openapi.json` 输出规范文件。
