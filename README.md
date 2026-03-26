# Cloudflare WeChat Notifier

基于 `Cloudflare Workers + Hono + D1 + Queues` 的 iLink / WeClawBot Webhook 服务。

它把外部系统的文本通知桥接到微信 `ClawBot`，并补齐了 iLink 协议在云端部署时常见的几个缺口：扫码登录、`context_token` 激活、投递日志、异步重试，以及一个可直接在浏览器里操作的轻量管理页面。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/krapnikkk/Cloudflare-WeChat-Notifier)

```mermaid
flowchart LR
  A["GitHub / CI / 监控系统 / 任意业务服务"] --> B["/webhook/:source"]
  B --> C["Cloudflare Worker (Hono)"]
  C --> D[("D1: bot_state / login_session / delivery_log")]
  C --> E["Cloudflare Queue"]
  E --> F["iLink API / WeClawBot-API"]
  F --> G["微信 ClawBot"]
  C --> H["Dashboard / 二维码页 / 日志中心"]
```

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [适用场景](#适用场景)
- [快速开始](#快速开始)
- [配置项说明](#配置项说明)
- [使用流程](#使用流程)
- [管理页面](#管理页面)
- [截图](#截图)
- [API 快览](#api-快览)
- [请求示例](#请求示例)
- [项目结构](#项目结构)
- [开发命令](#开发命令)
- [当前限制](#当前限制)
- [许可证](#许可证)

---

## 功能特性

| 能力 | 说明 |
|---|---|
| Webhook 入站 | 通过 `POST /webhook/:source` 接收业务系统通知，校验后快速入队，立即返回 `202` |
| iLink 协议封装 | 内置 `get_bot_qrcode`、`get_qrcode_status`、`getupdates`、`sendmessage`、`sendtyping` |
| Bot 扫码登录 | 提供二维码会话创建、扫码状态轮询、登录结果持久化 |
| Bot 激活 | 首次登录后可主动执行激活，拿到 `context_token` 与 `get_updates_buf` |
| 异步投递 | 通过 Cloudflare Queues 解耦入站和发信，支持失败重试 |
| 敏感信息加密 | `bot_token`、`ilink_user_id`、`context_token` 等敏感字段入库前使用 AES-GCM 加密 |
| 投递日志 | 记录 `trace_id`、`dedupe_key`、状态、响应码、错误信息和尝试次数 |
| 幂等支持 | 传入 `dedupeKey` 时，按 `source + dedupeKey` 防止重复投递 |
| 管理页面 | 提供总览页、二维码页、日志中心，适合部署后直接使用 |

---

## 技术栈

| 模块 | 选型 | 说明 |
|---|---|---|
| 运行时 | Cloudflare Workers | 承载 HTTP 服务和队列消费者 |
| 路由层 | Hono | 适合 Worker 的轻量路由与中间件 |
| 数据库 | Cloudflare D1 | 保存 bot 状态、登录会话、投递日志 |
| 队列 | Cloudflare Queues | 实现入站异步化和失败重试 |
| 语言 | TypeScript | 统一接口契约和类型约束 |
| 测试 | Vitest | 覆盖路由、加密逻辑、队列消费和协议适配 |
| 二维码 | `qrcode` | 服务端渲染 SVG 登录二维码 |

---

## 适用场景

| 场景 | 是否适合 |
|---|---|
| GitHub Actions / CI 完成后推送微信通知 | 适合 |
| 监控告警、值班消息、部署回调推送到微信 | 适合 |
| 只想要一个单 bot、单租户的轻量通知桥接 | 适合 |
| 多 bot、多租户、复杂权限系统 | 暂不适合 |
| 图片、文件、富媒体消息转发 | 暂不支持 |

---

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <your-repo-url>
cd ilink-cloudflare
npm install
```

### 2. 创建 Cloudflare 资源

```bash
npx wrangler d1 create ilink-cloudflare
npx wrangler queues create ilink-notification-queue
```

### 3. 复制并填写 `wrangler.toml`

```powershell
Copy-Item wrangler.toml.example wrangler.toml
```

把上一步输出中的 D1 `database_id` 填回 `wrangler.toml`，并确认 queue 名与配置一致。

### 4. 配置本地环境

```powershell
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars` 示例：

```env
ADMIN_TOKEN=replace-with-admin-token
WEBHOOK_SHARED_TOKEN=replace-with-webhook-token
BOT_STATE_ENC_KEY=replace-with-long-random-secret
ILINK_BASE_URL=https://ilinkai.weixin.qq.com
```

### 5. 配置 Cloudflare Secrets

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put WEBHOOK_SHARED_TOKEN
npx wrangler secret put BOT_STATE_ENC_KEY
```

### 6. 初始化数据库

```bash
npm run cf:migrate:local
npm run cf:migrate:remote
```

### 7. 本地调试或部署

```bash
npm run dev
npm run deploy
```

部署成功后，你会得到一个 `https://<your-worker>.workers.dev` 地址。

---

## 配置项说明

| 配置项 | 类型 | 必填 | 用途 |
|---|---|---|---|
| `ADMIN_TOKEN` | Secret | 是 | 保护 `/admin/*` 和 `/api/*` 接口 |
| `WEBHOOK_SHARED_TOKEN` | Secret | 是 | 校验 `/webhook/:source` 请求头中的 `X-Webhook-Token` |
| `BOT_STATE_ENC_KEY` | Secret | 是 | 加密 D1 中保存的敏感 bot 信息 |
| `ILINK_BASE_URL` | Variable | 否 | iLink API 地址，默认 `https://ilinkai.weixin.qq.com` |
| `DB` | D1 Binding | 是 | D1 数据库绑定 |
| `NOTIFICATION_QUEUE` | Queue Binding | 是 | 消息投递队列绑定 |

---

## 使用流程

| 步骤 | 操作 |
|---|---|
| 1 | 打开 `/admin/dashboard?token=ADMIN_TOKEN` 进入总览页 |
| 2 | 点击“打开二维码页”，或直接访问 `/admin/bot/login/qrcode/page?token=ADMIN_TOKEN` |
| 3 | 使用微信扫码，轮询到 `confirmed` 为止 |
| 4 | 给“微信ClawBot”发一条消息，生成可用上下文 |
| 5 | 回到总览页点击“尝试激活”，拿到 `context_token` |
| 6 | 用 `/api/send` 发送测试消息，或让外部系统调用 `/webhook/:source` |
| 7 | 在 `/admin/deliveries/page?token=ADMIN_TOKEN` 查看投递结果和失败原因 |

---

## 管理页面

| 页面 | 地址 | 说明 |
|---|---|---|
| 总览页 | `/admin/dashboard?token=ADMIN_TOKEN` | 查看 bot 状态、手动激活、测试发信、最近日志 |
| 二维码页 | `/admin/bot/login/qrcode/page?token=ADMIN_TOKEN` | 浏览器直接展示登录二维码并自动轮询扫码状态 |
| 日志中心 | `/admin/deliveries/page?token=ADMIN_TOKEN` | 筛选日志、查看详情、自动刷新 |

示例：

```text
http://127.0.0.1:8787/admin/dashboard?token=ADMIN_TOKEN&refresh=10&logsLimit=12
http://127.0.0.1:8787/admin/bot/login/qrcode/page?token=ADMIN_TOKEN
http://127.0.0.1:8787/admin/deliveries/page?token=ADMIN_TOKEN&status=failed&limit=50&refresh=10
```

---

## 截图

![Dashboard 总览](assets/images/dashboard.png)

![二维码登录页](assets/images/qrcode.png)

---

## API 快览

| 方法 | 路径 | 鉴权方式 | 说明 |
|---|---|---|---|
| `GET` | `/healthz` | 无 | 健康检查，返回数据库和队列状态 |
| `POST` | `/admin/bot/login/qrcode` | `Authorization: Bearer ADMIN_TOKEN` | 创建登录二维码会话 |
| `GET` | `/admin/bot/login/status/:sessionId` | `Authorization: Bearer ADMIN_TOKEN` 或 `?token=` | 查询扫码状态 |
| `POST` | `/admin/bot/activate` | `Authorization: Bearer ADMIN_TOKEN` 或 `?token=` | 激活 bot，尝试获取 `context_token` |
| `GET` | `/admin/bot/status` | `Authorization: Bearer ADMIN_TOKEN` 或 `?token=` | 查询当前 bot 状态 |
| `GET` | `/admin/deliveries` | `Authorization: Bearer ADMIN_TOKEN` 或 `?token=` | 查询投递日志列表 |
| `GET` | `/admin/deliveries/:deliveryId` | `Authorization: Bearer ADMIN_TOKEN` 或 `?token=` | 查询单条投递详情 |
| `POST` | `/api/send` | `Authorization: Bearer ADMIN_TOKEN` | 管理员手动发送测试消息 |
| `POST` | `/webhook/:source` | `X-Webhook-Token` | 外部系统推送通知入口 |

---

## 请求示例

### 1. 发送测试消息

```bash
curl -X POST "http://127.0.0.1:8787/api/send" -H "Content-Type: application/json" -H "Authorization: Bearer ADMIN_TOKEN" -d "{\"text\":\"Cloudflare deploy succeeded\",\"dedupeKey\":\"deploy-20260326-1\"}"
```

### 2. 调用业务 Webhook

```bash
curl -X POST "http://127.0.0.1:8787/webhook/github" -H "Content-Type: application/json" -H "X-Webhook-Token: WEBHOOK_SHARED_TOKEN" -d "{\"text\":\"Release v1.0.0 published\",\"traceId\":\"github-release-001\",\"meta\":{\"repo\":\"demo/app\"}}"
```

### 3. 查询最近日志

```bash
curl "http://127.0.0.1:8787/admin/deliveries?token=ADMIN_TOKEN&limit=20&status=delivered"
```

### 4. 标准消息体

```json
{
  "text": "build completed",
  "traceId": "optional-trace-id",
  "dedupeKey": "optional-dedupe-key",
  "meta": {
    "env": "prod"
  }
}
```

---

## 项目结构

| 路径 | 说明 |
|---|---|
| `src/index.ts` | Worker 入口，同时处理 HTTP 和 Queue Consumer |
| `src/app.ts` | Hono 路由定义和鉴权 |
| `src/ilink/client.ts` | iLink 协议客户端 |
| `src/services/` | 管理、投递、健康检查等业务服务 |
| `src/storage/` | D1 仓储层 |
| `src/lib/` | 加密、校验、页面模板、错误处理等基础能力 |
| `src/queue/consumer.ts` | Queue 消费与重试流程 |
| `migrations/0001_init.sql` | D1 初始化表结构 |
| `test/` | Vitest 测试用例 |

---

## 开发命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 本地启动 Worker |
| `npm run deploy` | 部署到 Cloudflare Workers |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm test` | 执行测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run cf:migrate:local` | 对本地 D1 应用迁移 |
| `npm run cf:migrate:remote` | 对远程 D1 应用迁移 |
| `npm run cf:types` | 生成 Cloudflare 绑定类型 |

---

## 当前限制

| 项目 | 说明 |
|---|---|
| 单 bot | 当前只维护一个活跃 bot 状态 |
| 单租户 | 没有多用户和权限体系 |
| 仅文本消息 | 暂不支持图片、文件、卡片等复杂消息类型 |
| 无 iLink 入站转发 | 当前只处理“外部系统 -> 微信”这条链路 |
| 管理端较轻量 | 目前是 HTML 管理页，不是完整 SPA 控制台 |

---

## 协议参考

- iLink / WeClawBot-API: [https://github.com/Cp0204/WeClawBot-API](https://github.com/Cp0204/WeClawBot-API)

---

## 许可证

[MIT](LICENSE)
