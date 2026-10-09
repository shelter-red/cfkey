# CFKey

CFKey 是一个面向个人运维场景的密钥管理器，使用一个 Cloudflare Worker 和一个 D1 数据库运行。它支持类型模板、前缀搜索、按需解密、复制、收藏、回收站和短期审计。

## 一键部署

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shelter-red/cfkey)

Cloudflare 会复制公开仓库、创建 Worker 和 D1、执行迁移并完成部署。部署页面会要求填写以下 Worker Secrets：

- `ADMIN_PASSWORD`：管理员密码，至少 32 个随机字符。
- `SESSION_SECRET`：会话签名密钥，建议使用 `openssl rand -hex 32` 生成。
- `VAULT_MASTER_SECRET`：数据加密主密钥，建议使用 `openssl rand -hex 32` 生成并离线备份。

仓库不包含生产域名、Cloudflare Account ID、真实数据库 ID、API Token 或任何可用密钥。`wrangler.jsonc` 中的全零 D1 ID 只是供一键部署识别资源的无效占位符。默认部署使用当前 Cloudflare 账户的 `workers.dev` 地址。

> `VAULT_MASTER_SECRET` 丢失后，已保存内容无法恢复。不要将三个 Secret 设为相同值。

## 私有配置自定义域名

生产域名不写进仓库。完成一键部署后，在 Cloudflare Dashboard 中打开对应 Worker：

1. 进入 **Settings → Domains & Routes**。
2. 选择 **Add → Custom Domain**，在控制台中填写域名并完成绑定。
3. 确认自定义域名可访问后，按需要在同一页面关闭 `workers.dev` 入口。

域名绑定保存在 Cloudflare 项目配置中，不需要修改或提交 `wrangler.jsonc`。本地临时配置如 `wrangler.private.jsonc` 和 `wrangler.local.jsonc` 已加入 `.gitignore`。

## Cloudflare 资源

运行时只使用以下资源：

- 1 个 Worker
- 1 个 D1 数据库
- Workers Static Assets

不使用 Durable Objects、KV、R2、Queues、Cron、Vectorize、Access、Turnstile 或 Analytics API。静态页面与资源不进入 Worker，只有 `/api/*` 请求执行 Worker 代码。

| 操作 | 动态请求 | D1 读取 | D1 写入 |
| --- | ---: | ---: | ---: |
| 加载静态页面 | 0 | 0 | 0 |
| 登录、会话检查、解锁 | 1 | 0 | 0 |
| 列表、搜索、筛选 | 1 | 最多约 31 行 | 0 |
| 查看或复制字段 | 1 | 1 行 | 1 条审计 |
| 创建或编辑 | 1 | 0 至 1 行 | 条目、索引、标签和审计 |

应用没有轮询、WebSocket、定时任务或自动健康检查。审计保留 30 天或最近 3,000 条，回收站和审计由正常写操作概率触发限量清理。

## 本地开发

要求 Node.js 22+。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npm run dev:worker
```

Vue 开发服务器仅用于前端样式开发：

```bash
npm run dev
```

## 持续部署

一键部署创建的仓库会由 Cloudflare Workers Builds 持续部署。仓库也包含可选 GitHub Actions 工作流，需要在仓库 Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

首次通过 GitHub Actions 部署前，应先用一键部署或 Wrangler 创建并写入 D1 绑定。

## 公开仓库安全

- `.dev.vars*`、`.env*`、私有 Wrangler 配置和常见私钥文件默认不会被 Git 收录。
- `.dev.vars.example` 只保留空变量名，不提供示例密码或示例主密钥。
- GitHub Actions 会在每次推送和 Pull Request 时使用 Gitleaks 扫描完整 Git 历史。
- 生产 Secret 只通过 Cloudflare Dashboard、`wrangler secret put` 或 GitHub Repository Secrets 配置。
- 提交前可运行 `git status --short --ignored`，确认本地配置显示为 ignored。

## 密钥轮换

更新 `ADMIN_PASSWORD` 时同步更新 `SESSION_SECRET`，以使旧会话失效。

轮换加密主密钥时：

1. 将旧值临时配置为 `VAULT_MASTER_SECRET_PREVIOUS`。
2. 将新值配置为 `VAULT_MASTER_SECRET` 并部署。
3. 正常打开或编辑条目，记录会惰性使用新密钥重新加密。
4. 确认旧条目均可访问后删除 `VAULT_MASTER_SECRET_PREVIOUS`。

## 安全边界

- 部署密码直接保存在 Worker Secret，不写入 D1。
- 敏感字段由 AES-256-GCM 加密，元数据只保存名称、类型、服务商、分类和标签。
- 登录 Cookie 有效 12 小时；查看与复制需要再次验证，解锁有效 5 分钟。
- 页面进入后台时会清除解锁状态和前端明文。
- 不支持附件；单条加密内容最大 64KB。
- 搜索仅支持名称和服务商前缀、类型、分类及标签，以避免 D1 全表扫描。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
